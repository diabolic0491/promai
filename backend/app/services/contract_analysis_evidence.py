from dataclasses import dataclass
from hashlib import sha256

from app.services.contract_analysis_input import (
    ContractAnalysisInput,
)

EVIDENCE_BLOCK_SEPARATOR = "\n\n"
EVIDENCE_IDENTIFIER_DOMAIN = (
    "promai:contract-analysis-evidence:v1"
)


@dataclass(frozen=True)
class ContractAnalysisEvidenceBlock:
    block_id: str
    ordinal: int
    start_character: int
    end_character: int
    text_sha256: str
    text: str


@dataclass(frozen=True)
class ContractAnalysisEvidenceIndex:
    contract_id: int
    document_version_id: int
    version_number: int
    source_file_sha256: str
    extracted_text_sha256: str
    blocks: tuple[
        ContractAnalysisEvidenceBlock,
        ...,
    ]


@dataclass(frozen=True)
class ContractAnalysisEvidenceReference:
    contract_id: int
    document_version_id: int
    version_number: int
    source_file_sha256: str
    extracted_text_sha256: str
    block_id: str
    start_character: int
    end_character: int
    quote: str


@dataclass(frozen=True)
class VerifiedContractAnalysisEvidence:
    reference: ContractAnalysisEvidenceReference
    block: ContractAnalysisEvidenceBlock
    quote_sha256: str


class InvalidContractAnalysisEvidenceInputError(
    Exception
):
    """Вход анализа нельзя преобразовать в доказательный индекс."""


class ContractAnalysisEvidenceDocumentMismatchError(
    Exception
):
    """Ссылка относится к другому договору или версии документа."""


class ContractAnalysisEvidenceBlockNotFoundError(
    Exception
):
    """Указанный доказательный блок отсутствует."""


class InvalidContractAnalysisEvidenceRangeError(
    Exception
):
    """Диапазон цитаты выходит за границы доказательного блока."""


class ContractAnalysisEvidenceQuoteMismatchError(
    Exception
):
    """Цитата не совпадает с текстом указанного диапазона."""


def is_sha256(value: object) -> bool:
    return (
        isinstance(value, str)
        and len(value) == 64
        and all(
            character in "0123456789abcdef"
            for character in value
        )
    )


def has_valid_document_identity(
    *,
    contract_id: object,
    document_version_id: object,
    version_number: object,
    source_file_sha256: object,
    extracted_text_sha256: object,
) -> bool:
    return (
        type(contract_id) is int
        and contract_id > 0
        and type(document_version_id) is int
        and document_version_id > 0
        and type(version_number) is int
        and version_number > 0
        and is_sha256(source_file_sha256)
        and is_sha256(extracted_text_sha256)
    )


def build_evidence_block_id(
    *,
    source_file_sha256: str,
    extracted_text_sha256: str,
    ordinal: int,
    start_character: int,
    end_character: int,
    text_sha256: str,
) -> str:
    identifier_payload = "\n".join(
        (
            EVIDENCE_IDENTIFIER_DOMAIN,
            source_file_sha256,
            extracted_text_sha256,
            str(ordinal),
            str(start_character),
            str(end_character),
            text_sha256,
        )
    ).encode("utf-8")

    return (
        "contract-evidence-v1-"
        + sha256(identifier_payload).hexdigest()
    )


def build_evidence_blocks(
    *,
    text: str,
    source_file_sha256: str,
    extracted_text_sha256: str,
) -> tuple[ContractAnalysisEvidenceBlock, ...]:
    block_texts = text.split(
        EVIDENCE_BLOCK_SEPARATOR
    )

    if any(not block_text for block_text in block_texts):
        raise InvalidContractAnalysisEvidenceInputError

    blocks: list[
        ContractAnalysisEvidenceBlock
    ] = []
    start_character = 0

    for ordinal, block_text in enumerate(
        block_texts,
        start=1,
    ):
        end_character = (
            start_character + len(block_text)
        )
        text_sha256 = sha256(
            block_text.encode("utf-8")
        ).hexdigest()
        block_id = build_evidence_block_id(
            source_file_sha256=source_file_sha256,
            extracted_text_sha256=(
                extracted_text_sha256
            ),
            ordinal=ordinal,
            start_character=start_character,
            end_character=end_character,
            text_sha256=text_sha256,
        )
        blocks.append(
            ContractAnalysisEvidenceBlock(
                block_id=block_id,
                ordinal=ordinal,
                start_character=start_character,
                end_character=end_character,
                text_sha256=text_sha256,
                text=block_text,
            )
        )
        start_character = (
            end_character
            + len(EVIDENCE_BLOCK_SEPARATOR)
        )

    return tuple(blocks)


