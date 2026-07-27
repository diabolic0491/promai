from app.services import (
    contract_analysis_evidence,
    contract_analysis_findings,
    contract_analysis_semantics,
)


def build_reference(
    *,
    block_number: int,
    quote: str,
) -> (
    contract_analysis_evidence
    .ContractAnalysisEvidenceReference
):
    start_character = block_number * 1_000

    return (
        contract_analysis_evidence
        .ContractAnalysisEvidenceReference(
            contract_id=17,
            document_version_id=41,
            version_number=3,
            source_file_sha256="a" * 64,
            extracted_text_sha256="b" * 64,
            block_id=f"block-{block_number}",
            start_character=start_character,
            end_character=(
                start_character + len(quote)
            ),
            quote=quote,
        )
    )


def build_finding(
    *,
    title: str,
    description: str,
    quotes: tuple[str, ...],
    category: str = "delivery",
    severity_level: str = "medium",
) -> (
    contract_analysis_findings
    .ContractAnalysisFindingDraft
):
    return (
        contract_analysis_findings
        .ContractAnalysisFindingDraft(
            category=category,
            severity_level=severity_level,
            title=title,
            description=description,
            evidence_references=tuple(
                build_reference(
                    block_number=number,
                    quote=quote,
                )
                for number, quote in enumerate(
                    quotes,
                    start=1,
                )
            ),
        )
    )


