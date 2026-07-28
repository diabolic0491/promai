import re
from dataclasses import dataclass
from decimal import Decimal
from itertools import combinations

from app.services import (
    contract_analysis_evidence,
    contract_analysis_findings,
)

PERCENTAGE_PATTERN = re.compile(
    r"(?<![\w])(?P<value>\d{1,3}(?:[.,]\d+)?)\s*%",
    re.IGNORECASE,
)
PAYMENT_STAGE_SIGNAL_PATTERN = re.compile(
    (
        r"\b(?:аванс|предоплат|оплат|уплач|платеж|"
        r"платёж|расчет|расчёт|оставш|остаток)\w*"
    ),
    re.IGNORECASE,
)
PAYMENT_ADVANCE_PATTERN = re.compile(
    r"\b(?:аванс|предоплат)\w*",
    re.IGNORECASE,
)
PAYMENT_REMAINDER_PATTERN = re.compile(
    (
        r"\b(?:оставш|остаток)\w*|"
        r"\bокончательн\w*\s+(?:оплат|расчет|расчёт)\w*"
    ),
    re.IGNORECASE,
)
PAYMENT_EXCLUDED_NEAR_PATTERN = re.compile(
    (
        r"\b(?:ндс|налог|скидк|пен|штраф|неустойк|"
        r"комисси)\w*"
    ),
    re.IGNORECASE,
)
PAYMENT_ALTERNATIVE_PATTERN = re.compile(
    r"\b(?:или|либо|по\s+выбору|альтернатив)\w*",
    re.IGNORECASE,
)
SANCTION_PATTERNS = {
    "penalty": re.compile(
        r"\bпен(?:я|и|ю|ей)\b",
        re.IGNORECASE,
    ),
    "fine": re.compile(
        r"\bштраф\w*\b",
        re.IGNORECASE,
    ),
}
RESPONSIBLE_PARTY_PATTERN = re.compile(
    (
        r"\b(?P<party>"
        r"поставщик|покупатель|заказчик|исполнитель|"
        r"подрядчик|продавец|арендатор|арендодатель"
        r")\w*\s+"
        r"(?:(?:обязан|должен)\w*\s+)?"
        r"(?:уплач\w*|уплат\w*|выплач\w*|выплат\w*)"
    ),
    re.IGNORECASE,
)
RESPONSIBLE_PARTY_RECOVERY_PATTERN = re.compile(
    (
        r"\bс\s+(?P<party>"
        r"поставщик|покупатель|заказчик|исполнитель|"
        r"подрядчик|продавец|арендатор|арендодатель"
        r")\w*\s+взыскива\w*"
    ),
    re.IGNORECASE,
)
REFINANCING_RATE_PATTERN = re.compile(
    (
        r"\b(?:одно(?:дневн|дневной)|дневн)\w*\s+"
        r"ставк\w*\s+рефинансирован\w*"
    ),
    re.IGNORECASE,
)
BREACH_PATTERNS = {
    "late_payment": (
        r"\bпросрочк\w*\s+(?:оплат|платеж|платёж)\w*",
        (
            r"\bнесвоевременн\w*\s+"
            r"(?:оплат|платеж|платёж)\w*"
        ),
        r"\bнарушен\w*\s+срок\w*\s+оплат\w*",
    ),
    "late_delivery": (
        r"\bпросрочк\w*\s+поставк\w*",
        r"\bнесвоевременн\w*\s+поставк\w*",
        r"\bнарушен\w*\s+срок\w*\s+поставк\w*",
        (
            r"\bне\s+поставлен\w*\s+"
            r"(?:в\s+установленн\w*\s+)?срок\w*"
        ),
    ),
    "late_work": (
        (
            r"\bпросрочк\w*\s+"
            r"(?:выполнен\w*\s+)?работ\w*"
        ),
        (
            r"\bнарушен\w*\s+срок\w*\s+"
            r"(?:выполнен\w*\s+)?работ\w*"
        ),
        (
            r"\bнесвоевременн\w*\s+"
            r"(?:выполнен\w*\s+)?работ\w*"
        ),
    ),
    "late_return": (
        r"\bпросрочк\w*\s+возврат\w*",
        r"\bнесвоевременн\w*\s+возврат\w*",
        r"\bнарушен\w*\s+срок\w*\s+возврат\w*",
    ),
    "late_documents": (
        (
            r"\bпросрочк\w*\s+"
            r"(?:передач\w*\s+)?документ\w*"
        ),
        (
            r"\bнарушен\w*\s+срок\w*\s+"
            r"(?:передач\w*\s+)?документ\w*"
        ),
    ),
}
BASE_PATTERNS = {
    "unpaid_amount": (
        r"\bнеоплачен\w*\s+сумм\w*",
        r"\bсумм\w*\s+задолженност\w*",
        r"\bпросроченн\w*\s+сумм\w*",
    ),
    "undelivered_goods_value": (
        (
            r"\bстоимост\w*\s+"
            r"(?:не\s+)?поставлен\w*.*товар\w*"
        ),
        (
            r"\bстоимост\w*\s+товар\w*.*"
            r"не\s+поставлен\w*"
        ),
    ),
    "delayed_work_value": (
        (
            r"\bстоимост\w*\s+"
            r"(?:не\s+)?выполнен\w*\s+работ\w*"
        ),
    ),
    "contract_value": (
        r"\bстоимост\w*\s+(?:настоящ\w*\s+)?договор\w*",
        r"\bцен\w*\s+(?:настоящ\w*\s+)?договор\w*",
    ),
    "goods_value": (
        r"\bстоимост\w*\s+товар\w*",
    ),
    "obligation_amount": (
        r"\bсумм\w*\s+(?:неисполненн\w*\s+)?обязательств\w*",
    ),
}
PARTY_CODES = {
    "поставщик": "supplier",
    "покупатель": "buyer",
    "заказчик": "customer",
    "исполнитель": "contractor",
    "подрядчик": "subcontractor",
    "продавец": "seller",
    "арендатор": "tenant",
    "арендодатель": "landlord",
}
PARTY_FORMS = {
    "supplier": "Поставщика",
    "buyer": "Покупателя",
    "customer": "Заказчика",
    "contractor": "Исполнителя",
    "subcontractor": "Подрядчика",
    "seller": "Продавца",
    "tenant": "Арендатора",
    "landlord": "Арендодателя",
}
BREACH_FORMS = {
    "late_payment": "просрочку оплаты",
    "late_delivery": "просрочку поставки",
    "late_work": "просрочку выполнения работ",
    "late_return": "просрочку возврата",
    "late_documents": "просрочку передачи документов",
}
BASE_FORMS = {
    "unpaid_amount": "неоплаченная сумма",
    "undelivered_goods_value": (
        "стоимость не поставленного товара"
    ),
    "delayed_work_value": (
        "стоимость не выполненных работ"
    ),
    "contract_value": "стоимость договора",
    "goods_value": "стоимость товара",
    "obligation_amount": (
        "сумма неисполненного обязательства"
    ),
}
MAX_DETERMINISTIC_PAYMENT_FINDINGS = 8
MAX_DETERMINISTIC_PENALTY_FINDINGS = 8


