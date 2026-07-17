import type { ContractPartyRole } from
  "../types/contract";

export interface ContractRoleOption {
  value: ContractPartyRole;
  label: string;
}

export const contractRoleOptions:
  ContractRoleOption[] = [
    {
      value: "supplier",
      label: "Поставщик",
    },
    {
      value: "buyer",
      label: "Покупатель",
    },
    {
      value: "contractor",
      label: "Подрядчик",
    },
    {
      value: "customer",
      label: "Заказчик",
    },
    {
      value: "executor",
      label: "Исполнитель",
    },
    {
      value: "landlord",
      label: "Арендодатель",
    },
    {
      value: "tenant",
      label: "Арендатор",
    },
    {
      value: "lender",
      label: "Займодавец",
    },
    {
      value: "borrower",
      label: "Заёмщик",
    },
    {
      value: "other",
      label: "Иная роль",
    },
  ];

export const pairedContractRoles:
  Partial<Record<
    ContractPartyRole,
    ContractPartyRole
  >> = {
    supplier: "buyer",
    buyer: "supplier",
    contractor: "customer",
    customer: "contractor",
    executor: "customer",
    landlord: "tenant",
    tenant: "landlord",
    lender: "borrower",
    borrower: "lender",
  };

export function getContractRoleLabel(
  role: ContractPartyRole,
): string {
  return (
    contractRoleOptions.find(
      (option) => option.value === role,
    )?.label ?? role
  );
}