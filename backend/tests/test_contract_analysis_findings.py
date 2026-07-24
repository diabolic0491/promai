from dataclasses import replace
from hashlib import sha256

import pytest

from app.services import (
    contract_analysis_evidence,
    contract_analysis_findings,
)
from app.services.contract_analysis_input import (
    ContractAnalysisInput,
)

SOURCE_FILE_SHA256 = "a" * 64
EXTRACTED_TEXT = """[BODY]
1. Предмет договора

1.1. Поставка оборудования

2. Срок поставки

2.1. Товар поставляется в течение 30 дней"""


def build_evidence_index() -> (
    contract_analysis_evidence
    .ContractAnalysisEvidenceIndex
):
    encoded_text = EXTRACTED_TEXT.encode("utf-8")
    analysis_input = ContractAnalysisInput(
        contract_id=17,
        document_version_id=41,
        version_number=3,
        file_name="Договор.docx",
        source="uploaded",
        source_file_sha256=SOURCE_FILE_SHA256,
        extracted_text_sha256=sha256(
            encoded_text
        ).hexdigest(),
        source_file_size_bytes=2048,
        extracted_text_characters=len(
            EXTRACTED_TEXT
        ),
        extracted_text_size_bytes=len(
            encoded_text
        ),
        text=EXTRACTED_TEXT,
    )

    return (
        contract_analysis_evidence
        .build_contract_analysis_evidence_index(
            analysis_input
        )
    )


def build_policy(
    *,
    allowed_categories: tuple[
        str,
        ...,
    ] = (
        "commercial",
        "delivery",
    ),
    allowed_severity_levels: tuple[
        str,
        ...,
    ] = (
        "low",
        "medium",
        "high",
    ),
) -> (
    contract_analysis_findings
    .ContractAnalysisFindingsPolicy
):
    return (
        contract_analysis_findings
        .ContractAnalysisFindingsPolicy(
            policy_id="pilot-contract-review",
            policy_version="2026-07-24",
            allowed_categories=(
                allowed_categories
            ),
            allowed_severity_levels=(
                allowed_severity_levels
            ),
        )
    )


def build_reference(
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    *,
    block_ordinal: int = 2,
    quote: str | None = None,
) -> (
    contract_analysis_evidence
    .ContractAnalysisEvidenceReference
):
    block = evidence_index.blocks[
        block_ordinal - 1
    ]
    selected_quote = (
        quote
        if quote is not None
        else block.text
    )
    relative_start = block.text.index(
        selected_quote
    )
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
                start_character
                + len(selected_quote)
            ),
            quote=selected_quote,
        )
    )


def build_finding(
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    *,
    category: str = "delivery",
    severity_level: str = "medium",
    title: str = "Продолжительный срок поставки",
    description: str = (
        "Условие предусматривает поставку "
        "в течение 30 дней."
    ),
    evidence_references: tuple[
        contract_analysis_evidence
        .ContractAnalysisEvidenceReference,
        ...,
    ]
    | None = None,
) -> (
    contract_analysis_findings
    .ContractAnalysisFindingDraft
):
    references = (
        evidence_references
        if evidence_references is not None
        else (
            build_reference(
                evidence_index,
                block_ordinal=4,
                quote="30 дней",
            ),
        )
    )

    return (
        contract_analysis_findings
        .ContractAnalysisFindingDraft(
            category=category,
            severity_level=severity_level,
            title=title,
            description=description,
            evidence_references=references,
        )
    )


def build_machine_draft(
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    *,
    policy: (
        contract_analysis_findings
        .ContractAnalysisFindingsPolicy
        | None
    ) = None,
    findings: tuple[
        contract_analysis_findings
        .ContractAnalysisFindingDraft,
        ...,
    ]
    | None = None,
) -> (
    contract_analysis_findings
    .ContractAnalysisFindingsMachineDraft
):
    selected_findings = (
        findings
        if findings is not None
        else (
            build_finding(evidence_index),
        )
    )

    return (
        contract_analysis_findings
        .build_contract_analysis_findings_machine_draft(
            evidence_index,
            policy=(
                policy
                if policy is not None
                else build_policy()
            ),
            findings=selected_findings,
        )
    )


