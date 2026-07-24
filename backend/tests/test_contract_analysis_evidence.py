from dataclasses import replace
from hashlib import sha256

import pytest

from app.services import contract_analysis_evidence
from app.services.contract_analysis_input import (
    ContractAnalysisInput,
)

SOURCE_FILE_SHA256 = "a" * 64
ANOTHER_FILE_SHA256 = "b" * 64
EXTRACTED_TEXT = """[HEADER 1]
PromAI header

[BODY]
1. Предмет договора

1.1. Поставка
оборудования

[TABLE]
| Условие | Значение |
| Цена \\| НДС | 1000 BYN |
[/TABLE]

[FOOTER 1]
Страница 1"""


def build_analysis_input(
    *,
    text: str = EXTRACTED_TEXT,
    extracted_text_sha256: str | None = None,
) -> ContractAnalysisInput:
    encoded_text = text.encode("utf-8")

    return ContractAnalysisInput(
        contract_id=17,
        document_version_id=41,
        version_number=3,
        file_name="Договор.docx",
        source="uploaded",
        source_file_sha256=SOURCE_FILE_SHA256,
        extracted_text_sha256=(
            extracted_text_sha256
            if extracted_text_sha256 is not None
            else sha256(encoded_text).hexdigest()
        ),
        source_file_size_bytes=2048,
        extracted_text_characters=len(text),
        extracted_text_size_bytes=len(
            encoded_text
        ),
        text=text,
    )


def build_reference(
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    *,
    block_ordinal: int = 3,
    quote: str = "Поставка\nоборудования",
) -> (
    contract_analysis_evidence
    .ContractAnalysisEvidenceReference
):
    block = evidence_index.blocks[
        block_ordinal - 1
    ]
    relative_start = block.text.index(quote)
    start_character = (
        block.start_character + relative_start
    )

    return (
        contract_analysis_evidence
        .ContractAnalysisEvidenceReference(
            contract_id=evidence_index.contract_id,
            document_version_id=(
                evidence_index.document_version_id
            ),
            version_number=(
                evidence_index.version_number
            ),
            source_file_sha256=(
                evidence_index.source_file_sha256
            ),
            extracted_text_sha256=(
                evidence_index.extracted_text_sha256
            ),
            block_id=block.block_id,
            start_character=start_character,
            end_character=(
                start_character + len(quote)
            ),
            quote=quote,
        )
    )


def test_build_evidence_index_is_deterministic() -> None:
    analysis_input = build_analysis_input()

    first_result = (
        contract_analysis_evidence
        .build_contract_analysis_evidence_index(
            analysis_input
        )
    )
    second_result = (
        contract_analysis_evidence
        .build_contract_analysis_evidence_index(
            analysis_input
        )
    )

    assert first_result == second_result
    assert first_result.contract_id == 17
    assert first_result.document_version_id == 41
    assert first_result.version_number == 3
    assert (
        first_result.source_file_sha256
        == SOURCE_FILE_SHA256
    )
    assert first_result.extracted_text_sha256 == (
        sha256(
            EXTRACTED_TEXT.encode("utf-8")
        ).hexdigest()
    )
    assert [
        block.text
        for block in first_result.blocks
    ] == [
        "[HEADER 1]\nPromAI header",
        "[BODY]\n1. Предмет договора",
        "1.1. Поставка\nоборудования",
        (
            "[TABLE]\n"
            "| Условие | Значение |\n"
            "| Цена \\| НДС | 1000 BYN |\n"
            "[/TABLE]"
        ),
        "[FOOTER 1]\nСтраница 1",
    ]
    assert [
        block.ordinal
        for block in first_result.blocks
    ] == [1, 2, 3, 4, 5]

    for block in first_result.blocks:
        assert EXTRACTED_TEXT[
            block.start_character:
            block.end_character
        ] == block.text
        assert block.text_sha256 == sha256(
            block.text.encode("utf-8")
        ).hexdigest()
        assert block.block_id.startswith(
            "contract-evidence-v1-"
        )

    assert first_result.blocks[2].block_id == (
        "contract-evidence-v1-"
        "861accf92cc1666556000c32f19e80d"
        "b1cd4ad7216e60f3a7ae005829c236465"
    )


def test_build_evidence_index_rejects_tampered_text_hash(
) -> None:
    analysis_input = build_analysis_input(
        extracted_text_sha256="c" * 64
    )

    with pytest.raises(
        contract_analysis_evidence
        .InvalidContractAnalysisEvidenceInputError
    ):
        (
            contract_analysis_evidence
            .build_contract_analysis_evidence_index(
                analysis_input
            )
        )


@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("contract_id", 0),
        ("document_version_id", False),
        ("version_number", -1),
        ("source_file_sha256", "not-a-sha256"),
        ("extracted_text_sha256", "A" * 64),
    ],
)
def test_build_evidence_index_rejects_invalid_identity(
    field_name: str,
    invalid_value: object,
) -> None:
    analysis_input = replace(
        build_analysis_input(),
        **{field_name: invalid_value},
    )

    with pytest.raises(
        contract_analysis_evidence
        .InvalidContractAnalysisEvidenceInputError
    ):
        (
            contract_analysis_evidence
            .build_contract_analysis_evidence_index(
                analysis_input
            )
        )


