import re
from dataclasses import dataclass
from itertools import combinations

from app.services import (
    contract_analysis_evidence,
    contract_analysis_findings,
)

DEADLINE_PATTERN = re.compile(
    (
        r"\b(?P<amount>[1-9]\d{0,3})\s+"
        r"(?P<day_kind>"
        r"рабоч\w*|календарн\w*|банковск\w*"
        r")\s+"
        r"(?:день|дня|дней)\b"
    ),
    re.IGNORECASE,
)
DEADLINE_SIGNAL_PATTERN = re.compile(
    (
        r"\b(?:в\s+течение|не\s+более|"
        r"не\s+позднее|срок\w*)\b"
    ),
    re.IGNORECASE,
)
DEADLINE_CLAIM_PATTERN = re.compile(
    r"\b(?:срок\w*|день|дня|дней)\b",
    re.IGNORECASE,
)
START_EVENT_PATTERN = re.compile(
    (
        r"\b(?:после|с\s+момента|со\s+дня|"
        r"с\s+даты|начиная\s+с)\b"
        r"(?P<event>.+)$"
    ),
    re.IGNORECASE,
)
SUPPLIER_PATTERN = re.compile(
    r"\bпоставщик\w*\b",
    re.IGNORECASE,
)
BUYER_PATTERN = re.compile(
    r"\bпокупател\w*\b",
    re.IGNORECASE,
)

ACTION_ROOTS = {
    "acceptance": ("приемк", "приёмк", "принят"),
    "delivery": (
        "достав",
        "передач",
        "поставк",
        "поставлен",
    ),
    "document": ("документ",),
    "goods": ("товар",),
    "notification": ("уведом", "извещ"),
    "payment": ("оплат", "платеж", "платёж"),
    "performance": ("выполн", "исполн"),
    "return": ("возврат", "вернут"),
    "service": ("услуг",),
    "signing": ("подпис",),
    "work": ("работ", "монтаж"),
}
START_EVENT_ROOTS = {
    **ACTION_ROOTS,
    "act": ("акт",),
    "agreement": ("договор",),
    "application": ("заявк",),
    "invoice": ("счет", "счёт"),
    "readiness": ("готовн",),
    "receipt": ("получ",),
}
DAY_KIND_ALIASES = {
    "рабоч": "working",
    "календар": "calendar",
    "банков": "banking",
}
DAY_KIND_FORMS = {
    "working": (
        "рабочий день",
        "рабочих дня",
        "рабочих дней",
    ),
    "calendar": (
        "календарный день",
        "календарных дня",
        "календарных дней",
    ),
    "banking": (
        "банковский день",
        "банковских дня",
        "банковских дней",
    ),
}
MAX_DETERMINISTIC_DEADLINE_FINDINGS = 8


@dataclass(frozen=True)
class ContractDeadlineClause:
    block: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceBlock
    )
    amount: int
    day_kind: str
    action_signature: frozenset[str]
    start_event_signature: frozenset[str]
    responsible_party: str | None


def normalize_deadline_text(value: str) -> str:
    return " ".join(
        value.lower().replace("ё", "е").split()
    )


def extract_root_signature(
    value: str,
    *,
    roots: dict[str, tuple[str, ...]],
) -> frozenset[str]:
    normalized = normalize_deadline_text(value)

    return frozenset(
        canonical
        for canonical, aliases in roots.items()
        if any(
            re.search(
                rf"\b{re.escape(alias)}\w*",
                normalized,
            )
            is not None
            for alias in aliases
        )
    )


def normalize_day_kind(value: str) -> str:
    normalized = normalize_deadline_text(value)

    for prefix, canonical in (
        DAY_KIND_ALIASES.items()
    ):
        if normalized.startswith(prefix):
            return canonical

    raise ValueError("Неизвестный тип дней")


def extract_responsible_party(
    action_text: str,
) -> str | None:
    has_supplier = (
        SUPPLIER_PATTERN.search(action_text)
        is not None
    )
    has_buyer = (
        BUYER_PATTERN.search(action_text)
        is not None
    )

    if has_supplier == has_buyer:
        return None

    return "supplier" if has_supplier else "buyer"


def extract_deadline_clause(
    block: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceBlock
    ),
) -> ContractDeadlineClause | None:
    if block.text.startswith("[TABLE]"):
        return None

    matches = tuple(
        DEADLINE_PATTERN.finditer(block.text)
    )

    if len(matches) != 1:
        return None

    match = matches[0]
    action_text = block.text[:match.start()]
    signal_window = action_text[-120:]

    if (
        DEADLINE_SIGNAL_PATTERN.search(
            signal_window
        )
        is None
    ):
        return None

    start_event_match = START_EVENT_PATTERN.search(
        block.text[match.end():]
    )

    if start_event_match is None:
        return None

    action_signature = extract_root_signature(
        action_text,
        roots=ACTION_ROOTS,
    )
    start_event_signature = extract_root_signature(
        start_event_match.group("event"),
        roots=START_EVENT_ROOTS,
    )

    if (
        not action_signature
        or not start_event_signature
    ):
        return None

    return ContractDeadlineClause(
        block=block,
        amount=int(match.group("amount")),
        day_kind=normalize_day_kind(
            match.group("day_kind")
        ),
        action_signature=action_signature,
        start_event_signature=(
            start_event_signature
        ),
        responsible_party=(
            extract_responsible_party(action_text)
        ),
    )


