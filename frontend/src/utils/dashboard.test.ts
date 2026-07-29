import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Contract,
  ContractStatus,
} from "../types/contract";
import {
  buildDashboardAttentionItems,
  getDaysUntil,
} from "./dashboard";

function createContract(
  id: number,
  status: ContractStatus,
  endDate: string | null,
): Contract {
  return {
    id,
    counterparty_id: 1,
    counterparty_name: "ООО «Контрагент»",
    template_id: null,
    template_name: null,
    number: `Д-${id}`,
    title: `Договор ${id}`,
    contract_date: "2026-07-01",
    start_date: null,
    end_date: endDate,
    amount: null,
    currency: "BYN",
    status,
    archived_at: null,
    is_archived: false,
    notes: null,
    owner_role: "supplier",
    counterparty_role: "buyer",
    form_data: {},
    generated_file_name: null,
    created_at: "2026-07-01T08:00:00Z",
    updated_at: "2026-07-01T08:00:00Z",
  };
}

describe("dashboard priorities", () => {
  it("правильно считает дни от локальной даты", () => {
    expect(
      getDaysUntil(
        "2026-08-08",
        new Date(2026, 6, 29, 18, 30),
      ),
    ).toBe(10);
  });

  it("показывает согласование и только активные договоры ближайших 30 дней", () => {
    const pending = createContract(
      1,
      "pending_approval",
      null,
    );
    const soon = createContract(
      2,
      "active",
      "2026-08-05",
    );
    const later = createContract(
      3,
      "active",
      "2026-10-01",
    );

    const result = buildDashboardAttentionItems(
      [pending],
      [later, soon],
      new Date(2026, 6, 29),
    );

    expect(
      result.map((item) => item.contract.id),
    ).toEqual([1, 2]);
    expect(result[1]?.daysUntilEnd).toBe(7);
  });
});
