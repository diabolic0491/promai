import re
from dataclasses import replace
from decimal import Decimal

from app.services import contract_analysis_findings

ABSENCE_CLAIM_PATTERNS = (
    r"\bотсутств\w*",
    (
        r"\bне\s+(?:указан|прописан|определен"
        r"|предусмотрен"
        r"|регламентирован|установлен|содержит)\w*"
    ),
    r"\bнеуказан\w*",
    r"\bнепол\w*",
    r"\bпропущ\w*",
    r"\bнет\s+(?:услов|сведен|данн|поряд|срок|адрес"
    r"|валют|цен|ответствен|гарант|критери)\w*",
)
EXTERNAL_NORMATIVE_CLAIM_PATTERNS = (
    r"\bзаконодательн\w*\s+требован\w*",
    r"\bтребован\w*\s+(?:законодательств\w*|рб)\b",
    (
        r"\bустановлен\w*\s+"
        r"(?:законом|законодательством)\b"
    ),
    r"\bминимальн\w*\s+(?:порог|размер)\w*",
    r"\bне\s+соответств\w*\s+законодательств\w*",
    r"\bнаруш\w*\s+законодательств\w*",
    r"\bнезакон\w*",
)
COMPARISON_CLAIM_PATTERNS = (
    r"\bпротивореч\w*",
    r"\bразлич\w*",
    r"\bрасхожден\w*",
    r"\bнесоответств\w*",
    r"\bсравн\w*",
    r"\b(?:выше|ниже|больше|меньше)\b",
    r"\bрабоч\w*\s+(?:и|против|вместо)\s+календарн\w*",
)
EXPLICIT_CONFLICT_CLAIM_PATTERNS = (
    r"\bпротивореч\w*",
    r"\bнесогласован\w*",
    r"\bнесовместим\w*",
)
SUBJECTIVE_ASSESSMENT_PATTERNS = (
    r"\bстандартн\w*\s+практик\w*",
    r"\bсимметри\w*\s+ответственност\w*",
    r"\b(?:недостаточн|чрезмерн|избыточн)\w*",
    r"\b(?:завышенн|заниженн)\w*",
    r"\bменее\s+точн\w*",
    r"\bдисбаланс\w*",
    (
        r"\bсмешанн\w*\s+"
        r"(?:единиц|тип)\w*\s+"
        r"(?:измерен\w*\s+)?времен\w*"
    ),
    r"\bбез\s+уточнен\w*\s+соотношен\w*",
)
MISSING_START_POINT_CLAIM_PATTERNS = (
    (
        r"\bбез\s+уточнен\w*\s+"
        r"(?:момент\w*\s+)?(?:начала|отсчет)\w*"
    ),
    (
        r"\bне\s+(?:указан|определен|уточнен)\w*\s+"
        r"(?:момент|начал|точк)\w*\s+"
        r"(?:срок\w*\s+|отсчет\w*)"
    ),
)
EXPLICIT_START_POINT_EVIDENCE_PATTERNS = (
    r"\bс\s+момента\b",
    r"\bсо\s+дня\b",
    r"\bначиная\s+с\b",
    (
        r"\bпосле\s+(?:подписан|получен|поставк|"
        r"уведомлен|оплат|передач|приемк)\w*"
    ),
)
PACKAGING_RISK_CLAIM_PATTERNS = (
    r"\bбез\s+(?:тар|упаковк)\w*",
    r"\b(?:тар|упаковк)\w*\s+не\s+требу\w*",
    r"\bдопуска\w*\s+поставк\w*\s+без\b",
)
PACKAGING_ALTERNATIVE_EVIDENCE_PATTERNS = (
    r"\bбез\s+(?:таков|тар|упаковк)\w*",
)
PACKAGING_PROTECTION_EVIDENCE_PATTERNS = (
    r"\bобеспеч\w*\s+(?:его|ее|её|их)?\s*сохранност\w*",
)
FULL_PERFORMANCE_TERM_CLAIM_PATTERNS = (
    (
        r"\bсрок\w*\s+действ\w*.*"
        r"\bдо\s+полн\w*\s+исполнен\w*"
    ),
    (
        r"\bдо\s+полн\w*\s+исполнен\w*.*"
        r"\b(?:неопределен|задерж|фактическ\w*\s+срок)\w*"
    ),
)
FULL_PERFORMANCE_TERM_EVIDENCE_PATTERNS = (
    r"\bдо\s+полн\w*\s+(?:его\s+)?исполнен\w*",
)
INCOMPLETE_COMPARISON_QUOTE_PATTERNS = (
    r"^в\s+течение\b",
    r"^не\s+(?:более|менее|позднее|ранее)\b",
    r"^(?:до|после)\b",
    r"^с\s+момента\b",
)
NUMERIC_VALUE_PATTERN = re.compile(
    r"(?<![\w])\d+(?:[.,]\d+)?"
)
PERCENTAGE_VALUE_PATTERN = re.compile(
    r"(?<![\w])(?P<value>\d+(?:[.,]\d+)?)\s*%"
)
DIRECT_COMPARISON_OPERATOR_PATTERN = re.compile(
    r"\b(?P<operator>выше|больше|ниже|меньше)\b"
)
SEVERITY_PRIORITY = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}
ADVERSE_CLAIM_PATTERNS = (
    r"\bриск\w*",
    r"\bпроблем\w*",
    r"\bнаруш\w*",
    r"\bпротивореч\w*",
    r"\bнесоответств\w*",
    r"\bнеопределен\w*",
    r"\bнеоднознач\w*",
    r"\bдвусмыслен\w*",
    r"\bошиб\w*",
    r"\bневыгод\w*",
    r"\bчрезмер\w*",
    r"\bзавыш\w*",
    r"\bзаниж\w*",
    r"\bогранич\w*",
    r"\bисключ\w*",
    r"\bодносторон\w*",
    r"\bнекоррект\w*",
    r"\bнедостат\w*",
    r"\bнепол\w*",
    r"\bубыт\w*",
    r"\bущерб\w*",
    r"\bзатрудн\w*",
    r"\bусложн\w*",
    r"\bтестов\w*",
    r"\bподдел\w*",
    r"\bдублир\w*",
    r"\bтребу\w*\s+проверк\w*",
    r"\bможет\s+привести\b",
    r"\bсозда(?:е|ё)т\b",
)
COMPARISON_CONSEQUENCE_PATTERNS = (
    r"\bриск\w*",
    r"\bспор\w*",
    r"\bнеопределен\w*",
    r"\bнеоднознач\w*",
    r"\bдвусмыслен\w*",
    r"\bошиб\w*",
    r"\bубыт\w*",
    r"\bущерб\w*",
    r"\bзатрудн\w*",
    r"\bневозможн\w*",
    r"\bможет\s+привести\b",
    r"\bсозда(?:е|ё)т\b",
)
HIGH_SEVERITY_SUPPORT_PATTERNS = (
    r"\bрасторж\w*",
    r"\bодносторон\w*",
    r"\bутрат\w*",
    r"\bлишен\w*",
    r"\bнеогранич\w*",
    r"\bневозможн\w*\s+исполн\w*",
    r"\bзначительн\w*\s+(?:убыт|ущерб)\w*",
    r"\bполн\w*\s+стоимост\w*",
    r"\bблокир\w*",
    r"\bмошенн\w*",
    r"\bподдел\w*",
    r"\bкритическ\w*",
)


