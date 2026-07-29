import { apiRequest } from "./client";

import type {
  ContractAnalysisRun,
  ContractAnalysisRunSummary,
} from "../types/contractAnalysis";
import type { Page } from "../types/pagination";

function analysisPath(
  contractId: number,
  versionNumber: number,
): string {
  return (
    `/contracts/${contractId}/versions/` +
    `${versionNumber}/analyses`
  );
}

export function getContractAnalysisRuns(
  contractId: number,
  versionNumber: number,
  limit = 20,
  offset = 0,
): Promise<Page<ContractAnalysisRunSummary>> {
  const parameters = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return apiRequest<Page<ContractAnalysisRunSummary>>(
    `${analysisPath(
      contractId,
      versionNumber,
    )}?${parameters.toString()}`,
  );
}

export function startContractAnalysis(
  contractId: number,
  versionNumber: number,
): Promise<ContractAnalysisRun> {
  return apiRequest<ContractAnalysisRun>(
    analysisPath(contractId, versionNumber),
    { method: "POST" },
  );
}

export function getContractAnalysisRun(
  contractId: number,
  versionNumber: number,
  analysisId: number,
): Promise<ContractAnalysisRun> {
  return apiRequest<ContractAnalysisRun>(
    `${analysisPath(
      contractId,
      versionNumber,
    )}/${analysisId}`,
  );
}