@dataclass(frozen=True)
class ContractPaymentScheduleIssue:
    blocks: tuple[
        contract_analysis_evidence
        .ContractAnalysisEvidenceBlock,
        ...,
    ]
    percentages: tuple[Decimal, ...]
    total: Decimal


@dataclass(frozen=True)
class ContractPaymentStage:
    block: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceBlock
    )
    value: Decimal
    phase: str | None


@dataclass(frozen=True)
class ContractPenaltyClause:
    block: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceBlock
    )
    sanction_kind: str
    responsible_party: str
    breach_kind: str
    rate_kind: str
    rate_value: Decimal | None
    base_kind: str | None


def normalize_payment_text(value: str) -> str:
    return " ".join(
        value.lower().replace("ё", "е").split()
    )


def normalize_decimal(value: str) -> Decimal:
    return Decimal(value.replace(",", "."))


def format_decimal(value: Decimal) -> str:
    rendered = format(value.normalize(), "f")
    return rendered.replace(".", ",")


def format_percentage(value: Decimal) -> str:
    return f"{format_decimal(value)}%"


def classify_payment_percentage_phase(
    text: str,
    *,
    start: int,
    end: int,
) -> str | None:
    phase_patterns = (
        ("advance", PAYMENT_ADVANCE_PATTERN),
        ("remainder", PAYMENT_REMAINDER_PATTERN),
    )
    preceding: list[tuple[int, str]] = []

    for phase, pattern in phase_patterns:
        preceding.extend(
            (match.end(), phase)
            for match in pattern.finditer(
                text[max(0, start - 80):start]
            )
        )

    if preceding:
        nearest_end, phase = max(preceding)

        if (
            start
            - max(0, start - 80)
            - nearest_end
            <= 60
        ):
            return phase

    following: list[tuple[int, str]] = []
    following_text = text[
        end:min(len(text), end + 80)
    ]

    for phase, pattern in phase_patterns:
        following.extend(
            (match.start(), phase)
            for match in pattern.finditer(
                following_text
            )
        )

    if following:
        nearest_start, phase = min(following)

        if nearest_start <= 60:
            return phase

    return None


