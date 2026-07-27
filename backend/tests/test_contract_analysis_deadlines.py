from hashlib import sha256

from app.services import (
    contract_analysis_deadlines,
    contract_analysis_evidence,
    contract_analysis_findings,
    contract_analysis_input,
    contract_analysis_semantics,
)

FIRST_DEADLINE_CLAUSE = (
    "Поставщик обязуется выполнить "
    "предусмотренные настоящим Договором работы "
    "после поставки товара в течение 5 рабочих "
    "дней после получения от Покупателя "
    "письменного уведомления о готовности к "
    "выполнению работ."
)
SECOND_DEADLINE_CLAUSE = (
    "Срок выполнения предусмотренных настоящим "
    "Договором работ после поставки товара — "
    "не более 10 календарных дней после "
    "получения от Покупателя письменного "
    "уведомления о готовности к выполнению работ."
)


def build_evidence_index(
    blocks: tuple[str, ...],
) -> (
    contract_analysis_evidence
    .ContractAnalysisEvidenceIndex
):
    text = "\n\n".join(blocks)
    analysis_input = (
        contract_analysis_input
        .ContractAnalysisInput(
            contract_id=187,
            document_version_id=46,
            version_number=2,
            file_name="Договор.docx",
            source="uploaded",
            source_file_sha256="a" * 64,
            extracted_text_sha256=sha256(
                text.encode("utf-8")
            ).hexdigest(),
            source_file_size_bytes=1_024,
            extracted_text_characters=len(text),
            extracted_text_size_bytes=len(
                text.encode("utf-8")
            ),
            text=text,
        )
    )
    return (
        contract_analysis_evidence
        .build_contract_analysis_evidence_index(
            analysis_input
        )
    )


def build_policy() -> (
    contract_analysis_findings
    .ContractAnalysisFindingsPolicy
):
    return (
        contract_analysis_findings
        .ContractAnalysisFindingsPolicy(
            policy_id=(
                "promai-contract-analysis-rb"
            ),
            policy_version="1.0.0",
            allowed_categories=(
                "subject",
                "payment",
                "delivery",
                "liability",
            ),
            allowed_severity_levels=(
                "low",
                "medium",
                "high",
                "critical",
            ),
        )
    )


def build_full_reference(
    *,
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    block_number: int,
) -> (
    contract_analysis_evidence
    .ContractAnalysisEvidenceReference
):
    block = evidence_index.blocks[
        block_number - 1
    ]
    return (
        contract_analysis_deadlines
        .build_full_block_reference(
            evidence_index=evidence_index,
            block=block,
        )
    )


def test_builds_conflict_from_matching_deadline_clauses(
) -> None:
    evidence_index = build_evidence_index(
        (
            FIRST_DEADLINE_CLAUSE,
            SECOND_DEADLINE_CLAUSE,
        )
    )

    findings = (
        contract_analysis_deadlines
        .build_deterministic_deadline_findings(
            evidence_index=evidence_index,
            policy=build_policy(),
        )
    )

    assert len(findings) == 1
    finding = findings[0]
    assert finding.category == "delivery"
    assert finding.severity_level == "medium"
    assert finding.title == (
        "Несогласованность сроков выполнения работ"
    )
    assert (
        "5 рабочих дней и 10 календарных дней"
        in finding.description
    )
    assert tuple(
        reference.quote
        for reference in finding.evidence_references
    ) == (
        FIRST_DEADLINE_CLAUSE,
        SECOND_DEADLINE_CLAUSE,
    )

    machine_draft = (
        contract_analysis_findings
        .build_contract_analysis_findings_machine_draft(
            evidence_index,
            policy=build_policy(),
            findings=findings,
        )
    )
    assert len(machine_draft.findings) == 1


def test_different_obligations_are_not_compared(
) -> None:
    evidence_index = build_evidence_index(
        (
            (
                "Поставщик поставляет товар в "
                "течение 5 рабочих дней после "
                "получения письменного уведомления."
            ),
            (
                "Поставщик выполняет работы не "
                "более 10 календарных дней после "
                "получения письменного уведомления."
            ),
        )
    )

    assert (
        contract_analysis_deadlines
        .build_deterministic_deadline_findings(
            evidence_index=evidence_index,
            policy=build_policy(),
        )
        == ()
    )


