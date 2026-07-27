from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.contract_analysis import (
    ContractAnalysisEvidenceReference as EvidenceModel,
)
from app.models.contract_analysis import (
    ContractAnalysisFinding as FindingModel,
)
from app.models.contract_analysis import (
    ContractAnalysisResultStatus,
    ContractAnalysisRun,
    ContractAnalysisRunStatus,
)
from app.services import (
    contract_analysis_deadlines,
    contract_analysis_evidence,
    contract_analysis_executor,
    contract_analysis_findings,
    contract_analysis_input,
    contract_analysis_semantics,
    contract_documents,
)


class ContractAnalysisRunNotFoundError(Exception):
    """Запуск анализа не найден."""


class ContractAnalysisAlreadyRunningError(
    Exception
):
    """Другой анализ уже выполняется."""


@dataclass(frozen=True)
class ContractAnalysisFailure:
    code: str
    message: str
    http_status_code: int


class ContractAnalysisExecutionFailedError(
    Exception
):
    def __init__(
        self,
        *,
        analysis_id: int,
        failure: ContractAnalysisFailure,
    ) -> None:
        self.analysis_id = analysis_id
        self.code = failure.code
        self.public_message = failure.message
        self.http_status_code = (
            failure.http_status_code
        )
        super().__init__(failure.message)


def classify_analysis_failure(
    error: Exception,
) -> ContractAnalysisFailure:
    if isinstance(
        error,
        (
            contract_analysis_input
            .ContractAnalysisDocumentUnavailableError,
            contract_documents
            .ContractDocumentNotFoundError,
            contract_documents
            .ContractDocumentVersionNotFoundError,
        ),
    ):
        return ContractAnalysisFailure(
            code="document_unavailable",
            message=(
                "Версия документа недоступна "
                "для анализа"
            ),
            http_status_code=409,
        )

    if isinstance(
        error,
        contract_analysis_input
        .ContractAnalysisDocumentIntegrityError,
    ):
        return ContractAnalysisFailure(
            code="document_integrity_error",
            message=(
                "Целостность версии документа "
                "не подтверждена"
            ),
            http_status_code=409,
        )

    if isinstance(
        error,
        (
            contract_analysis_input
            .InvalidContractAnalysisDocumentError,
            contract_analysis_input
            .EmptyContractAnalysisDocumentError,
        ),
    ):
        return ContractAnalysisFailure(
            code="invalid_document",
            message=(
                "Версия документа не содержит "
                "корректный DOCX для анализа"
            ),
            http_status_code=422,
        )

    if isinstance(
        error,
        contract_analysis_executor
        .ContractAnalysisExecutorUnavailableError,
    ):
        return ContractAnalysisFailure(
            code="executor_unavailable",
            message=(
                "Исполнитель анализа временно "
                "недоступен"
            ),
            http_status_code=502,
        )

    if isinstance(
        error,
        (
            contract_analysis_executor
            .InvalidContractAnalysisExecutorResponseError,
            contract_analysis_findings
            .InvalidContractAnalysisFindingsDraftError,
            contract_analysis_findings
            .UnsupportedContractAnalysisFindingCategoryError,
            contract_analysis_findings
            .UnsupportedContractAnalysisFindingSeverityError,
            contract_analysis_findings
            .DuplicateContractAnalysisFindingError,
            contract_analysis_findings
            .DuplicateContractAnalysisEvidenceReferenceError,
            contract_analysis_evidence
            .InvalidContractAnalysisEvidenceInputError,
            contract_analysis_evidence
            .ContractAnalysisEvidenceDocumentMismatchError,
            contract_analysis_evidence
            .ContractAnalysisEvidenceBlockNotFoundError,
            contract_analysis_evidence
            .InvalidContractAnalysisEvidenceRangeError,
            contract_analysis_evidence
            .ContractAnalysisEvidenceQuoteMismatchError,
        ),
    ):
        return ContractAnalysisFailure(
            code="invalid_executor_response",
            message=(
                "Исполнитель вернул результат, "
                "который не прошёл проверку"
            ),
            http_status_code=502,
        )

    return ContractAnalysisFailure(
        code="analysis_internal_error",
        message=(
            "Не удалось сохранить результат анализа"
        ),
        http_status_code=500,
    )


def get_run_load_options() -> tuple[object, ...]:
    return (
        selectinload(
            ContractAnalysisRun.findings
        ).selectinload(
            FindingModel.evidence_references
        ),
    )