def extract_deadline_clauses(
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
) -> tuple[ContractDeadlineClause, ...]:
    clauses = (
        extract_deadline_clause(block)
        for block in evidence_index.blocks
    )

    return tuple(
        clause
        for clause in clauses
        if clause is not None
    )


def clauses_describe_same_obligation(
    left: ContractDeadlineClause,
    right: ContractDeadlineClause,
) -> bool:
    parties_are_compatible = (
        left.responsible_party is None
        or right.responsible_party is None
        or (
            left.responsible_party
            == right.responsible_party
        )
    )

    return (
        left.block.block_id
        != right.block.block_id
        and left.action_signature
        == right.action_signature
        and left.start_event_signature
        == right.start_event_signature
        and parties_are_compatible
    )


def clauses_have_different_deadlines(
    left: ContractDeadlineClause,
    right: ContractDeadlineClause,
) -> bool:
    return (
        left.amount != right.amount
        or left.day_kind != right.day_kind
    )


def find_deadline_conflicts(
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
) -> tuple[
    tuple[
        ContractDeadlineClause,
        ContractDeadlineClause,
    ],
    ...,
]:
    clauses = extract_deadline_clauses(
        evidence_index
    )
    conflicts: list[
        tuple[
            ContractDeadlineClause,
            ContractDeadlineClause,
        ]
    ] = []
    seen_signatures: set[
        tuple[
            frozenset[str],
            frozenset[str],
        ]
    ] = set()

    for left, right in combinations(clauses, 2):
        if not clauses_describe_same_obligation(
            left,
            right,
        ):
            continue

        if not clauses_have_different_deadlines(
            left,
            right,
        ):
            continue

        signature = (
            left.action_signature,
            left.start_event_signature,
        )

        if signature in seen_signatures:
            continue

        seen_signatures.add(signature)
        conflicts.append((left, right))

        if (
            len(conflicts)
            >= MAX_DETERMINISTIC_DEADLINE_FINDINGS
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
            start_character=(
                block.start_character
            ),
            end_character=block.end_character,
            quote=block.text,
        )
    )


def plural_form_index(value: int) -> int:
    last_two_digits = value % 100

    if 11 <= last_two_digits <= 14:
        return 2

    last_digit = value % 10

    if last_digit == 1:
        return 0

    if 2 <= last_digit <= 4:
        return 1

    return 2


def format_deadline(
    clause: ContractDeadlineClause,
) -> str:
    form = DAY_KIND_FORMS[clause.day_kind][
        plural_form_index(clause.amount)
    ]
    return f"{clause.amount} {form}"


def select_finding_category(
    *,
    action_signature: frozenset[str],
    policy: (
        contract_analysis_findings
        .ContractAnalysisFindingsPolicy
    ),
) -> str | None:
    if "payment" in action_signature:
        preferred = "payment"
    elif "acceptance" in action_signature:
        preferred = "acceptance"
    elif action_signature.intersection(
        {"delivery", "goods", "work"}
    ):
        preferred = "delivery"
    else:
        preferred = "subject"

    if preferred in policy.allowed_categories:
        return preferred

    if "subject" in policy.allowed_categories:
        return "subject"

    return None


def build_deadline_conflict_title(
    action_signature: frozenset[str],
) -> str:
    if action_signature.intersection(
        {"performance", "work"}
    ) == {"performance", "work"}:
        return (
            "Несогласованность сроков "
            "выполнения работ"
        )

    if "payment" in action_signature:
        return "Несогласованность сроков оплаты"

    if "delivery" in action_signature:
        return "Несогласованность сроков поставки"

    return (
        "Несогласованность сроков "
        "исполнения обязанности"
    )


def build_deadline_conflict_finding(
    *,
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    policy: (
        contract_analysis_findings
        .ContractAnalysisFindingsPolicy
    ),
    left: ContractDeadlineClause,
    right: ContractDeadlineClause,
) -> (
    contract_analysis_findings
    .ContractAnalysisFindingDraft
    | None
):
    category = select_finding_category(
        action_signature=left.action_signature,
        policy=policy,
    )

    if (
        category is None
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

    return (
        contract_analysis_findings
        .ContractAnalysisFindingDraft(
            category=category,
            severity_level="medium",
            title=build_deadline_conflict_title(
                left.action_signature
            ),
            description=(
                "Для одной обязанности и одного "
                "события начала отсчёта установлены "
                "разные сроки: "
                f"{format_deadline(ordered[0])} и "
                f"{format_deadline(ordered[1])}. "
                "Это создаёт риск неоднозначного "
                "определения даты исполнения."
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


def build_deterministic_deadline_findings(
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
    findings = (
        build_deadline_conflict_finding(
            evidence_index=evidence_index,
            policy=policy,
            left=left,
            right=right,
        )
        for left, right in find_deadline_conflicts(
            evidence_index
        )
    )

    return tuple(
        finding
        for finding in findings
        if finding is not None
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


def is_model_deadline_finding(
    finding: (
        contract_analysis_findings
        .ContractAnalysisFindingDraft
    ),
) -> bool:
    claim_text = (
        f"{finding.title} {finding.description}"
    )
    return (
        DEADLINE_CLAIM_PATTERN.search(claim_text)
        is not None
    )


def merge_deadline_findings(
    *,
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
    deterministic_block_sets = {
        build_finding_block_ids(finding)
        for finding in deterministic_findings
    }
    retained_model_findings = tuple(
        finding
        for finding in model_findings
        if (
            not is_model_deadline_finding(finding)
            or build_finding_block_ids(finding)
            not in deterministic_block_sets
        )
    )

    return (
        retained_model_findings
        + deterministic_findings
    )