def test_identical_deadlines_are_not_a_conflict(
) -> None:
    evidence_index = build_evidence_index(
        (
            (
                "Поставщик выполняет работы в "
                "течение 5 рабочих дней после "
                "получения уведомления."
            ),
            (
                "Срок выполнения работ — не более "
                "5 рабочих дней после получения "
                "уведомления."
            ),
        )
    )

    assert (
        contract_analysis_deadlines
        .build_deterministic_deadline_findings(
            evidence_index=evidence_index,
            policy=build_policy(),
        )
        == ()
    )


def test_deterministic_finding_replaces_model_duplicate(
) -> None:
    evidence_index = build_evidence_index(
        (
            FIRST_DEADLINE_CLAUSE,
            SECOND_DEADLINE_CLAUSE,
        )
    )
    deterministic = (
        contract_analysis_deadlines
        .build_deterministic_deadline_findings(
            evidence_index=evidence_index,
            policy=build_policy(),
        )
    )
    model_duplicate = (
        contract_analysis_findings
        .ContractAnalysisFindingDraft(
            category="delivery",
            severity_level="high",
            title="Противоречие в сроках",
            description=(
                "Указаны разные сроки, что создаёт "
                "риск спора."
            ),
            evidence_references=(
                deterministic[0]
                .evidence_references
            ),
        )
    )
    unrelated_model_finding = (
        contract_analysis_findings
        .ContractAnalysisFindingDraft(
            category="delivery",
            severity_level="medium",
            title="Некорректное описание товара",
            description=(
                "Описание создаёт риск поставки "
                "другого товара."
            ),
            evidence_references=(
                deterministic[0]
                .evidence_references
            ),
        )
    )

    result = (
        contract_analysis_deadlines
        .merge_deadline_findings(
            model_findings=(
                model_duplicate,
                unrelated_model_finding,
            ),
            deterministic_findings=deterministic,
        )
    )

    assert result == (
        unrelated_model_finding,
        *deterministic,
    )
    assert result[1].severity_level == "medium"


def test_analysis_68_regression_uses_hybrid_result(
) -> None:
    evidence_index = build_evidence_index(
        (
            (
                "Покупатель уплачивает Поставщику "
                "пеню в размере однодневной ставки "
                "рефинансирования НБРБ от "
                "неоплаченной суммы за каждый день "
                "просрочки платежа."
            ),
            (
                "Поставщик уплачивает Покупателю "
                "пеню в размере 0,15% от стоимости "
                "не поставленного в срок товара за "
                "каждый день просрочки."
            ),
            FIRST_DEADLINE_CLAUSE,
            SECOND_DEADLINE_CLAUSE,
        )
    )
    penalty_difference = (
        contract_analysis_findings
        .ContractAnalysisFindingDraft(
            category="liability",
            severity_level="medium",
            title=(
                "Несоответствие формул расчета "
                "пеней для разных сторон"
            ),
            description=(
                "Различаются коэффициенты и базы "
                "расчета пени: за просрочку оплаты "
                "применяется ставка "
                "рефинансирования НБРБ, а за "
                "просрочку поставки — фиксированный "
                "процент от стоимости товара."
            ),
            evidence_references=(
                build_full_reference(
                    evidence_index=evidence_index,
                    block_number=1,
                ),
                build_full_reference(
                    evidence_index=evidence_index,
                    block_number=2,
                ),
            ),
        )
    )

    supported_model_findings = (
        contract_analysis_semantics
        .filter_semantically_supported_findings(
            (penalty_difference,)
        )
    )
    deterministic_findings = (
        contract_analysis_deadlines
        .build_deterministic_deadline_findings(
            evidence_index=evidence_index,
            policy=build_policy(),
        )
    )
    result = (
        contract_analysis_deadlines
        .merge_deadline_findings(
            model_findings=(
                supported_model_findings
            ),
            deterministic_findings=(
                deterministic_findings
            ),
        )
    )

    assert supported_model_findings == ()
    assert len(result) == 1
    assert result[0].title == (
        "Несогласованность сроков выполнения работ"
    )