def get_contract_version_for_analysis(
    *,
    session: Session,
    contract_id: int,
    version_number: int,
):
    return (
        contract_documents
        .get_contract_document_version(
            session=session,
            contract_id=contract_id,
            version_number=version_number,
        )
    )


def create_running_analysis(
    *,
    session: Session,
    contract_id: int,
    version_number: int,
    actor_user_id: int,
    execution_context: (
        contract_analysis_executor
        .ContractAnalysisExecutionContext
    ),
) -> ContractAnalysisRun:
    version = get_contract_version_for_analysis(
        session=session,
        contract_id=contract_id,
        version_number=version_number,
    )
    existing_run = session.scalar(
        select(ContractAnalysisRun.id).where(
            ContractAnalysisRun.status
            == ContractAnalysisRunStatus.RUNNING.value,
        )
    )

    if existing_run is not None:
        raise ContractAnalysisAlreadyRunningError

    policy = execution_context.policy
    policy_sha256 = (
        contract_analysis_findings
        .build_contract_analysis_policy_sha256(
            policy
        )
    )
    analysis_run = ContractAnalysisRun(
        contract_id=contract_id,
        document_version_id=version.id,
        version_number=version.version_number,
        created_by_user_id=actor_user_id,
        status=(
            ContractAnalysisRunStatus.RUNNING.value
        ),
        executor=(
            execution_context.executor.executor_name
        ),
        model=execution_context.executor.model,
        policy_id=policy.policy_id,
        policy_version=policy.policy_version,
        policy_sha256=policy_sha256,
    )
    session.add(analysis_run)

    try:
        session.commit()
        session.refresh(analysis_run)
    except IntegrityError as error:
        session.rollback()
        raise (
            ContractAnalysisAlreadyRunningError
        ) from error

    return analysis_run


def persist_completed_analysis(
    *,
    session: Session,
    analysis_run: ContractAnalysisRun,
    machine_draft: (
        contract_analysis_findings
        .ContractAnalysisFindingsMachineDraft
    ),
) -> None:
    for finding in machine_draft.findings:
        finding_model = FindingModel(
            finding_id=finding.finding_id,
            ordinal=finding.ordinal,
            category=finding.category,
            severity_level=finding.severity_level,
            title=finding.title,
            description=finding.description,
            content_sha256=finding.content_sha256,
        )

        for ordinal, evidence in enumerate(
            finding.evidence,
            start=1,
        ):
            reference = evidence.reference
            finding_model.evidence_references.append(
                EvidenceModel(
                    ordinal=ordinal,
                    block_id=reference.block_id,
                    block_ordinal=(
                        evidence.block.ordinal
                    ),
                    start_character=(
                        reference.start_character
                    ),
                    end_character=(
                        reference.end_character
                    ),
                    quote=reference.quote,
                    quote_sha256=(
                        evidence.quote_sha256
                    ),
                )
            )

        analysis_run.findings.append(
            finding_model
        )

    analysis_run.source_file_sha256 = (
        machine_draft.source_file_sha256
    )
    analysis_run.extracted_text_sha256 = (
        machine_draft.extracted_text_sha256
    )
    analysis_run.result_id = machine_draft.result_id
    analysis_run.result_status = (
        ContractAnalysisResultStatus
        .MACHINE_DRAFT.value
    )
    analysis_run.requires_human_review = True
    analysis_run.content_sha256 = (
        machine_draft.content_sha256
    )
    analysis_run.status = (
        ContractAnalysisRunStatus.COMPLETED.value
    )
    analysis_run.completed_at = datetime.now(
        timezone.utc
    )
    session.commit()


def persist_failed_analysis(
    *,
    session: Session,
    analysis_id: int,
    failure: ContractAnalysisFailure,
    source_file_sha256: str | None,
    extracted_text_sha256: str | None,
) -> None:
    session.rollback()
    analysis_run = session.get(
        ContractAnalysisRun,
        analysis_id,
    )

    if analysis_run is None:
        raise ContractAnalysisRunNotFoundError

    analysis_run.source_file_sha256 = (
        source_file_sha256
    )
    analysis_run.extracted_text_sha256 = (
        extracted_text_sha256
    )
    analysis_run.status = (
        ContractAnalysisRunStatus.FAILED.value
    )
    analysis_run.error_code = failure.code
    analysis_run.error_message = failure.message
    analysis_run.completed_at = datetime.now(
        timezone.utc
    )
    session.commit()


