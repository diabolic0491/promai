import json
from dataclasses import dataclass
from hashlib import sha256

from app.services import contract_analysis_evidence

FINDING_IDENTIFIER_DOMAIN = (
    "promai:contract-analysis-finding:v1"
)
FINDINGS_RESULT_IDENTIFIER_DOMAIN = (
    "promai:contract-analysis-findings-result:v1"
)
MACHINE_DRAFT_STATUS = "machine_draft"
MAX_POLICY_ID_LENGTH = 255
MAX_POLICY_VERSION_LENGTH = 100
MAX_POLICY_VALUE_LENGTH = 100
MAX_FINDING_TITLE_LENGTH = 500
MAX_FINDING_DESCRIPTION_LENGTH = 20_000


@dataclass(frozen=True)
class ContractAnalysisFindingsPolicy:
    policy_id: str
    policy_version: str
    allowed_categories: tuple[str, ...]
    allowed_severity_levels: tuple[str, ...]


@dataclass(frozen=True)
class ContractAnalysisFindingDraft:
    category: str
    severity_level: str
    title: str
    description: str
    evidence_references: tuple[
        contract_analysis_evidence
        .ContractAnalysisEvidenceReference,
        ...,
    ]


@dataclass(frozen=True)
class VerifiedContractAnalysisFinding:
    finding_id: str
    ordinal: int
    category: str
    severity_level: str
    title: str
    description: str
    evidence: tuple[
        contract_analysis_evidence
        .VerifiedContractAnalysisEvidence,
        ...,
    ]
    content_sha256: str


@dataclass(frozen=True)
class ContractAnalysisFindingsMachineDraft:
    result_id: str
    contract_id: int
    document_version_id: int
    version_number: int
    source_file_sha256: str
    extracted_text_sha256: str
    policy_id: str
    policy_version: str
    policy_sha256: str
    status: str
    requires_human_review: bool
    findings: tuple[
        VerifiedContractAnalysisFinding,
        ...,
    ]
    content_sha256: str


class InvalidContractAnalysisFindingsPolicyError(
    Exception
):
    """Политика выводов анализа некорректна."""


class InvalidContractAnalysisFindingsDraftError(
    Exception
):
    """Черновик выводов анализа некорректен."""


class UnsupportedContractAnalysisFindingCategoryError(
    Exception
):
    """Категория вывода не разрешена политикой."""


class UnsupportedContractAnalysisFindingSeverityError(
    Exception
):
    """Уровень тяжести не разрешён политикой."""


class DuplicateContractAnalysisFindingError(
    Exception
):
    """Черновик содержит повторяющийся вывод."""


class DuplicateContractAnalysisEvidenceReferenceError(
    Exception
):
    """Вывод повторно использует одну ссылку."""


def is_non_empty_canonical_text(
    value: object,
) -> bool:
    return (
        isinstance(value, str)
        and bool(value)
        and value == value.strip()
    )


def is_bounded_canonical_text(
    value: object,
    *,
    max_length: int,
) -> bool:
    return (
        is_non_empty_canonical_text(value)
        and len(value) <= max_length
    )


def canonical_payload_sha256(
    payload: object,
) -> str:
    encoded_payload = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")

    return sha256(encoded_payload).hexdigest()


def build_domain_identifier(
    *,
    prefix: str,
    domain: str,
    content_sha256: str,
) -> str:
    identifier_payload = (
        f"{domain}\n{content_sha256}"
    ).encode()

    return (
        prefix
        + sha256(identifier_payload).hexdigest()
    )


def validate_policy_values(
    values: object,
) -> bool:
    return (
        type(values) is tuple
        and bool(values)
        and len(values) <= 100
        and all(
            is_bounded_canonical_text(
                value,
                max_length=MAX_POLICY_VALUE_LENGTH,
            )
            for value in values
        )
        and len(values) == len(set(values))
    )


def build_contract_analysis_policy_sha256(
    policy: ContractAnalysisFindingsPolicy,
) -> str:
    if (
        type(policy)
        is not ContractAnalysisFindingsPolicy
        or not is_bounded_canonical_text(
            policy.policy_id,
            max_length=MAX_POLICY_ID_LENGTH,
        )
        or not is_bounded_canonical_text(
            policy.policy_version,
            max_length=MAX_POLICY_VERSION_LENGTH,
        )
        or not validate_policy_values(
            policy.allowed_categories
        )
        or not validate_policy_values(
            policy.allowed_severity_levels
        )
    ):
        raise (
            InvalidContractAnalysisFindingsPolicyError
        )

    return canonical_payload_sha256(
        {
            "allowed_categories": sorted(
                policy.allowed_categories
            ),
            "allowed_severity_levels": sorted(
                policy.allowed_severity_levels
            ),
            "policy_id": policy.policy_id,
            "policy_version": (
                policy.policy_version
            ),
        }
    )