def normalize_semantic_text(value: str) -> str:
    return " ".join(
        value.lower().replace("ё", "е").split()
    )


def contains_pattern(
    text: str,
    patterns: tuple[str, ...],
) -> bool:
    return any(
        re.search(pattern, text) is not None
        for pattern in patterns
    )


def build_finding_claim_text(
    draft: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> str:
    return normalize_semantic_text(
        f"{draft.title} {draft.description}"
    )


def build_finding_evidence_text(
    draft: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> str:
    return normalize_semantic_text(
        " ".join(
            reference.quote
            for reference in draft.evidence_references
        )
    )


def has_distinct_evidence_references(
    draft: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
    *,
    minimum: int,
) -> bool:
    reference_keys = {
        (
            reference.block_id,
            reference.start_character,
            reference.end_character,
            reference.quote,
        )
        for reference in draft.evidence_references
    }

    return len(reference_keys) >= minimum


def normalize_numeric_value(value: str) -> str:
    normalized = value.replace(",", ".")

    if "." not in normalized:
        return str(int(normalized))

    return format(
        Decimal(normalized).normalize(),
        "f",
    )


def extract_numeric_values(text: str) -> set[str]:
    return {
        normalize_numeric_value(match.group())
        for match in NUMERIC_VALUE_PATTERN.finditer(
            text
        )
    }


def has_only_evidence_grounded_numbers(
    draft: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> bool:
    claim_values = extract_numeric_values(
        build_finding_claim_text(draft)
    )
    evidence_values = extract_numeric_values(
        build_finding_evidence_text(draft)
    )

    return claim_values.issubset(evidence_values)


def is_claim_refuted_by_explicit_start_point(
    draft: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> bool:
    return (
        contains_pattern(
            build_finding_claim_text(draft),
            MISSING_START_POINT_CLAIM_PATTERNS,
        )
        and contains_pattern(
            build_finding_evidence_text(draft),
            EXPLICIT_START_POINT_EVIDENCE_PATTERNS,
        )
    )


def is_packaging_risk_refuted_by_protection(
    draft: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> bool:
    claim_text = build_finding_claim_text(draft)
    evidence_text = build_finding_evidence_text(
        draft
    )

    return (
        contains_pattern(
            claim_text,
            PACKAGING_RISK_CLAIM_PATTERNS,
        )
        and contains_pattern(
            evidence_text,
            PACKAGING_ALTERNATIVE_EVIDENCE_PATTERNS,
        )
        and contains_pattern(
            evidence_text,
            PACKAGING_PROTECTION_EVIDENCE_PATTERNS,
        )
    )


def is_unsupported_full_performance_term_claim(
    draft: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> bool:
    return (
        contains_pattern(
            build_finding_claim_text(draft),
            FULL_PERFORMANCE_TERM_CLAIM_PATTERNS,
        )
        and contains_pattern(
            build_finding_evidence_text(draft),
            FULL_PERFORMANCE_TERM_EVIDENCE_PATTERNS,
        )
    )


def direct_percentage_comparisons_are_valid(
    text: str,
) -> bool:
    percentage_matches = tuple(
        PERCENTAGE_VALUE_PATTERN.finditer(text)
    )

    for operator_match in (
        DIRECT_COMPARISON_OPERATOR_PATTERN
        .finditer(text)
    ):
        left_candidates = tuple(
            match
            for match in percentage_matches
            if (
                match.end()
                <= operator_match.start()
                and (
                    operator_match.start()
                    - match.end()
                )
                <= 100
            )
        )
        right_candidates = tuple(
            match
            for match in percentage_matches
            if (
                match.start()
                >= operator_match.end()
                and (
                    match.start()
                    - operator_match.end()
                )
                <= 100
            )
        )

        if not left_candidates or not right_candidates:
            continue

        left_value = Decimal(
            left_candidates[-1]
            .group("value")
            .replace(",", ".")
        )
        right_value = Decimal(
            right_candidates[0]
            .group("value")
            .replace(",", ".")
        )
        operator = operator_match.group("operator")

        if (
            operator in {"выше", "больше"}
            and left_value <= right_value
        ):
            return False

        if (
            operator in {"ниже", "меньше"}
            and left_value >= right_value
        ):
            return False

    return True


def is_context_complete_comparison_quote(
    quote: str,
) -> bool:
    normalized_quote = (
        normalize_semantic_text(quote)
        .lstrip("«»\"'()[]{}.,;:—- ")
    )

    return not contains_pattern(
        normalized_quote,
        INCOMPLETE_COMPARISON_QUOTE_PATTERNS,
    )


def has_context_complete_comparison_evidence(
    draft: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> bool:
    return all(
        is_context_complete_comparison_quote(
            reference.quote
        )
        for reference in draft.evidence_references
    )


def build_finding_evidence_signature(
    draft: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> frozenset[tuple[str, int, int, str]]:
    return frozenset(
        (
            reference.block_id,
            reference.start_character,
            reference.end_character,
            reference.quote,
        )
        for reference in draft.evidence_references
    )


def is_comparison_finding(
    draft: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> bool:
    return contains_pattern(
        build_finding_claim_text(draft),
        COMPARISON_CLAIM_PATTERNS,
    )


def build_finding_preference(
    draft: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> tuple[int, int]:
    return (
        SEVERITY_PRIORITY.get(
            draft.severity_level,
            0,
        ),
        int(
            contains_pattern(
                build_finding_claim_text(draft),
                EXPLICIT_CONFLICT_CLAIM_PATTERNS,
            )
        ),
    )


def normalize_semantically_supported_finding(
    draft: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> (
    contract_analysis_findings
    .ContractAnalysisFindingDraft
    | None
):
    claim_text = build_finding_claim_text(draft)

    if contains_pattern(
        claim_text,
        ABSENCE_CLAIM_PATTERNS,
    ):
        return None

    if contains_pattern(
        claim_text,
        EXTERNAL_NORMATIVE_CLAIM_PATTERNS,
    ):
        return None

    if contains_pattern(
        claim_text,
        SUBJECTIVE_ASSESSMENT_PATTERNS,
    ):
        return None

    if not has_only_evidence_grounded_numbers(draft):
        return None

    if not direct_percentage_comparisons_are_valid(
        claim_text
    ):
        return None

    if is_claim_refuted_by_explicit_start_point(
        draft
    ):
        return None

    if is_packaging_risk_refuted_by_protection(
        draft
    ):
        return None

    if is_unsupported_full_performance_term_claim(
        draft
    ):
        return None

    if (
        is_comparison_finding(draft)
        and (
            not has_distinct_evidence_references(
                draft,
                minimum=2,
            )
            or not (
                has_context_complete_comparison_evidence(
                    draft
                )
            )
        )
    ):
        return None

    if (
        is_comparison_finding(draft)
        and not contains_pattern(
            claim_text,
            COMPARISON_CONSEQUENCE_PATTERNS,
        )
    ):
        return None

    if not contains_pattern(
        claim_text,
        ADVERSE_CLAIM_PATTERNS,
    ):
        return None

    combined_text = (
        claim_text
        + " "
        + build_finding_evidence_text(draft)
    )

    if (
        draft.severity_level in {"high", "critical"}
        and not contains_pattern(
            combined_text,
            HIGH_SEVERITY_SUPPORT_PATTERNS,
        )
    ):
        return replace(
            draft,
            severity_level="medium",
        )

    return draft


def is_semantically_supported_finding(
    draft: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> bool:
    return (
        normalize_semantically_supported_finding(
            draft
        )
        is not None
    )


def filter_semantically_supported_findings(
    findings: tuple[
        contract_analysis_findings
        .ContractAnalysisFindingDraft,
        ...,
    ],
) -> tuple[
    contract_analysis_findings
    .ContractAnalysisFindingDraft,
    ...,
]:
    normalized_findings = (
        normalize_semantically_supported_finding(
            finding
        )
        for finding in findings
    )
    supported_findings = tuple(
        finding
        for finding in normalized_findings
        if finding is not None
    )
    deduplicated_findings: list[
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ] = []
    comparison_indexes: dict[
        tuple[
            str,
            frozenset[
                tuple[str, int, int, str]
            ],
        ],
        int,
    ] = {}

    for finding in supported_findings:
        if not is_comparison_finding(finding):
            deduplicated_findings.append(finding)
            continue

        duplicate_key = (
            finding.category,
            build_finding_evidence_signature(finding),
        )
        duplicate_index = comparison_indexes.get(
            duplicate_key
        )

        if duplicate_index is None:
            comparison_indexes[duplicate_key] = len(
                deduplicated_findings
            )
            deduplicated_findings.append(finding)
            continue

        previous = deduplicated_findings[
            duplicate_index
        ]

        if build_finding_preference(
            finding
        ) > build_finding_preference(previous):
            deduplicated_findings[
                duplicate_index
            ] = finding

    return tuple(deduplicated_findings)