def extract_payment_stages(
    block: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceBlock
    ),
) -> tuple[ContractPaymentStage, ...]:
    if block.text.startswith("[TABLE]"):
        return ()

    normalized = normalize_payment_text(block.text)

    if PAYMENT_ALTERNATIVE_PATTERN.search(normalized):
        return ()

    stages: list[ContractPaymentStage] = []

    for match in PERCENTAGE_PATTERN.finditer(
        normalized
    ):
        context = normalized[
            max(0, match.start() - 80):
            min(len(normalized), match.end() + 50)
        ]
        near_context = normalized[
            max(0, match.start() - 30):
            min(len(normalized), match.end() + 25)
        ]

        if (
            PAYMENT_STAGE_SIGNAL_PATTERN.search(
                context
            )
            is None
            or PAYMENT_EXCLUDED_NEAR_PATTERN.search(
                near_context
            )
            is not None
        ):
            continue

        phase = classify_payment_percentage_phase(
            normalized,
            start=match.start(),
            end=match.end(),
        )
        stages.append(
            ContractPaymentStage(
                block=block,
                value=normalize_decimal(
                    match.group("value")
                ),
                phase=phase,
            )
        )

    return tuple(stages)


def extract_payment_stage_percentages(
    block: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceBlock
    ),
) -> tuple[Decimal, ...]:
    stages = extract_payment_stages(block)
    phases = {stage.phase for stage in stages}

    if len(stages) != 2 or phases != {
        "advance",
        "remainder",
    }:
        return ()

    return tuple(stage.value for stage in stages)


def extract_adjacent_payment_schedule(
    blocks: tuple[
        contract_analysis_evidence
        .ContractAnalysisEvidenceBlock,
        ...,
    ],
    *,
    left_index: int,
) -> tuple[
    tuple[
        contract_analysis_evidence
        .ContractAnalysisEvidenceBlock,
        ...,
    ],
    tuple[Decimal, ...],
] | None:
    right_index = left_index + 1

    if right_index >= len(blocks):
        return None

    left = extract_payment_stages(
        blocks[left_index]
    )
    right = extract_payment_stages(
        blocks[right_index]
    )

    if len(left) != 1 or len(right) != 1:
        return None

    if (
        left[0].phase not in {None, "advance"}
        or right[0].phase != "remainder"
    ):
        return None

    neighboring_indices = (
        left_index - 1,
        right_index + 1,
    )

    if any(
        0 <= index < len(blocks)
        and extract_payment_stages(blocks[index])
        for index in neighboring_indices
    ):
        return None

    return (
        (left[0].block, right[0].block),
        (left[0].value, right[0].value),
    )


