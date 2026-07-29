import type {
  ContractEventType,
  ContractPartyRole,
  ContractStatus,
} from "../types/contract";

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export const contractStatusOptions: SelectOption<
  ContractStatus
>[] = [
  { value: "draft", label: "Черновик" },
  {
    value: "pending_approval",
    label: "На согласовании",
  },
  { value: "active", label: "Действующий" },
  { value: "completed", label: "Завершён" },
  { value: "terminated", label: "Расторгнут" },
];

export const contractStatusLabels = Object.fromEntries(
  contractStatusOptions.map(({ value, label }) => [
    value,
    label,
  ]),
) as Record<ContractStatus, string>;

export const contractRoleOptions: SelectOption<
  ContractPartyRole
>[] = [
  { value: "supplier", label: "Поставщик" },
  { value: "buyer", label: "Покупатель" },
  { value: "contractor", label: "Подрядчик" },
  { value: "customer", label: "Заказчик" },
  { value: "executor", label: "Исполнитель" },
  { value: "landlord", label: "Арендодатель" },
  { value: "tenant", label: "Арендатор" },
  { value: "lender", label: "Займодавец" },
  { value: "borrower", label: "Заёмщик" },
  { value: "other", label: "Иная роль" },
];

export const contractRoleLabels = Object.fromEntries(
  contractRoleOptions.map(({ value, label }) => [
    value,
    label,
  ]),
) as Record<ContractPartyRole, string>;

export const pairedContractRoles: Partial<
  Record<ContractPartyRole, ContractPartyRole>
> = {
  supplier: "buyer",
  buyer: "supplier",
  contractor: "customer",
  customer: "contractor",
  executor: "customer",
  landlord: "tenant",
  tenant: "landlord",
  lender: "borrower",
  borrower: "lender",
  other: "other",
};

export const allowedContractStatusTransitions: Record<
  ContractStatus,
  ContractStatus[]
> = {
  draft: ["pending_approval"],
  pending_approval: ["draft", "active"],
  active: ["completed", "terminated"],
  completed: [],
  terminated: [],
};

export const contractStatusActionLabels: Partial<
  Record<ContractStatus, string>
> = {
  draft: "Вернуть на доработку",
  pending_approval: "Отправить на согласование",
  active: "Активировать",
  completed: "Завершить",
  terminated: "Расторгнуть",
};

export const contractEventLabels: Record<
  ContractEventType,
  string
> = {
  created: "Договор создан",
  updated: "Сведения изменены",
  status_changed: "Статус изменён",
  archived: "Договор архивирован",
  restored: "Договор восстановлен",
  generated: "DOCX сгенерирован",
  uploaded: "Версия DOCX загружена",
};

export const contractFieldLabels: Record<
  string,
  string
> = {
  number: "Номер",
  title: "Название",
  contract_date: "Дата договора",
  start_date: "Начало действия",
  end_date: "Окончание действия",
  amount: "Сумма",
  currency: "Валюта",
  notes: "Примечание",
  owner_role: "Роль нашей организации",
  counterparty_role: "Роль контрагента",
  template_id: "Шаблон",
  form_data: "Дополнительные данные",
};

export const systemContractTemplateVariables = new Set([
  "contract.id",
  "contract.number",
  "contract.title",
  "contract.date",
  "contract.contract_date",
  "contract.day",
  "contract.month",
  "contract.year",
  "contract.start_date",
  "contract.end_date",
  "contract.amount",
  "contract.currency",
  "contract.status",
  "contract.notes",
  "contract.owner_role",
  "contract.counterparty_role",
  "counterparty.id",
  "counterparty.unp",
  "counterparty.name",
  "counterparty.full_name",
  "counterparty.short_name",
  "counterparty.legal_address",
  "counterparty.address",
  "organization.name",
  "organization.full_name",
  "organization.short_name",
  "organization.unp",
  "organization.legal_address",
  "organization.address",
  "organization.email",
  "organization.phone",
  "organization.director_name",
  "organization.director_position",
  "organization.bank_name",
  "organization.bank",
  "organization.bank_account",
  "organization.account",
  "organization.bank_code",
  "organization.bic",
]);

const templateVariableLabels: Record<string, string> = {
  "contract.city": "Место заключения",
  "contract.subject": "Предмет договора",
  "contract.delivery_scope": "Объём поставки / работ",
  "contract.amount_words": "Сумма прописью",
  "contract.vat_amount": "Сумма НДС",
  "contract.vat_amount_words": "Сумма НДС прописью",
  "contract.payment_terms": "Условия оплаты",
  "contract.delivery_period": "Срок поставки",
  "contract.delivery_address": "Адрес поставки",
  "organization.authority":
    "Основание полномочий руководителя",
  "counterparty.account": "Счёт контрагента",
  "counterparty.bank": "Банк контрагента",
  "counterparty.bic": "БИК контрагента",
  "counterparty.director_name":
    "Руководитель контрагента",
  "counterparty.director_position":
    "Должность руководителя контрагента",
  "counterparty.authority":
    "Основание полномочий контрагента",
};

export function getTemplateVariableLabel(
  variable: string,
): string {
  return (
    templateVariableLabels[variable] ??
    variable
      .split(".")
      .at(-1)
      ?.replaceAll("_", " ")
      .replace(/^./, (character) =>
        character.toUpperCase(),
      ) ??
    variable
  );
}