def test_machine_draft_is_deterministic_and_reviewable(
) -> None:
    evidence_index = build_evidence_index()

    first_result = build_machine_draft(
        evidence_index
    )
    second_result = build_machine_draft(
        evidence_index
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
        evidence_index.extracted_text_sha256
    )
    assert first_result.status == "machine_draft"
    assert first_result.requires_human_review is True
    assert first_result.result_id.startswith(
        "contract-findings-result-v1-"
    )
    assert first_result.result_id == (
        "contract-findings-result-v1-"
        "68f5b3e573476a4819df94ef11476fd4"
        "c008aa986af62ccd9734db56f3a85a07"
    )
    assert first_result.content_sha256 == (
        "494323deb3a3354a95eafc22e295fb"
        "bba97d5705ea367dca8e20451a12e"
        "cd258"
    )
    assert first_result.policy_sha256 == (
        "e4c954c0e88177552603a9f1701c2"
        "d3cd28f4f78bcf58be2d0f7162ade"
        "823d07"
    )

    finding = first_result.findings[0]

    assert finding.ordinal == 1
    assert finding.category == "delivery"
    assert finding.severity_level == "medium"
    assert finding.finding_id.startswith(
        "contract-finding-v1-"
    )
    assert finding.finding_id == (
        "contract-finding-v1-"
        "6afe8502b2e38f30191008b40ed523c9"
        "17ee2e8b74c596aafd31778088dc687d"
    )
    assert finding.content_sha256 == (
        "c4a322039574865c4282afdf4a56e"
        "3b02c99b21d2fdd71c6a1ca413ec5"
        "30c5f5"
    )
    assert len(finding.evidence) == 1
    assert finding.evidence[0].reference.quote == (
        "30 дней"
    )
    assert finding.evidence[0].quote_sha256 == (
        sha256("30 дней".encode()).hexdigest()
    )


def test_policy_is_explicit_and_not_hard_coded(
) -> None:
    evidence_index = build_evidence_index()
    policy = build_policy(
        allowed_categories=("custom-category",),
        allowed_severity_levels=(
            "custom-severity",
        ),
    )
    finding = build_finding(
        evidence_index,
        category="custom-category",
        severity_level="custom-severity",
    )

    result = build_machine_draft(
        evidence_index,
        policy=policy,
        findings=(finding,),
    )

    assert result.policy_id == (
        "pilot-contract-review"
    )
    assert result.policy_version == "2026-07-24"
    assert result.findings[0].category == (
        "custom-category"
    )
    assert result.findings[0].severity_level == (
        "custom-severity"
    )


def test_policy_hash_ignores_allowed_value_order(
) -> None:
    first_policy = build_policy()
    second_policy = build_policy(
        allowed_categories=(
            *reversed(
                first_policy.allowed_categories
            ),
        ),
        allowed_severity_levels=(
            *reversed(
                first_policy
                .allowed_severity_levels
            ),
        ),
    )

    first_hash = (
        contract_analysis_findings
        .build_contract_analysis_policy_sha256(
            first_policy
        )
    )
    second_hash = (
        contract_analysis_findings
        .build_contract_analysis_policy_sha256(
            second_policy
        )
    )

    assert first_hash == second_hash


def test_evidence_order_does_not_change_finding_identity(
) -> None:
    evidence_index = build_evidence_index()
    first_reference = build_reference(
        evidence_index,
        block_ordinal=2,
    )
    second_reference = build_reference(
        evidence_index,
        block_ordinal=4,
    )
    first_finding = build_finding(
        evidence_index,
        evidence_references=(
            second_reference,
            first_reference,
        ),
    )
    second_finding = replace(
        first_finding,
        evidence_references=(
            first_reference,
            second_reference,
        ),
    )

    first_result = build_machine_draft(
        evidence_index,
        findings=(first_finding,),
    )
    second_result = build_machine_draft(
        evidence_index,
        findings=(second_finding,),
    )

    assert first_result == second_result
    assert [
        evidence.block.ordinal
        for evidence
        in first_result.findings[0].evidence
    ] == [2, 4]