def validate_finding_draft(
    *,
    draft: object,
    policy: ContractAnalysisFindingsPolicy,
) -> ContractAnalysisFindingDraft:
    if (
        type(draft)
        is not ContractAnalysisFindingDraft
        or not is_bounded_canonical_text(
            draft.category,
            max_length=MAX_POLICY_VALUE_LENGTH,
        )
        or not is_bounded_canonical_text(
            draft.severity_level,
            max_length=MAX_POLICY_VALUE_LENGTH,
        )
        or not is_bounded_canonical_text(
            draft.title,
            max_length=MAX_FINDING_TITLE_LENGTH,
        )
        or not is_bounded_canonical_text(
            draft.description,
            max_length=(
                MAX_FINDING_DESCRIPTION_LENGTH
            ),
        )
        or type(draft.evidence_references)
        is not tuple
        or not draft.evidence_references
        or any(
            type(reference)
            is not (
                contract_analysis_evidence
                .ContractAnalysisEvidenceReference
            )
            for reference
            in draft.evidence_references
        )
    ):
        raise InvalidContractAnalysisFindingsDraftError

    if draft.category not in (
        policy.allowed_categories
    ):
        raise (
            UnsupportedContractAnalysisFindingCategoryError
        )

    if draft.severity_level not in (
        policy.allowed_severity_levels
    ):
        raise (
            UnsupportedContractAnalysisFindingSeverityError
        )

    return draft


def build_verified_evidence_key(
    evidence: (
        contract_analysis_evidence
        .VerifiedContractAnalysisEvidence
    ),
) -> tuple[str, int, int, str]:
    reference = evidence.reference

    return (
        reference.block_id,
        reference.start_character,
        reference.end_character,
        evidence.quote_sha256,
    )


def build_verified_evidence_payload(
    evidence: (
        contract_analysis_evidence
        .VerifiedContractAnalysisEvidence
    ),
) -> dict[str, object]:
    reference = evidence.reference

    return {
        "block_id": reference.block_id,
        "end_character": (
            reference.end_character
        ),
        "quote": reference.quote,
        "quote_sha256": evidence.quote_sha256,
        "start_character": (
            reference.start_character
        ),
    }


def verify_finding_evidence(
    *,
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    references: tuple[
        contract_analysis_evidence
        .ContractAnalysisEvidenceReference,
        ...,
    ],
) -> tuple[
    contract_analysis_evidence
    .VerifiedContractAnalysisEvidence,
    ...,
]:
    verified_evidence = tuple(
        (
            contract_analysis_evidence
            .verify_contract_analysis_evidence_reference(
                evidence_index,
                reference,
            )
        )
        for reference in references
    )
    evidence_keys = tuple(
        build_verified_evidence_key(evidence)
        for evidence in verified_evidence
    )

    if len(evidence_keys) != len(
        set(evidence_keys)
    ):
        raise (
            DuplicateContractAnalysisEvidenceReferenceError
        )

    return tuple(
        sorted(
            verified_evidence,
            key=lambda evidence: (
                evidence.block.ordinal,
                evidence.reference.start_character,
                evidence.reference.end_character,
                evidence.quote_sha256,
            ),
        )
    )


def build_finding_duplicate_key(
    draft: ContractAnalysisFindingDraft,
) -> str:
    return canonical_payload_sha256(
        {
            "category": draft.category,
            "description": draft.description,
            "severity_level": (
                draft.severity_level
            ),
            "title": draft.title,
        }
    )