def find_payment_schedule_issues(
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
) -> tuple[ContractPaymentScheduleIssue, ...]:
    issues: list[ContractPaymentScheduleIssue] = []

    for index, block in enumerate(
        evidence_index.blocks
    ):
        percentages = (
            extract_payment_stage_percentages(block)
        )

        issue_blocks = (block,)

        if not percentages:
            adjacent_schedule = (
                extract_adjacent_payment_schedule(
                    evidence_index.blocks,
                    left_index=index,
                )
            )

            if adjacent_schedule is None:
                continue

            issue_blocks, percentages = (
                adjacent_schedule
            )

        total = sum(percentages, Decimal("0"))

        if total != Decimal("100"):
            issues.append(
                ContractPaymentScheduleIssue(
                    blocks=issue_blocks,
                    percentages=percentages,
                    total=total,
                )
            )

        if (
            len(issues)
            >= MAX_DETERMINISTIC_PAYMENT_FINDINGS
        ):
            break

    return tuple(issues)


def extract_responsible_party(
    text: str,
) -> str | None:
    match = RESPONSIBLE_PARTY_PATTERN.search(text)

    if match is None:
        match = (
            RESPONSIBLE_PARTY_RECOVERY_PATTERN
            .search(text)
        )

    if match is None:
        return None

    return PARTY_CODES[
        normalize_payment_text(match.group("party"))
    ]


def extract_single_signature(
    text: str,
    *,
    patterns: dict[str, tuple[str, ...]],
) -> str | None:
    matches = tuple(
        key
        for key, candidates in patterns.items()
        if any(
            re.search(candidate, text) is not None
            for candidate in candidates
        )
    )

    if len(matches) != 1:
        return None

    return matches[0]


def extract_sanction_kind(
    text: str,
) -> str | None:
    matches = tuple(
        key
        for key, pattern in SANCTION_PATTERNS.items()
        if pattern.search(text) is not None
    )

    if len(matches) != 1:
        return None

    return matches[0]


def extract_penalty_rate(
    text: str,
) -> tuple[str, Decimal | None] | None:
    percentage_matches = tuple(
        PERCENTAGE_PATTERN.finditer(text)
    )
    has_refinancing_rate = (
        REFINANCING_RATE_PATTERN.search(text)
        is not None
    )

    if (
        len(percentage_matches) == 1
        and not has_refinancing_rate
    ):
        return (
            "percentage",
            normalize_decimal(
                percentage_matches[0].group("value")
            ),
        )

    if (
        not percentage_matches
        and has_refinancing_rate
    ):
        return ("refinancing_daily", None)

    return None


def extract_penalty_clause(
    block: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceBlock
    ),
) -> ContractPenaltyClause | None:
    if block.text.startswith("[TABLE]"):
        return None

    normalized = normalize_payment_text(block.text)
    sanction_kind = extract_sanction_kind(
        normalized
    )
    responsible_party = extract_responsible_party(
        normalized
    )
    breach_kind = extract_single_signature(
        normalized,
        patterns=BREACH_PATTERNS,
    )
    rate = extract_penalty_rate(normalized)

    if (
        sanction_kind is None
        or responsible_party is None
        or breach_kind is None
        or rate is None
    ):
        return None

    base_kind = extract_single_signature(
        normalized,
        patterns=BASE_PATTERNS,
    )

    return ContractPenaltyClause(
        block=block,
        sanction_kind=sanction_kind,
        responsible_party=responsible_party,
        breach_kind=breach_kind,
        rate_kind=rate[0],
        rate_value=rate[1],
        base_kind=base_kind,
    )


def extract_penalty_clauses(
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
) -> tuple[ContractPenaltyClause, ...]:
    clauses = (
        extract_penalty_clause(block)
        for block in evidence_index.blocks
    )

    return tuple(
        clause
        for clause in clauses
        if clause is not None
    )


def clauses_describe_same_liability(
    left: ContractPenaltyClause,
    right: ContractPenaltyClause,
) -> bool:
    return (
        left.block.block_id
        != right.block.block_id
        and left.sanction_kind
        == right.sanction_kind
        and left.responsible_party
        == right.responsible_party
        and left.breach_kind == right.breach_kind
    )