def test_distinct_findings_keep_input_order(
) -> None:
    evidence_index = build_evidence_index()
    first_finding = build_finding(
        evidence_index
    )
    second_finding = build_finding(
        evidence_index,
        category="commercial",
        severity_level="low",
        title="Описание предмета договора",
        description=(
            "Предмет договора описан "
            "как поставка оборудования."
        ),
        evidence_references=(
            build_reference(
                evidence_index,
                block_ordinal=2,
            ),
        ),
    )

    result = build_machine_draft(
        evidence_index,
        findings=(
            first_finding,
            second_finding,
        ),
    )

    assert [
        finding.ordinal
        for finding in result.findings
    ] == [1, 2]
    assert [
        finding.title
        for finding in result.findings
    ] == [
        first_finding.title,
        second_finding.title,
    ]
    assert (
        result.findings[0].finding_id
        != result.findings[1].finding_id
    )


@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("category", ""),
        ("severity_level", " medium"),
        ("title", " "),
        ("description", "Описание "),
        ("evidence_references", []),
    ],
)
def test_rejects_malformed_structured_finding(
    field_name: str,
    invalid_value: object,
) -> None:
    evidence_index = build_evidence_index()
    finding = replace(
        build_finding(evidence_index),
        **{field_name: invalid_value},
    )

    with pytest.raises(
        contract_analysis_findings
        .InvalidContractAnalysisFindingsDraftError
    ):
        build_machine_draft(
            evidence_index,
            findings=(finding,),
        )


@pytest.mark.parametrize(
    "findings",
    [
        [],
        ("not-a-structured-finding",),
    ],
)
def test_rejects_invalid_findings_collection(
    findings: object,
) -> None:
    evidence_index = build_evidence_index()

    with pytest.raises(
        contract_analysis_findings
        .InvalidContractAnalysisFindingsDraftError
    ):
        (
            contract_analysis_findings
            .build_contract_analysis_findings_machine_draft(
                evidence_index,
                policy=build_policy(),
                findings=findings,
            )
        )


def test_empty_findings_builds_machine_draft(
) -> None:
    evidence_index = build_evidence_index()

    result = (
        contract_analysis_findings
        .build_contract_analysis_findings_machine_draft(
            evidence_index,
            policy=build_policy(),
            findings=(),
        )
    )

    assert result.status == "machine_draft"
    assert result.requires_human_review is True
    assert result.findings == ()
    assert result.result_id.startswith(
        "contract-findings-result-v1-"
    )
    assert len(result.content_sha256) == 64


def test_rejects_unsupported_category() -> None:
    evidence_index = build_evidence_index()
    finding = build_finding(
        evidence_index,
        category="legal",
    )

    with pytest.raises(
        contract_analysis_findings
        .UnsupportedContractAnalysisFindingCategoryError
    ):
        build_machine_draft(
            evidence_index,
            findings=(finding,),
        )


def test_rejects_unsupported_severity() -> None:
    evidence_index = build_evidence_index()
    finding = build_finding(
        evidence_index,
        severity_level="critical",
    )

    with pytest.raises(
        contract_analysis_findings
        .UnsupportedContractAnalysisFindingSeverityError
    ):
        build_machine_draft(
            evidence_index,
            findings=(finding,),
        )


def test_rejects_finding_without_evidence() -> None:
    evidence_index = build_evidence_index()
    finding = build_finding(
        evidence_index,
        evidence_references=(),
    )

    with pytest.raises(
        contract_analysis_findings
        .InvalidContractAnalysisFindingsDraftError
    ):
        build_machine_draft(
            evidence_index,
            findings=(finding,),
        )


