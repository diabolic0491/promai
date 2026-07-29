import {
  describe,
  expect,
  it,
} from "vitest";

import {
  allowedContractStatusTransitions,
} from "../constants/contracts";
import {
  buildNestedFormData,
  flattenFormData,
  getCustomTemplateVariables,
} from "./contractFormData";

describe("contract form rules", () => {
  it("исключает автоматически заполняемые переменные шаблона", () => {
    expect(
      getCustomTemplateVariables([
        "contract.number",
        "counterparty.name",
        "contract.subject",
        "organization.authority",
      ]),
    ).toEqual([
      "contract.subject",
      "organization.authority",
    ]);
  });

  it("собирает dotted variables в form_data и разворачивает обратно", () => {
    const nested = buildNestedFormData({
      "contract.subject": "Поставка оборудования",
      "counterparty.account": "BY00TEST",
      "ignored.empty": "   ",
    });

    expect(nested).toEqual({
      contract: {
        subject: "Поставка оборудования",
      },
      counterparty: {
        account: "BY00TEST",
      },
    });
    expect(flattenFormData(nested)).toEqual([
      ["contract.subject", "Поставка оборудования"],
      ["counterparty.account", "BY00TEST"],
    ]);
  });

  it("разрешает только утверждённые переходы статуса", () => {
    expect(
      allowedContractStatusTransitions.draft,
    ).toEqual(["pending_approval"]);
    expect(
      allowedContractStatusTransitions.pending_approval,
    ).toEqual(["draft", "active"]);
    expect(
      allowedContractStatusTransitions.active,
    ).toEqual(["completed", "terminated"]);
    expect(
      allowedContractStatusTransitions.completed,
    ).toEqual([]);
    expect(
      allowedContractStatusTransitions.terminated,
    ).toEqual([]);
  });
});