def clauses_have_conflicting_formulas(
    left: ContractPenaltyClause,
    right: ContractPenaltyClause,
) -> bool:
    rates_are_different = (
        left.rate_kind != right.rate_kind
        or left.rate_value != right.rate_value
    )
    bases_are_different = (
        left.base_kind is not None
        and right.base_kind is not None
        and left.base_kind != right.base_kind
    )

    return rates_are_different or bases_are_different


def find_penalty_conflicts(
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
) -> tuple[
    tuple[ContractPenaltyClause, ContractPenaltyClause],
    ...,
]:
    clauses = extract_penalty_clauses(evidence_index)
    conflicts: list[
        tuple[
            ContractPenaltyClause,
            ContractPenaltyClause,
        ]
    ] = []
    seen_signatures: set[
        tuple[str, str, str]
    ] = set()

    for left, right in combinations(clauses, 2):
        if not clauses_describe_same_liability(
            left,
            right,
        ):
            continue

        if not clauses_have_conflicting_formulas(
            left,
            right,
        ):
            continue

        signature = (
            left.sanction_kind,
            left.responsible_party,
            left.breach_kind,
        )

        if signature in seen_signatures:
            continue

        seen_signatures.add(signature)
        conflicts.append((left, right))

        if (
            len(conflicts)
            >= MAX_DETERMINISTIC_PENALTY_FINDINGS
        ):
            break

    return tuple(conflicts)


def build_full_block_reference(
    *,
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    block: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceBlock
    ),
) -> (
    contract_analysis_evidence
    .ContractAnalysisEvidenceReference
):
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
                evidence_index
                .extracted_text_sha256
            ),
            block_id=block.block_id,
            start_character=block.start_character,
            end_character=block.end_character,
            quote=block.text,
        )
    )


def build_payment_schedule_finding(
    *,
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    policy: (
        contract_analysis_findings
        .ContractAnalysisFindingsPolicy
    ),
    issue: ContractPaymentScheduleIssue,
) -> (
    contract_analysis_findings
    .ContractAnalysisFindingDraft
    | None
):
    if (
        "payment" not in policy.allowed_categories
        or "medium"
        not in policy.allowed_severity_levels
    ):
        return None

    rendered_percentages = " и ".join(
        format_percentage(value)
        for value in issue.percentages
    )

    return (
        contract_analysis_findings
        .ContractAnalysisFindingDraft(
            category="payment",
            severity_level="medium",
            title=(
                "Несогласованность долей оплаты"
            ),
            description=(
                "В одном графике оплаты указаны "
                f"доли {rendered_percentages}; "
                "их сумма составляет "
                f"{format_percentage(issue.total)}, "
                "а не 100%. Это создаёт риск "
                "неоднозначного определения общей "
                "доли оплаты."
            ),
            evidence_references=tuple(
                build_full_block_reference(
                    evidence_index=evidence_index,
                    block=block,
                )
                for block in issue.blocks
            ),
        )
    )


def format_penalty_rate(
    clause: ContractPenaltyClause,
) -> str:
    if clause.rate_kind == "percentage":
        assert clause.rate_value is not None
        return format_percentage(clause.rate_value)

    return "однодневная ставка рефинансирования"


