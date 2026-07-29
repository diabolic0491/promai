import {
  describe,
  expect,
  it,
} from "vitest";

import { ApiError } from "../api/client";
import {
  getFailedAnalysisId,
  getMissingTemplateVariables,
} from "./apiErrors";

describe("API error helpers", () => {
  it("извлекает missing_variables из объектного detail", () => {
    const error = new ApiError("Ошибка", 422, {
      detail: {
        message: "Не заполнены переменные",
        missing_variables: [
          "contract.subject",
          "organization.authority",
        ],
      },
    });

    expect(
      getMissingTemplateVariables(error),
    ).toEqual([
      "contract.subject",
      "organization.authority",
    ]);
  });

  it("извлекает analysis_id из ошибки запуска", () => {
    const error = new ApiError("Ошибка", 502, {
      detail: {
        status: "failed",
        analysis_id: 42,
      },
    });

    expect(getFailedAnalysisId(error)).toBe(42);
  });
});
