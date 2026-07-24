from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.contract_analysis import (
    ContractAnalysisResultStatus,
    ContractAnalysisRunStatus,
)


class ContractAnalysisEvidenceReferenceRead(
    BaseModel
):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    ordinal: int
    block_id: str
    block_ordinal: int
    start_character: int
    end_character: int
    quote: str
    quote_sha256: str


class ContractAnalysisFindingRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    finding_id: str
    ordinal: int
    category: str
    severity_level: str
    title: str
    description: str
    content_sha256: str
    evidence_references: list[
        ContractAnalysisEvidenceReferenceRead
    ]


class ContractAnalysisRunSummaryRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    contract_id: int
    document_version_id: int
    version_number: int
    created_by_user_id: int | None
    status: ContractAnalysisRunStatus
    executor: str
    model: str
    policy_id: str
    policy_version: str
    policy_sha256: str
    source_file_sha256: str | None
    extracted_text_sha256: str | None
    result_id: str | None
    result_status: (
        ContractAnalysisResultStatus | None
    )
    requires_human_review: bool | None
    content_sha256: str | None
    error_code: str | None
    error_message: str | None
    started_at: datetime
    completed_at: datetime | None


class ContractAnalysisRunRead(
    ContractAnalysisRunSummaryRead
):
    findings: list[
        ContractAnalysisFindingRead
    ]
