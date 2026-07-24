import re
from collections.abc import Iterator
from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
from typing import Any

from docx import Document
from docx.document import Document as DocxDocument
from docx.oxml.ns import qn
from docx.parts.hdrftr import FooterPart, HeaderPart
from docx.table import Table
from docx.text.paragraph import Paragraph
from sqlalchemy.orm import Session

from app.services.contract_documents import (
    GeneratedContractFileNotFoundError,
    get_contract_document_version,
    resolve_generated_file_path,
)

HORIZONTAL_WHITESPACE_PATTERN = re.compile(
    r"[^\S\r\n]+"
)


@dataclass(frozen=True)
class ContractAnalysisInput:
    contract_id: int
    document_version_id: int
    version_number: int
    file_name: str
    source: str
    source_file_sha256: str
    extracted_text_sha256: str
    source_file_size_bytes: int
    extracted_text_characters: int
    extracted_text_size_bytes: int
    text: str


class ContractAnalysisDocumentUnavailableError(
    Exception
):
    """Файл версии договора недоступен."""


class ContractAnalysisDocumentIntegrityError(
    Exception
):
    """Хэш файла не совпадает с хэшем версии."""


class InvalidContractAnalysisDocumentError(
    Exception
):
    """Версия договора не является корректным DOCX."""


class EmptyContractAnalysisDocumentError(Exception):
    """DOCX не содержит текста для анализа."""


def normalize_contract_analysis_text(
    value: str,
) -> str:
    normalized = (
        value.replace("\r\n", "\n")
        .replace("\r", "\n")
        .replace("\u00a0", " ")
    )
    lines = [
        HORIZONTAL_WHITESPACE_PATTERN.sub(
            " ",
            line,
        ).strip()
        for line in normalized.split("\n")
    ]

    return "\n".join(
        line
        for line in lines
        if line
    )


def iter_block_items(
    root: Any,
    parent: Any,
) -> Iterator[Paragraph | Table]:
    for child in root.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, parent)
            continue

        if child.tag == qn("w:tbl"):
            yield Table(child, parent)
            continue

        yield from iter_block_items(
            child,
            parent,
        )


def escape_table_cell(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("|", "\\|")
        .replace("\n", "\\n")
    )


def render_table(table: Table) -> str:
    rendered_rows: list[str] = []
    seen_cells: set[Any] = set()
    has_text = False

    for row in table.rows:
        rendered_cells: list[str] = []

        for cell in row.cells:
            cell_identifier = cell._tc

            if cell_identifier in seen_cells:
                rendered_cells.append("")
                continue

            seen_cells.add(cell_identifier)
            cell_blocks = render_blocks(
                cell._tc,
                cell,
            )
            cell_text = "\n\n".join(cell_blocks)
            has_text = has_text or bool(cell_text)
            rendered_cells.append(
                escape_table_cell(cell_text)
            )

        rendered_rows.append(
            "| "
            + " | ".join(rendered_cells)
            + " |"
        )

    if not has_text:
        return ""

    return "\n".join(
        [
            "[TABLE]",
            *rendered_rows,
            "[/TABLE]",
        ]
    )


def render_blocks(
    root: Any,
    parent: Any,
) -> list[str]:
    rendered: list[str] = []

    for block in iter_block_items(root, parent):
        if isinstance(block, Paragraph):
            paragraph_text = (
                normalize_contract_analysis_text(
                    block.text
                )
            )

            if paragraph_text:
                rendered.append(paragraph_text)

            continue

        table_text = render_table(block)

        if table_text:
            rendered.append(table_text)

    return rendered


def get_header_footer_parts(
    document: DocxDocument,
    part_type: type[HeaderPart] | type[FooterPart],
) -> list[HeaderPart | FooterPart]:
    return sorted(
        (
            part
            for part in document.part.package.parts
            if isinstance(part, part_type)
        ),
        key=lambda part: str(part.partname),
    )


def append_story_parts(
    sections: list[str],
    *,
    document: DocxDocument,
    part_type: type[HeaderPart] | type[FooterPart],
    label: str,
) -> None:
    story_number = 0

    for part in get_header_footer_parts(
        document,
        part_type,
    ):
        blocks = render_blocks(
            part.element,
            part,
        )

        if not blocks:
            continue

        story_number += 1
        sections.append(
            f"[{label} {story_number}]\n"
            + "\n\n".join(blocks)
        )


def extract_contract_analysis_text(
    document: DocxDocument,
) -> str:
    sections: list[str] = []

    append_story_parts(
        sections,
        document=document,
        part_type=HeaderPart,
        label="HEADER",
    )

    body_blocks = render_blocks(
        document.element.body,
        document,
    )

    if body_blocks:
        sections.append(
            "[BODY]\n"
            + "\n\n".join(body_blocks)
        )

    append_story_parts(
        sections,
        document=document,
        part_type=FooterPart,
        label="FOOTER",
    )

    return "\n\n".join(sections)


def is_sha256(value: str) -> bool:
    return (
        len(value) == 64
        and all(
            character in "0123456789abcdef"
            for character in value
        )
    )


def prepare_contract_analysis_input(
    session: Session,
    contract_id: int,
    version_number: int,
) -> ContractAnalysisInput:
    version = get_contract_document_version(
        session=session,
        contract_id=contract_id,
        version_number=version_number,
    )

    try:
        path = resolve_generated_file_path(
            version.storage_path
        )
        content = path.read_bytes()
    except (
        GeneratedContractFileNotFoundError,
        OSError,
    ) as error:
        raise (
            ContractAnalysisDocumentUnavailableError
        ) from error

    actual_file_sha256 = sha256(content).hexdigest()
    expected_file_sha256 = (
        version.file_sha256 or ""
    ).lower()

    if (
        not is_sha256(expected_file_sha256)
        or actual_file_sha256
        != expected_file_sha256
    ):
        raise ContractAnalysisDocumentIntegrityError

    try:
        document = Document(BytesIO(content))
    except Exception as error:
        raise (
            InvalidContractAnalysisDocumentError
        ) from error

    text = extract_contract_analysis_text(document)

    if not text:
        raise EmptyContractAnalysisDocumentError

    encoded_text = text.encode("utf-8")

    return ContractAnalysisInput(
        contract_id=contract_id,
        document_version_id=version.id,
        version_number=version.version_number,
        file_name=version.file_name,
        source=version.source,
        source_file_sha256=actual_file_sha256,
        extracted_text_sha256=sha256(
            encoded_text
        ).hexdigest(),
        source_file_size_bytes=len(content),
        extracted_text_characters=len(text),
        extracted_text_size_bytes=len(encoded_text),
        text=text,
    )
