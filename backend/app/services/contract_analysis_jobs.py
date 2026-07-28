import logging

from app.db.session import SessionLocal
from app.services import (
    contract_analysis_executor,
    contract_analysis_runs,
)


logger = logging.getLogger(__name__)


def execute_contract_analysis_job(
    *,
    analysis_id: int,
    execution_context: (
        contract_analysis_executor
        .ContractAnalysisExecutionContext
    ),
) -> None:
    with SessionLocal() as session:
        try:
            contract_analysis_runs.execute_contract_analysis(
                session=session,
                analysis_id=analysis_id,
                execution_context=execution_context,
            )
        except (
            contract_analysis_runs
            .ContractAnalysisExecutionFailedError
        ) as error:
            logger.warning(
                "Contract analysis %s failed with %s",
                error.analysis_id,
                error.code,
            )
        except Exception:
            logger.exception(
                "Contract analysis %s background job failed",
                analysis_id,
            )


def fail_interrupted_analysis_jobs() -> int:
    with SessionLocal() as session:
        return (
            contract_analysis_runs
            .fail_interrupted_analyses(
                session=session,
            )
        )