def test_absence_claim_is_not_semantically_supported(
) -> None:
    finding = build_finding(
        title=(
            "Неуказан конкретный адрес доставки"
        ),
        description=(
            "В условии отсутствует номер дома, "
            "что создаёт риск неопределённости."
        ),
        quotes=(
            (
                "Доставка осуществляется по адресу: "
                "г. Гродно, ул. Тестовая, 1."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is False
    )


def test_external_normative_claim_requires_other_source(
) -> None:
    finding = build_finding(
        title=(
            "Несоответствие размера пени "
            "законодательным требованиям РБ"
        ),
        description=(
            "Размер пени может быть ниже "
            "минимального порога, установленного "
            "законом."
        ),
        quotes=(
            (
                "Пеня составляет 0,15% за каждый "
                "день просрочки."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is False
    )


def test_comparison_requires_two_distinct_references(
) -> None:
    unsupported = build_finding(
        title="Различие в типах дней",
        description=(
            "Рабочие и календарные дни усложняют "
            "расчёт срока."
        ),
        quotes=("Срок составляет 5 рабочих дней.",),
    )
    supported = build_finding(
        title="Противоречие в сроках выполнения",
        description=(
            "Разные сроки создают риск "
            "неопределённости."
        ),
        quotes=(
            "Срок составляет 5 рабочих дней.",
            "Срок составляет 10 календарных дней.",
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            unsupported
        )
        is False
    )
    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            supported
        )
        is True
    )


def test_correct_neutral_clause_is_not_a_finding(
) -> None:
    finding = build_finding(
        title="Определение суда первой инстанции",
        description=(
            "Договором прямо указано, что споры "
            "разрешаются в Экономическом суде."
        ),
        quotes=(
            (
                "Споры подлежат разрешению в "
                "Экономическом суде."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is False
    )


def test_concrete_risk_with_evidence_is_preserved(
) -> None:
    finding = build_finding(
        title="Тестовые банковские реквизиты",
        description=(
            "Тестовый счёт создаёт риск оплаты "
            "по некорректным реквизитам."
        ),
        quotes=(
            "р/с BY00TEST00000000000000000000",
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is True
    )


def test_number_missing_from_evidence_is_rejected(
) -> None:
    finding = build_finding(
        title="Различие в ставках пеней",
        description=(
            "Ставка 1% рефинансирования выше "
            "ставки 0,15%, что создаёт риск "
            "неверного расчёта."
        ),
        quotes=(
            (
                "Покупатель уплачивает пеню в "
                "размере однодневной ставки "
                "рефинансирования НБРБ."
            ),
            (
                "Поставщик уплачивает пеню в "
                "размере 0,15% от стоимости "
                "товара."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is False
    )


def test_invalid_percentage_comparison_is_rejected(
) -> None:
    finding = build_finding(
        title="Неверное сравнение ставок пени",
        description=(
            "Ставка 0,10% выше ставки 0,15%, "
            "что создаёт риск спора."
        ),
        quotes=(
            "Пеня Покупателя составляет 0,10%.",
            "Пеня Поставщика составляет 0,15%.",
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is False
    )


def test_calendar_days_precision_claim_is_rejected(
) -> None:
    finding = build_finding(
        title=(
            "Календарные дни менее точны "
            "для логистики"
        ),
        description=(
            "Срок 30 календарных дней может "
            "создать риск недопонимания."
        ),
        quotes=(
            (
                "Товар поставляется в течение "
                "30 календарных дней с момента "
                "подписания Договора."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is False
    )


def test_subjective_force_majeure_period_is_rejected(
) -> None:
    finding = build_finding(
        title=(
            "Недостаточный срок уведомления "
            "о форс-мажоре"
        ),
        description=(
            "Срок 5 календарных дней может быть "
            "недостаточным для принятия мер."
        ),
        quotes=(
            (
                "Сторона обязана не позднее "
                "5 календарных дней известить "
                "противоположную сторону."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is False
    )


def test_comparison_requires_complete_clause_quotes(
) -> None:
    finding = build_finding(
        title="Противоречие в сроках работ",
        description=(
            "Для выполнения работ указаны сроки "
            "5 рабочих и 10 календарных дней, "
            "что создаёт риск спора."
        ),
        quotes=(
            (
                "в течение 5 рабочих дней после "
                "получения уведомления о "
                "готовности к выполнению работ."
            ),
            (
                "не более 10 календарных дней "
                "после получения уведомления о "
                "готовности к выполнению работ."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is False
    )


def test_complete_contradictory_clauses_are_preserved(
) -> None:
    finding = build_finding(
        title="Противоречие в сроках работ",
        description=(
            "Для выполнения работ указаны сроки "
            "5 рабочих и 10 календарных дней, "
            "что создаёт риск спора."
        ),
        quotes=(
            (
                "Поставщик выполняет монтажные "
                "работы в течение 5 рабочих дней."
            ),
            (
                "Поставщик выполняет монтажные "
                "работы в течение 10 календарных "
                "дней."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is True
    )


def test_duplicate_comparisons_keep_highest_severity(
) -> None:
    quotes = (
        (
            "Поставщик выполняет монтажные работы "
            "в течение 5 рабочих дней."
        ),
        (
            "Поставщик выполняет монтажные работы "
            "в течение 10 календарных дней."
        ),
    )
    duplicate = build_finding(
        title="Различие в типах дней",
        description=(
            "Рабочие и календарные дни создают "
            "риск спора."
        ),
        quotes=quotes,
    )
    preferred = (
        contract_analysis_findings
        .ContractAnalysisFindingDraft(
            category=duplicate.category,
            severity_level="high",
            title="Противоречие в сроках работ",
            description=(
                "Для одной обязанности указаны "
                "сроки 5 рабочих и 10 календарных "
                "дней, что создаёт риск спора."
            ),
            evidence_references=(
                duplicate.evidence_references
            ),
        )
    )

    result = (
        contract_analysis_semantics
        .filter_semantically_supported_findings(
            (duplicate, preferred)
        )
    )

    assert len(result) == 1
    assert result[0].title == preferred.title
    assert result[0].severity_level == "medium"


def test_filter_preserves_only_supported_findings(
) -> None:
    neutral = build_finding(
        title="Указан срок оплаты",
        description=(
            "Оплата производится в течение "
            "10 банковских дней."
        ),
        quotes=(
            "Оплата в течение 10 банковских дней.",
        ),
    )
    risk = build_finding(
        title="Тестовые банковские реквизиты",
        description=(
            "Тестовый счёт создаёт риск оплаты "
            "по некорректным реквизитам."
        ),
        quotes=(
            "р/с BY00TEST00000000000000000000",
        ),
    )

    assert (
        contract_analysis_semantics
        .filter_semantically_supported_findings(
            (neutral, risk)
        )
        == (risk,)
    )


def test_protective_packaging_qualification_refutes_risk(
) -> None:
    finding = build_finding(
        title=(
            "Неопределенность условий упаковки "
            "товара"
        ),
        description=(
            "Условие допускает поставку без тары, "
            "что может создать риски при "
            "транспортировке и хранении."
        ),
        quotes=(
            (
                "Товар должен быть упакован в тару "
                "(упаковку), соответствующую "
                "действующим стандартам (ТУ) или "
                "без таковой, обеспечивающую его "
                "сохранность при транспортировке "
                "и хранении."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is False
    )


def test_neutral_formula_difference_is_not_a_risk(
) -> None:
    finding = build_finding(
        category="liability",
        title=(
            "Различие в формуле расчета пеней для "
            "Поставщика и Покупателя"
        ),
        description=(
            "Пени за просрочку оплаты "
            "рассчитываются по ставке "
            "рефинансирования, тогда как пени за "
            "просрочку поставки — фиксированный "
            "процент от стоимости."
        ),
        quotes=(
            (
                "За несвоевременную оплату "
                "Покупатель уплачивает пеню в "
                "размере однодневной ставки "
                "рефинансирования НБРБ."
            ),
            (
                "За несвоевременную поставку "
                "Поставщик уплачивает пеню в "
                "размере 0,15% от стоимости "
                "товара."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is False
    )


def test_analysis_68_penalty_difference_is_not_a_risk(
) -> None:
    finding = build_finding(
        category="liability",
        title=(
            "Несоответствие формул расчета пеней "
            "для разных сторон"
        ),
        description=(
            "Различаются коэффициенты и базы "
            "расчета пени: за просрочку оплаты "
            "применяется ставка рефинансирования "
            "НБРБ, а за просрочку поставки — "
            "фиксированный процент от стоимости "
            "товара."
        ),
        quotes=(
            (
                "Покупатель уплачивает Поставщику "
                "пеню в размере однодневной ставки "
                "рефинансирования НБРБ."
            ),
            (
                "Поставщик уплачивает Покупателю "
                "пеню в размере 0,15% от стоимости "
                "товара."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is False
    )


def test_explicit_start_point_refutes_missing_start_claim(
) -> None:
    finding = build_finding(
        title=(
            "Срок поставки указан как "
            "«30 календарных дней» без уточнения "
            "момента начала отсчета"
        ),
        description=(
            "Несмотря на указание даты подписания "
            "договора, формулировка не исключает "
            "двоякого толкования относительно "
            "точного времени старта срока."
        ),
        quotes=(
            (
                "Товар поставляется в течение "
                "30 календарных дней с момента "
                "подписания настоящего Договора."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is False
    )


def test_unsupported_full_performance_term_is_rejected(
) -> None:
    finding = build_finding(
        category="subject",
        title=(
            "Срок действия договора привязан "
            "исключительно к моменту подписания "
            "и исполнения, без учета фактических "
            "сроков выполнения"
        ),
        description=(
            "Условие о сроке действия от момента "
            "подписания до полного исполнения "
            "может создать неопределенность в "
            "случае задержек."
        ),
        quotes=(
            (
                "Срок действия настоящего "
                "Договора – с момента его "
                "подписания и до полного его "
                "исполнения."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .is_semantically_supported_finding(
            finding
        )
        is False
    )


def test_unsubstantiated_high_severity_is_downgraded(
) -> None:
    finding = build_finding(
        severity_level="high",
        title=(
            "Противоречие в сроках выполнения "
            "работ"
        ),
        description=(
            "Для одного события указаны 5 рабочих "
            "и 10 календарных дней, что создаёт "
            "правовую неопределенность."
        ),
        quotes=(
            (
                "Поставщик выполняет работы в "
                "течение 5 рабочих дней после "
                "получения уведомления."
            ),
            (
                "Поставщик выполняет работы не "
                "более 10 календарных дней после "
                "получения уведомления."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .filter_semantically_supported_findings(
            (finding,)
        )[0].severity_level
        == "medium"
    )


def test_high_severity_with_explicit_impact_is_preserved(
) -> None:
    finding = build_finding(
        category="liability",
        severity_level="high",
        title=(
            "Одностороннее расторжение договора"
        ),
        description=(
            "Условие создаёт риск одностороннего "
            "расторжения договора Поставщиком."
        ),
        quotes=(
            (
                "Поставщик вправе в одностороннем "
                "порядке расторгнуть Договор."
            ),
        ),
    )

    assert (
        contract_analysis_semantics
        .filter_semantically_supported_findings(
            (finding,)
        )
        == (finding,)
    )


def test_analysis_55_regression_keeps_only_deadline_conflict(
) -> None:
    findings = (
        build_finding(
            title=(
                "Неопределенность условий упаковки "
                "товара"
            ),
            description=(
                "Условие допускает поставку без "
                "тары, что может создать риски при "
                "транспортировке и хранении."
            ),
            quotes=(
                (
                    "Товар должен быть упакован в "
                    "тару или без таковой, "
                    "обеспечивающую его сохранность "
                    "при транспортировке."
                ),
            ),
        ),
        build_finding(
            category="liability",
            title=(
                "Различие в формуле расчета пеней"
            ),
            description=(
                "Пени Покупателя рассчитываются "
                "по ставке рефинансирования, тогда "
                "как пени Поставщика — 0,15%."
            ),
            quotes=(
                (
                    "Покупатель уплачивает пеню в "
                    "размере однодневной ставки "
                    "рефинансирования НБРБ."
                ),
                (
                    "Поставщик уплачивает пеню в "
                    "размере 0,15%."
                ),
            ),
        ),
        build_finding(
            title=(
                "Срок поставки без уточнения "
                "момента начала отсчета"
            ),
            description=(
                "Формулировка создаёт "
                "неопределенность начала срока."
            ),
            quotes=(
                (
                    "Товар поставляется в течение "
                    "30 календарных дней с момента "
                    "подписания Договора."
                ),
            ),
        ),
        build_finding(
            severity_level="high",
            title=(
                "Противоречие в сроках выполнения "
                "работ"
            ),
            description=(
                "Для одних работ установлены "
                "5 рабочих и 10 календарных дней, "
                "что создаёт неопределенность."
            ),
            quotes=(
                (
                    "Поставщик выполняет работы в "
                    "течение 5 рабочих дней."
                ),
                (
                    "Поставщик выполняет работы не "
                    "более 10 календарных дней."
                ),
            ),
        ),
        build_finding(
            category="subject",
            title=(
                "Срок действия до полного "
                "исполнения не учитывает "
                "фактические сроки"
            ),
            description=(
                "Срок действия до полного "
                "исполнения создаёт "
                "неопределенность при задержках."
            ),
            quotes=(
                (
                    "Договор действует с момента "
                    "подписания до полного его "
                    "исполнения."
                ),
            ),
        ),
    )

    result = (
        contract_analysis_semantics
        .filter_semantically_supported_findings(
            findings
        )
    )

    assert len(result) == 1
    assert result[0].title == (
        "Противоречие в сроках выполнения работ"
    )
    assert result[0].severity_level == "medium"