def build_verified_finding(
    *,
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    policy_sha256: str,
    draft: ContractAnalysisFindingDraft,
    ordinal: int,
) -> VerifiedContractAnalysisFinding:
    verified_evidence = verify_finding_evidence(
        evidence_index=evidence_index,
        references=draft.evidence_references,
    )
    content_sha256 = canonical_payload_sha256(
        {
            "category": draft.category,
            "description": draft.description,
            "document": {
                "contract_id": (
                    evidence_index.contract_id
                ),
                "document_version_id": (
                    evidence_index
                    .document_version_id
                ),
                "extracted_text_sha256": (
                    evidence_index
                    .extracted_text_sha256
                ),
                "source_file_sha256": (
                    evidence_index
                    .source_file_sha256
                ),
                "version_number": (
                    evidence_index.version_number
                ),
            },
            "evidence": [
                build_verified_evidence_payload(
                    evidence
                )
                for evidence in verified_evidence
            ],
            "policy_sha256": policy_sha256,
            "severity_level": (
                draft.severity_level
            ),
            "title": draft.title,
        }
    )
    finding_id = build_domain_identifier(
        prefix="contract-finding-v1-",
        domain=FINDING_IDENTIFIER_DOMAIN,
        content_sha256=content_sha256,
    )

    return VerifiedContractAnalysisFinding(
        finding_id=finding_id,
        ordinal=ordinal,
        category=draft.category,
        severity_level=draft.severity_level,
        title=draft.title,
        description=draft.description,
        evidence=verified_evidence,
        content_sha256=content_sha256,
    )


def build_result_content_sha256(
    *,
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    policy: ContractAnalysisFindingsPolicy,
    policy_sha256: str,
    findings: tuple[
        VerifiedContractAnalysisFinding,
        ...,
    ],
) -> str:
    return canonical_payload_sha256(
        {
            "document": {
                "contract_id": (
                    evidence_index.contract_id
                ),
                "document_version_id": (
                    evidence_index
                    .document_version_id
                ),
                "extracted_text_sha256": (
                    evidence_index
                    .extracted_text_sha256
                ),
                "source_file_sha256": (
                    evidence_index
                    .source_file_sha256
                ),
                "version_number": (
                    evidence_index.version_number
                ),
            },
            "findings": [
                {
                    "content_sha256": (
                        finding.content_sha256
                    ),
                    "finding_id": (
                        finding.finding_id
                    ),
                    "ordinal": finding.ordinal,
                }
                for finding in findings
            ],
            "policy": {
                "policy_id": policy.policy_id,
                "policy_sha256": policy_sha256,
                "policy_version": (
                    policy.policy_version
                ),
            },
            "requires_human_review": True,
            "status": MACHINE_DRAFT_STATUS,
        }
    )


def build_contract_analysis_findings_machine_draft(
    evidence_index: (
        contract_analysis_evidence
        .ContractAnalysisEvidenceIndex
    ),
    *,
    policy: ContractAnalysisFindingsPolicy,
    findings: tuple[
        ContractAnalysisFindingDraft,
        ...,
    ],
) -> ContractAnalysisFindingsMachineDraft:
    (
        contract_analysis_evidence
        .validate_contract_analysis_evidence_index(
            evidence_index
        )
    )
    policy_sha256 = (
        build_contract_analysis_policy_sha256(
            policy
        )
    )

    if type(findings) is not tuple:
        raise InvalidContractAnalysisFindingsDraftError

    verified_findings: list[
        VerifiedContractAnalysisFinding
    ] = []
    duplicate_keys: set[str] = set()

    for ordinal, unvalidated_draft in enumerate(
        findings,
        start=1,
    ):
        draft = validate_finding_draft(
            draft=unvalidated_draft,
            policy=policy,
        )
        duplicate_key = build_finding_duplicate_key(
            draft
        )

        if duplicate_key in duplicate_keys:
            raise DuplicateContractAnalysisFindingError

        duplicate_keys.add(duplicate_key)
        verified_findings.append(
            build_verified_finding(
                evidence_index=evidence_index,
                policy_sha256=policy_sha256,
                draft=draft,
                ordinal=ordinal,
            )
        )

    immutable_findings = tuple(
        verified_findings
    )
    content_sha256 = build_result_content_sha256(
        evidence_index=evidence_index,
        policy=policy,
        policy_sha256=policy_sha256,
        findings=immutable_findings,
    )
    result_id = build_domain_identifier(
        prefix="contract-findings-result-v1-",
        domain=FINDINGS_RESULT_IDENTIFIER_DOMAIN,
        content_sha256=content_sha256,
    )

    return ContractAnalysisFindingsMachineDraft(
        result_id=result_id,
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
        policy_id=policy.policy_id,
        policy_version=policy.policy_version,
        policy_sha256=policy_sha256,
        status=MACHINE_DRAFT_STATUS,
        requires_human_review=True,
        findings=immutable_findings,
        content_sha256=content_sha256,
    )