def test_rejects_non_evidence_reference() -> None:
    evidence_index = build_evidence_index()
    finding = build_finding(
        evidence_index,
        evidence_references=(
            "not-an-evidence-reference",
        ),
    )

    with pytest.raises(
        contract_analysis_findings
        .InvalidContractAnalysisFindingsDraftError
    ):
        build_machine_draft(
            evidence_index,
            findings=(finding,),
        )


def test_rejects_duplicate_evidence_reference(
) -> None:
    evidence_index = build_evidence_index()
    reference = build_reference(
        evidence_index,
        block_ordinal=4,
    )
    finding = build_finding(
        evidence_index,
        evidence_references=(
            reference,
            reference,
        ),
    )

    with pytest.raises(
        contract_analysis_findings
        .DuplicateContractAnalysisEvidenceReferenceError
    ):
        build_machine_draft(
            evidence_index,
            findings=(finding,),
        )


def test_rejects_reference_to_another_document_version(
) -> None:
    evidence_index = build_evidence_index()
    reference = replace(
        build_reference(evidence_index),
        document_version_id=42,
    )
    finding = build_finding(
        evidence_index,
        evidence_references=(reference,),
    )

    with pytest.raises(
        contract_analysis_evidence
        .ContractAnalysisEvidenceDocumentMismatchError
    ):
        build_machine_draft(
            evidence_index,
            findings=(finding,),
        )


def test_rejects_modified_quote() -> None:
    evidence_index = build_evidence_index()
    reference = replace(
        build_reference(
            evidence_index,
            block_ordinal=4,
            quote="30 дней",
        ),
        quote="10 дней",
    )
    finding = build_finding(
        evidence_index,
        evidence_references=(reference,),
    )

    with pytest.raises(
        contract_analysis_evidence
        .ContractAnalysisEvidenceQuoteMismatchError
    ):
        build_machine_draft(
            evidence_index,
            findings=(finding,),
        )


def test_rejects_tampered_evidence_index() -> None:
    evidence_index = build_evidence_index()
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
        build_machine_draft(
            tampered_index,
            findings=(
                build_finding(evidence_index),
            ),
        )


def test_rejects_duplicate_finding_with_other_evidence(
) -> None:
    evidence_index = build_evidence_index()
    first_finding = build_finding(
        evidence_index
    )
    duplicate_finding = replace(
        first_finding,
        evidence_references=(
            build_reference(
                evidence_index,
                block_ordinal=3,
            ),
        ),
    )

    with pytest.raises(
        contract_analysis_findings
        .DuplicateContractAnalysisFindingError
    ):
        build_machine_draft(
            evidence_index,
            findings=(
                first_finding,
                duplicate_finding,
            ),
        )


@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("policy_id", ""),
        ("policy_version", " version"),
        ("allowed_categories", ()),
        (
            "allowed_categories",
            ("delivery", "delivery"),
        ),
        ("allowed_categories", ["delivery"]),
        ("allowed_severity_levels", ("",)),
        (
            "allowed_severity_levels",
            ("medium", "medium"),
        ),
    ],
)
def test_rejects_invalid_policy(
    field_name: str,
    invalid_value: object,
) -> None:
    evidence_index = build_evidence_index()
    policy = replace(
        build_policy(),
        **{field_name: invalid_value},
    )

    with pytest.raises(
        contract_analysis_findings
        .InvalidContractAnalysisFindingsPolicyError
    ):
        build_machine_draft(
            evidence_index,
            policy=policy,
        )


def test_rejects_non_policy_object() -> None:
    evidence_index = build_evidence_index()

    with pytest.raises(
        contract_analysis_findings
        .InvalidContractAnalysisFindingsPolicyError
    ):
        (
            contract_analysis_findings
            .build_contract_analysis_findings_machine_draft(
                evidence_index,
                policy="not-a-policy",
                findings=(
                    build_finding(evidence_index),
                ),
            )
        )
