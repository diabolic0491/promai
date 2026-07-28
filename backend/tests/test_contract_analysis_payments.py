from hashlib import sha256

from app.services import (
    contract_analysis_evidence,
    contract_analysis_findings,
    contract_analysis_input,
    contract_analysis_payments,
)

BUYER_PENALTY_RATE_010 = (
    "За просрочку оплаты Покупатель уплачивает "
    "Поставщику пеню в размере 0,10% от "
    "неоплаченной суммы за каждый день просрочки "
    "платежа."
)
BUYER_PENALTY_RATE_015 = (
    "При нарушении срока оплаты Покупатель "
    "уплачивает Поставщику пеню в размере 0,15% "
    "от неоплаченной суммы за каждый день "
    "просрочки платежа."
)
SUPPLIER_DELIVERY_PENALTY = (
    "Поставщик уплачивает Покупателю пеню в "
    "размере 0,15% от стоимости не поставленного "
    "в срок товара за каждый день просрочки "
    "поставки."
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
    return (
        contract_analysis_payments
        .build_full_block_reference(
            evidence_index=evidence_index,
            block=evidence_index.blocks[
                block_number - 1
            ],
        )
    )


def test_conflicting_penalty_rates_are_reported(
) -> None:
    evidence_index = build_evidence_index(
        (
            BUYER_PENALTY_RATE_010,
            BUYER_PENALTY_RATE_015,
        )
    )

    findings = (
        contract_analysis_payments
        .build_deterministic_payment_penalty_findings(
            evidence_index=evidence_index,
            policy=build_policy(),
        )
    )

    assert len(findings) == 1
    finding = findings[0]
    assert finding.category == "liability"
    assert finding.severity_level == "medium"
    assert finding.title == (
        "Несогласованность формулы расчёта пени"
    )
    assert (
        "ставки 0,1% и 0,15%"
        in finding.description
    )
    assert tuple(
        reference.quote
        for reference in finding.evidence_references
    ) == (
        BUYER_PENALTY_RATE_010,
        BUYER_PENALTY_RATE_015,
    )


def test_conflicting_penalty_bases_are_reported(
) -> None:
    evidence_index = build_evidence_index(
        (
            BUYER_PENALTY_RATE_015,
            (
                "За просрочку платежа Покупатель "
                "уплачивает Поставщику пеню в "
                "размере 0,15% от стоимости "
                "договора за каждый день просрочки "
                "платежа."
            ),
        )
    )

    findings = (
        contract_analysis_payments
        .build_deterministic_payment_penalty_findings(
            evidence_index=evidence_index,
            policy=build_policy(),
        )
    )

    assert len(findings) == 1
    assert (
        "базы расчёта «неоплаченная сумма» и "
        "«стоимость договора»"
        in findings[0].description
    )


def test_identical_penalty_formulas_are_not_a_conflict(
) -> None:
    evidence_index = build_evidence_index(
        (
            BUYER_PENALTY_RATE_015,
            (
                "За просрочку платежа Покупатель "
                "уплачивает Поставщику пеню в "
                "размере 0,15% от неоплаченной "
                "суммы за каждый день просрочки "
                "платежа."
            ),
        )
    )

    assert (
        contract_analysis_payments
        .build_deterministic_payment_penalty_findings(
            evidence_index=evidence_index,
            policy=build_policy(),
        )
        == ()
    )


def test_different_parties_are_not_compared(
) -> None:
    evidence_index = build_evidence_index(
        (
            BUYER_PENALTY_RATE_015,
            (
                "За просрочку оплаты Поставщик "
                "уплачивает Покупателю пеню в "
                "размере 0,20% от неоплаченной "
                "суммы за каждый день просрочки "
                "платежа."
            ),
        )
    )

    assert (
        contract_analysis_payments
        .find_penalty_conflicts(evidence_index)
        == ()
    )


def test_different_breaches_are_not_compared(
) -> None:
    evidence_index = build_evidence_index(
        (
            BUYER_PENALTY_RATE_015,
            (
                "За просрочку поставки Покупатель "
                "уплачивает Поставщику пеню в "
                "размере 0,20% от стоимости не "
                "поставленного товара за каждый "
                "день просрочки поставки."
            ),
        )
    )

    assert (
        contract_analysis_payments
        .find_penalty_conflicts(evidence_index)
        == ()
    )


def test_payment_schedule_above_one_hundred_is_reported(
) -> None:
    clause = (
        "Оплата производится поэтапно: аванс "
        "составляет 30% стоимости товара, "
        "оставшиеся 80% оплачиваются после "
        "поставки товара."
    )
    evidence_index = build_evidence_index((clause,))

    findings = (
        contract_analysis_payments
        .build_deterministic_payment_penalty_findings(
            evidence_index=evidence_index,
            policy=build_policy(),
        )
    )

    assert len(findings) == 1
    finding = findings[0]
    assert finding.category == "payment"
    assert finding.severity_level == "medium"
    assert finding.title == (
        "Несогласованность долей оплаты"
    )
    assert (
        "30% и 80%; их сумма составляет 110%"
        in finding.description
    )
    assert finding.evidence_references[0].quote == (
        clause
    )


def test_payment_schedule_in_adjacent_blocks_is_reported(
) -> None:
    clauses = (
        (
            "4.1. Покупатель уплачивает 30% "
            "стоимости товара в течение 3 "
            "банковских дней после подписания "
            "настоящего Договора."
        ),
        (
            "4.2. Покупатель уплачивает оставшиеся "
            "80% стоимости товара в течение 5 "
            "банковских дней после поставки товара."
        ),
    )
    evidence_index = build_evidence_index(clauses)

    findings = (
        contract_analysis_payments
        .build_deterministic_payment_penalty_findings(
            evidence_index=evidence_index,
            policy=build_policy(),
        )
    )

    assert len(findings) == 1
    finding = findings[0]
    assert finding.title == (
        "Несогласованность долей оплаты"
    )
    assert (
        "30% и 80%; их сумма составляет 110%"
        in finding.description
    )
    assert tuple(
        reference.quote
        for reference in finding.evidence_references
    ) == clauses


def test_payment_schedule_equal_to_one_hundred_is_valid(
) -> None:
    evidence_index = build_evidence_index(
        (
            (
                "Предоплата составляет 30% "
                "стоимости товара, оставшиеся 70% "
                "оплачиваются после поставки."
            ),
        )
    )

    assert (
        contract_analysis_payments
        .find_payment_schedule_issues(
            evidence_index
        )
        == ()
    )


def test_adjacent_payment_schedule_equal_to_one_hundred_is_valid(
) -> None:
    evidence_index = build_evidence_index(
        (
            (
                "4.1. Покупатель уплачивает 30% "
                "стоимости товара после подписания "
                "Договора."
            ),
            (
                "4.2. Покупатель уплачивает "
                "оставшиеся 70% стоимости товара "
                "после поставки."
            ),
        )
    )

    assert (
        contract_analysis_payments
        .find_payment_schedule_issues(
            evidence_index
        )
        == ()
    )


def test_alternative_payment_options_are_not_summed(
) -> None:
    evidence_index = build_evidence_index(
        (
            (
                "По выбору Покупателя применяется "
                "предоплата 100% либо аванс 30% и "
                "оставшиеся 70% после поставки."
            ),
        )
    )

    assert (
        contract_analysis_payments
        .find_payment_schedule_issues(
            evidence_index
        )
        == ()
    )


def test_non_adjacent_payment_stages_are_not_summed(
) -> None:
    evidence_index = build_evidence_index(
        (
            (
                "Покупатель уплачивает 30% "
                "стоимости товара после подписания "
                "Договора."
            ),
            (
                "Поставщик передаёт товар по "
                "товарной накладной."
            ),
            (
                "Покупатель уплачивает оставшиеся "
                "80% стоимости товара после "
                "поставки."
            ),
        )
    )

    assert (
        contract_analysis_payments
        .find_payment_schedule_issues(
            evidence_index
        )
        == ()
    )


def test_adjacent_part_of_three_stage_schedule_is_not_summed(
) -> None:
    evidence_index = build_evidence_index(
        (
            (
                "Аванс составляет 20% стоимости "
                "товара после подписания Договора."
            ),
            (
                "Покупатель уплачивает 30% "
                "стоимости товара после отгрузки."
            ),
            (
                "Покупатель уплачивает оставшиеся "
                "50% стоимости товара после "
                "приёмки."
            ),
        )
    )

    assert (
        contract_analysis_payments
        .find_payment_schedule_issues(
            evidence_index
        )
        == ()
    )


def test_partial_multistage_schedule_is_not_summed(
) -> None:
    evidence_index = build_evidence_index(
        (
            (
                "Аванс составляет 20%, второй "
                "платёж — 30%, оставшиеся 50% "
                "оплачиваются после приёмки."
            ),
        )
    )

    assert (
        contract_analysis_payments
        .find_payment_schedule_issues(
            evidence_index
        )
        == ()
    )


def test_analysis_68_cross_party_comparison_is_removed(
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
            SUPPLIER_DELIVERY_PENALTY,
        )
    )
    model_finding = (
        contract_analysis_findings
        .ContractAnalysisFindingDraft(
            category="liability",
            severity_level="medium",
            title=(
                "Несоответствие формул расчёта "
                "пеней для разных сторон"
            ),
            description=(
                "Разные формулы создают риск "
                "спора о соразмерности "
                "ответственности."
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

    result = (
        contract_analysis_payments
        .merge_payment_penalty_findings(
            evidence_index=evidence_index,
            model_findings=(model_finding,),
            deterministic_findings=(),
        )
    )

    assert result == ()


def test_deterministic_penalty_finding_replaces_duplicate(
) -> None:
    evidence_index = build_evidence_index(
        (
            BUYER_PENALTY_RATE_010,
            BUYER_PENALTY_RATE_015,
        )
    )
    deterministic = (
        contract_analysis_payments
        .build_deterministic_payment_penalty_findings(
            evidence_index=evidence_index,
            policy=build_policy(),
        )
    )
    model_duplicate = (
        contract_analysis_findings
        .ContractAnalysisFindingDraft(
            category="liability",
            severity_level="high",
            title="Противоречие в ставках пени",
            description=(
                "Разные ставки создают риск спора."
            ),
            evidence_references=(
                deterministic[0]
                .evidence_references
            ),
        )
    )

    result = (
        contract_analysis_payments
        .merge_payment_penalty_findings(
            evidence_index=evidence_index,
            model_findings=(model_duplicate,),
            deterministic_findings=deterministic,
        )
    )

    assert result == deterministic
    assert result[0].severity_level == "medium"
