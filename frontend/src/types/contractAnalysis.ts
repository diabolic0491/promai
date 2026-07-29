export type ContractAnalysisRunStatus =
  | "running"
  | "completed"
  | "failed";

export type ContractAnalysisResultStatus =
  "machine_draft";

export type ContractAnalysisSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export interface ContractAnalysisEvidenceReference {
  id: number;
  ordinal: number;
  block_id: string;
  block_ordinal: number;
  start_character: number;
  end_character: number;
  quote: string;
  quote_sha256: string;
}

export interface ContractAnalysisFinding {
  id: number;
  finding_id: string;
  ordinal: number;
  category: string;
  severity_level: ContractAnalysisSeverity;
  title: string;
  description: string;
  content_sha256: string;
  evidence_references: ContractAnalysisEvidenceReference[];
}

export interface ContractAnalysisRunSummary {
  id: number;
  contract_id: number;
  document_version_id: number;
  version_number: number;
  created_by_user_id: number | null;
  status: ContractAnalysisRunStatus;
  executor: string;
  model: string;
  policy_id: string;
  policy_version: string;
  policy_sha256: string;
  source_file_sha256: string | null;
  extracted_text_sha256: string | null;
  result_id: string | null;
  result_status: ContractAnalysisResultStatus | null;
  requires_human_review: boolean | null;
  content_sha256: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface ContractAnalysisRun
  extends ContractAnalysisRunSummary {
  findings: ContractAnalysisFinding[];
}