def test_verify_evidence_reference_returns_verified_quote(
) -> None:
    evidence_index = (
        contract_analysis_evidence
        .build_contract_analysis_evidence_index(
            build_analysis_input()
        )
    )
    reference = build_reference(evidence_index)

    result = (
        contract_analysis_evidence
        .verify_contract_analysis_evidence_reference(
            evidence_index,
            reference,
        )
    )

    assert result.reference == reference
    assert result.block == evidence_index.blocks[2]
    assert result.quote_sha256 == sha256(
        reference.quote.encode("utf-8")
    ).hexdigest()


@pytest.mark.parametrize(
    ("field_name", "other_value"),
    [
        ("contract_id", 18),
        ("document_version_id", 42),
        ("version_number", 4),
        (
            "source_file_sha256",
            ANOTHER_FILE_SHA256,
        ),
        ("extracted_text_sha256", "c" * 64),
    ],
)
def test_verify_rejects_another_document_or_version(
    field_name: str,
    other_value: object,
) -> None:
    evidence_index = (
        contract_analysis_evidence
        .build_contract_analysis_evidence_index(
            build_analysis_input()
        )
    )
    reference = replace(
        build_reference(evidence_index),
        **{field_name: other_value},
    )

    with pytest.raises(
        contract_analysis_evidence
        .ContractAnalysisEvidenceDocumentMismatchError
    ):
        (
            contract_analysis_evidence
            .verify_contract_analysis_evidence_reference(
                evidence_index,
                reference,
            )
        )


def test_verify_rejects_unknown_block() -> None:
    evidence_index = (
        contract_analysis_evidence
        .build_contract_analysis_evidence_index(
            build_analysis_input()
        )
    )
    reference = replace(
        build_reference(evidence_index),
        block_id=(
            "contract-evidence-v1-" + "0" * 64
        ),
    )

    with pytest.raises(
        contract_analysis_evidence
        .ContractAnalysisEvidenceBlockNotFoundError
    ):
        (
            contract_analysis_evidence
            .verify_contract_analysis_evidence_reference(
                evidence_index,
                reference,
            )
        )


@pytest.mark.parametrize(
    ("start_delta", "end_delta"),
    [
        (-1, 0),
        (0, 1),
        (20, -20),
    ],
)
def test_verify_rejects_invalid_quote_range(
    start_delta: int,
    end_delta: int,
) -> None:
    evidence_index = (
        contract_analysis_evidence
        .build_contract_analysis_evidence_index(
            build_analysis_input()
        )
    )
    block = evidence_index.blocks[2]
    reference = replace(
        build_reference(evidence_index),
        start_character=(
            block.start_character + start_delta
        ),
        end_character=(
            block.end_character + end_delta
        ),
    )

    with pytest.raises(
        contract_analysis_evidence
        .InvalidContractAnalysisEvidenceRangeError
    ):
        (
            contract_analysis_evidence
            .verify_contract_analysis_evidence_reference(
                evidence_index,
                reference,
            )
        )


def test_verify_rejects_modified_quote() -> None:
    evidence_index = (
        contract_analysis_evidence
        .build_contract_analysis_evidence_index(
            build_analysis_input()
        )
    )
    reference = replace(
        build_reference(evidence_index),
        quote="Поставка\nтовара",
    )

    with pytest.raises(
        contract_analysis_evidence
        .ContractAnalysisEvidenceQuoteMismatchError
    ):
        (
            contract_analysis_evidence
            .verify_contract_analysis_evidence_reference(
                evidence_index,
                reference,
            )
        )


def test_verify_rejects_tampered_evidence_index() -> None:
    evidence_index = (
        contract_analysis_evidence
        .build_contract_analysis_evidence_index(
            build_analysis_input()
        )
    )
    first_block = evidence_index.blocks[0]
    tampered_index = replace(
        evidence_index,
        blocks=(
            replace(
                first_block,
                text=first_block.text + "!",
            ),
            *evidence_index.blocks[1:],
        ),
    )

    with pytest.raises(
        contract_analysis_evidence
        .InvalidContractAnalysisEvidenceInputError
    ):
        (
            contract_analysis_evidence
            .verify_contract_analysis_evidence_reference(
                tampered_index,
                build_reference(evidence_index),
            )
        )


def test_verify_rejects_invalid_evidence_block_text(
) -> None:
    evidence_index = (
        contract_analysis_evidence
        .build_contract_analysis_evidence_index(
            build_analysis_input()
        )
    )
    first_block = evidence_index.blocks[0]
    invalid_index = replace(
        evidence_index,
        blocks=(
            replace(
                first_block,
                text=None,
            ),
            *evidence_index.blocks[1:],
        ),
    )

    with pytest.raises(
        contract_analysis_evidence
        .InvalidContractAnalysisEvidenceInputError
    ):
        (
            contract_analysis_evidence
            .verify_contract_analysis_evidence_reference(
                invalid_index,
                build_reference(evidence_index),
            )
        )