def build_penalty_conflict_finding(
    *,
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    policy: (
        contract_analysis_findings
        .ContractAnalysisFindingsPolicy
    ),
    left: ContractPenaltyClause,
    right: ContractPenaltyClause,
) -> (
    contract_analysis_findings
    .ContractAnalysisFindingDraft
    | None
):
    if (
        "liability" not in policy.allowed_categories
        or "medium"
        not in policy.allowed_severity_levels
    ):
        return None

    ordered = tuple(
        sorted(
            (left, right),
            key=lambda clause: (
                clause.block.ordinal,
                clause.block.start_character,
            ),
        )
    )
    rate_conflict = (
        ordered[0].rate_kind
        != ordered[1].rate_kind
        or ordered[0].rate_value
        != ordered[1].rate_value
    )
    base_conflict = (
        ordered[0].base_kind is not None
        and ordered[1].base_kind is not None
        and ordered[0].base_kind
        != ordered[1].base_kind
    )
    details: list[str] = []

    if rate_conflict:
        details.append(
            "ставки "
            f"{format_penalty_rate(ordered[0])} и "
            f"{format_penalty_rate(ordered[1])}"
        )

    if base_conflict:
        details.append(
            "базы расчёта "
            f"«{BASE_FORMS[ordered[0].base_kind]}» "
            "и "
            f"«{BASE_FORMS[ordered[1].base_kind]}»"
        )

    sanction = (
        "пени"
        if left.sanction_kind == "penalty"
        else "штрафа"
    )

    return (
        contract_analysis_findings
        .ContractAnalysisFindingDraft(
            category="liability",
            severity_level="medium",
            title=(
                "Несогласованность формулы "
                f"расчёта {sanction}"
            ),
            description=(
                "Для ответственности "
                f"{PARTY_FORMS[left.responsible_party]} "
                f"за {BREACH_FORMS[left.breach_kind]} "
                "установлены разные "
                f"{' и '.join(details)}. "
                "Это создаёт риск неоднозначного "
                f"расчёта {sanction}."
            ),
            evidence_references=tuple(
                build_full_block_reference(
                    evidence_index=evidence_index,
                    block=clause.block,
                )
                for clause in ordered
            ),
        )
    )


def build_deterministic_payment_penalty_findings(
    *,
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    policy: (
        contract_analysis_findings
        .ContractAnalysisFindingsPolicy
    ),
) -> tuple[
    contract_analysis_findings
    .ContractAnalysisFindingDraft,
    ...,
]:
    payment_findings = (
        build_payment_schedule_finding(
            evidence_index=evidence_index,
            policy=policy,
            issue=issue,
        )
        for issue in find_payment_schedule_issues(
            evidence_index
        )
    )
    penalty_findings = (
        build_penalty_conflict_finding(
            evidence_index=evidence_index,
            policy=policy,
            left=left,
            right=right,
        )
        for left, right in find_penalty_conflicts(
            evidence_index
        )
    )
    findings = tuple(
        finding
        for finding in (
            *payment_findings,
            *penalty_findings,
        )
        if finding is not None
    )

    return tuple(
        sorted(
            findings,
            key=lambda finding: min(
                reference.start_character
                for reference
                in finding.evidence_references
            ),
        )
    )


def build_finding_block_ids(
    finding: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> frozenset[str]:
    return frozenset(
        reference.block_id
        for reference in finding.evidence_references
    )


def is_unsupported_cross_obligation_penalty_finding(
    *,
    finding: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
    clauses_by_block_id: dict[
        str,
        ContractPenaltyClause,
    ],
) -> bool:
    block_ids = build_finding_block_ids(finding)

    if len(block_ids) < 2:
        return False

    clauses = tuple(
        clauses_by_block_id[block_id]
        for block_id in block_ids
        if block_id in clauses_by_block_id
    )

    if len(clauses) != len(block_ids):
        return False

    return not any(
        clauses_describe_same_liability(left, right)
        for left, right in combinations(clauses, 2)
    )


def merge_payment_penalty_findings(
    *,
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    model_findings: tuple[
        contract_analysis_findings
        .ContractAnalysisFindingDraft,
        ...,
    ],
    deterministic_findings: tuple[
        contract_analysis_findings
        .ContractAnalysisFindingDraft,
        ...,
    ],
) -> tuple[
    contract_analysis_findings
    .ContractAnalysisFindingDraft,
    ...,
]:
    deterministic_keys = {
        (
            finding.category,
            build_finding_block_ids(finding),
        )
        for finding in deterministic_findings
    }
    clauses_by_block_id = {
        clause.block.block_id: clause
        for clause in extract_penalty_clauses(
            evidence_index
        )
    }
    retained_model_findings = tuple(
        finding
        for finding in model_findings
        if (
            (
                finding.category,
                build_finding_block_ids(finding),
            )
            not in deterministic_keys
            and not (
                is_unsupported_cross_obligation_penalty_finding(
                    finding=finding,
                    clauses_by_block_id=(
                        clauses_by_block_id
                    ),
                )
            )
        )
    )

    return (
        retained_model_findings
        + deterministic_findings
    )
