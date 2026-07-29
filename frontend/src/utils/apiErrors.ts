import { ApiError } from "../api/client";

function getServerDetail(
  error: unknown,
): Record<string, unknown> | null {
  if (
    !(error instanceof ApiError) ||
    !error.detail ||
    typeof error.detail !== "object" ||
    !("detail" in error.detail)
  ) {
    return null;
  }

  const detail = (
    error.detail as { detail?: unknown }
  ).detail;

  return detail && typeof detail === "object"
    ? (detail as Record<string, unknown>)
    : null;
}

export function getMissingTemplateVariables(
  error: unknown,
): string[] {
  const detail = getServerDetail(error);
  const variables = detail?.missing_variables;

  return Array.isArray(variables)
    ? variables.filter(
        (value): value is string =>
          typeof value === "string",
      )
    : [];
}

export function getFailedAnalysisId(
  error: unknown,
): number | null {
  const detail = getServerDetail(error);
  const analysisId = detail?.analysis_id;

  return typeof analysisId === "number" &&
    Number.isInteger(analysisId) &&
    analysisId > 0
    ? analysisId
    : null;
}