def build_contract_analysis_evidence_index(
    analysis_input: ContractAnalysisInput,
) -> ContractAnalysisEvidenceIndex:
    if not has_valid_document_identity(
        contract_id=analysis_input.contract_id,
        document_version_id=(
            analysis_input.document_version_id
        ),
        version_number=analysis_input.version_number,
        source_file_sha256=(
            analysis_input.source_file_sha256
        ),
        extracted_text_sha256=(
            analysis_input.extracted_text_sha256
        ),
    ):
        raise InvalidContractAnalysisEvidenceInputError

    if (
        not isinstance(analysis_input.text, str)
        or not analysis_input.text
        or sha256(
            analysis_input.text.encode("utf-8")
        ).hexdigest()
        != analysis_input.extracted_text_sha256
    ):
        raise InvalidContractAnalysisEvidenceInputError

    blocks = build_evidence_blocks(
        text=analysis_input.text,
        source_file_sha256=(
            analysis_input.source_file_sha256
        ),
        extracted_text_sha256=(
            analysis_input.extracted_text_sha256
        ),
    )

    return ContractAnalysisEvidenceIndex(
        contract_id=analysis_input.contract_id,
        document_version_id=(
            analysis_input.document_version_id
        ),
        version_number=analysis_input.version_number,
        source_file_sha256=(
            analysis_input.source_file_sha256
        ),
        extracted_text_sha256=(
            analysis_input.extracted_text_sha256
        ),
        blocks=blocks,
    )


def validate_contract_analysis_evidence_index(
    evidence_index: ContractAnalysisEvidenceIndex,
) -> None:
    if not has_valid_document_identity(
        contract_id=evidence_index.contract_id,
        document_version_id=(
            evidence_index.document_version_id
        ),
        version_number=evidence_index.version_number,
        source_file_sha256=(
            evidence_index.source_file_sha256
        ),
        extracted_text_sha256=(
            evidence_index.extracted_text_sha256
        ),
    ):
        raise InvalidContractAnalysisEvidenceInputError

    if (
        not isinstance(evidence_index.blocks, tuple)
        or not evidence_index.blocks
    ):
        raise InvalidContractAnalysisEvidenceInputError

    if any(
        not isinstance(
            block,
            ContractAnalysisEvidenceBlock,
        )
        or not isinstance(block.text, str)
        or not block.text
        for block in evidence_index.blocks
    ):
        raise InvalidContractAnalysisEvidenceInputError

    reconstructed_text = (
        EVIDENCE_BLOCK_SEPARATOR.join(
            block.text
            for block in evidence_index.blocks
        )
    )

    if (
        sha256(
            reconstructed_text.encode("utf-8")
        ).hexdigest()
        != evidence_index.extracted_text_sha256
    ):
        raise InvalidContractAnalysisEvidenceInputError

    expected_blocks = build_evidence_blocks(
        text=reconstructed_text,
        source_file_sha256=(
            evidence_index.source_file_sha256
        ),
        extracted_text_sha256=(
            evidence_index.extracted_text_sha256
        ),
    )

    if evidence_index.blocks != expected_blocks:
        raise InvalidContractAnalysisEvidenceInputError


def reference_matches_evidence_index(
    *,
    evidence_index: ContractAnalysisEvidenceIndex,
    reference: ContractAnalysisEvidenceReference,
) -> bool:
    return (
        has_valid_document_identity(
            contract_id=reference.contract_id,
            document_version_id=(
                reference.document_version_id
            ),
            version_number=reference.version_number,
            source_file_sha256=(
                reference.source_file_sha256
            ),
            extracted_text_sha256=(
                reference.extracted_text_sha256
            ),
        )
        and reference.contract_id
        == evidence_index.contract_id
        and reference.document_version_id
        == evidence_index.document_version_id
        and reference.version_number
        == evidence_index.version_number
        and reference.source_file_sha256
        == evidence_index.source_file_sha256
        and reference.extracted_text_sha256
        == evidence_index.extracted_text_sha256
    )


def verify_contract_analysis_evidence_reference(
    evidence_index: ContractAnalysisEvidenceIndex,
    reference: ContractAnalysisEvidenceReference,
) -> VerifiedContractAnalysisEvidence:
    validate_contract_analysis_evidence_index(
        evidence_index
    )

    if not reference_matches_evidence_index(
        evidence_index=evidence_index,
        reference=reference,
    ):
        raise (
            ContractAnalysisEvidenceDocumentMismatchError
        )

    block = next(
        (
            candidate
            for candidate in evidence_index.blocks
            if candidate.block_id
            == reference.block_id
        ),
        None,
    )

    if block is None:
        raise ContractAnalysisEvidenceBlockNotFoundError

    if (
        type(reference.start_character) is not int
        or type(reference.end_character) is not int
        or reference.start_character
        < block.start_character
        or reference.end_character
        > block.end_character
        or reference.start_character
        >= reference.end_character
    ):
        raise InvalidContractAnalysisEvidenceRangeError

    relative_start = (
        reference.start_character
        - block.start_character
    )
    relative_end = (
        reference.end_character
        - block.start_character
    )
    expected_quote = block.text[
        relative_start:relative_end
    ]

    if (
        not isinstance(reference.quote, str)
        or reference.quote != expected_quote
    ):
        raise (
            ContractAnalysisEvidenceQuoteMismatchError
        )

    return VerifiedContractAnalysisEvidence(
        reference=reference,
        block=block,
        quote_sha256=sha256(
            reference.quote.encode("utf-8")
        ).hexdigest(),
    )