def run_contract_analysis(
    *,
    session: Session,
    contract_id: int,
    version_number: int,
    actor_user_id: int,
    execution_context: (
        contract_analysis_executor
        .ContractAnalysisExecutionContext
    ),
) -> ContractAnalysisRun:
    analysis_run = create_running_analysis(
        session=session,
        contract_id=contract_id,
        version_number=version_number,
        actor_user_id=actor_user_id,
        execution_context=execution_context,
    )
    analysis_input = None

    try:
        analysis_input = (
            contract_analysis_input
            .prepare_contract_analysis_input(
                session=session,
                contract_id=contract_id,
                version_number=version_number,
            )
        )

        if (
            analysis_input.document_version_id
            != analysis_run.document_version_id
        ):
            raise (
                contract_analysis_evidence
                .InvalidContractAnalysisEvidenceInputError
            )

        evidence_index = (
            contract_analysis_evidence
            .build_contract_analysis_evidence_index(
                analysis_input
            )
        )
        session.commit()
        finding_drafts = (
            execution_context.executor.execute(
                evidence_index=evidence_index,
                policy=execution_context.policy,
            )
        )
        validated_machine_draft = (
            contract_analysis_findings
            .build_contract_analysis_findings_machine_draft(
                evidence_index,
                policy=execution_context.policy,
                findings=finding_drafts,
            )
        )
        supported_finding_drafts = (
            contract_analysis_semantics
            .filter_semantically_supported_findings(
                finding_drafts
            )
        )
        deterministic_deadline_findings = (
            contract_analysis_deadlines
            .build_deterministic_deadline_findings(
                evidence_index=evidence_index,
                policy=execution_context.policy,
            )
        )
        final_finding_drafts = (
            contract_analysis_deadlines
            .merge_deadline_findings(
                model_findings=(
                    supported_finding_drafts
                ),
                deterministic_findings=(
                    deterministic_deadline_findings
                ),
            )
        )
        machine_draft = (
            validated_machine_draft
            if (
                final_finding_drafts
                == finding_drafts
            )
            else (
                contract_analysis_findings
                .build_contract_analysis_findings_machine_draft(
                    evidence_index,
                    policy=execution_context.policy,
                    findings=(
                        final_finding_drafts
                    ),
                )
            )
        )
        persist_completed_analysis(
            session=session,
            analysis_run=analysis_run,
            machine_draft=machine_draft,
        )
    except Exception as error:
        failure = classify_analysis_failure(error)
        persist_failed_analysis(
            session=session,
            analysis_id=analysis_run.id,
            failure=failure,
            source_file_sha256=(
                analysis_input.source_file_sha256
                if analysis_input is not None
                else None
            ),
            extracted_text_sha256=(
                analysis_input.extracted_text_sha256
                if analysis_input is not None
                else None
            ),
        )
        raise ContractAnalysisExecutionFailedError(
            analysis_id=analysis_run.id,
            failure=failure,
        ) from error

    return get_contract_analysis_run(
        session=session,
        contract_id=contract_id,
        version_number=version_number,
        analysis_id=analysis_run.id,
    )


def list_contract_analysis_runs(
    *,
    session: Session,
    contract_id: int,
    version_number: int,
    limit: int = 20,
    offset: int = 0,
) -> list[ContractAnalysisRun]:
    version = get_contract_version_for_analysis(
        session=session,
        contract_id=contract_id,
        version_number=version_number,
    )
    statement = (
        select(ContractAnalysisRun)
        .where(
            ContractAnalysisRun.document_version_id
            == version.id
        )
        .order_by(
            ContractAnalysisRun.started_at.desc(),
            ContractAnalysisRun.id.desc(),
        )
        .offset(offset)
        .limit(limit)
    )

    return list(session.scalars(statement).all())


def get_contract_analysis_run(
    *,
    session: Session,
    contract_id: int,
    version_number: int,
    analysis_id: int,
) -> ContractAnalysisRun:
    version = get_contract_version_for_analysis(
        session=session,
        contract_id=contract_id,
        version_number=version_number,
    )
    statement = (
        select(ContractAnalysisRun)
        .options(*get_run_load_options())
        .where(
            ContractAnalysisRun.id == analysis_id,
            ContractAnalysisRun.document_version_id
            == version.id,
        )
    )
    analysis_run = session.scalar(statement)

    if analysis_run is None:
        raise ContractAnalysisRunNotFoundError

    return analysis_run
