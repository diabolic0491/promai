import type {
  ContractAnalysisRunStatus,
} from "../types/contractAnalysis";

export const CONTRACT_ANALYSIS_POLL_INTERVAL_MS =
  2_000;

export function getContractAnalysisPollInterval(
  status: ContractAnalysisRunStatus | undefined,
): number | false {
  return status === "running"
    ? CONTRACT_ANALYSIS_POLL_INTERVAL_MS
    : false;
}
