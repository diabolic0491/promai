import type {
  TechnicalSpecificationStatus,
} from "../types/technicalSpecification";

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export const technicalSpecificationStatusOptions: SelectOption<
  TechnicalSpecificationStatus
>[] = [
  { value: "draft", label: "Черновик" },
  {
    value: "pending_approval",
    label: "На согласовании",
  },
  { value: "approved", label: "Утверждено" },
  { value: "issued", label: "Выдано" },
  { value: "cancelled", label: "Отменено" },
];

export const technicalSpecificationStatusLabels =
  Object.fromEntries(
    technicalSpecificationStatusOptions.map(
      ({ value, label }) => [value, label],
    ),
  ) as Record<TechnicalSpecificationStatus, string>;

export const systemTechnicalSpecificationVariables =
  new Set([
    "tz.id",
    "tz.title",
    "tz.procurement_subject",
    "tz.procurement_procedure",
    "tz.legal_basis",
    "tz.internal_regulation_document",
    "tz.approval_date",
    "tz.work_start_date",
    "tz.work_end_date",
    "tz.status",
    "title",
    "procurement_subject",
    "procurement_procedure",
    "legal_basis",
    "internal_regulation_document",
    "procurement.procedure",
    "procurement.legal_basis",
    "procurement.internal_regulation_document",
    "work.start_date",
    "work.end_date",
    "approval.date",
    "approval.day",
    "approval.month",
    "approval.year",
    "counterparty.id",
    "counterparty.unp",
    "counterparty.name",
    "counterparty.full_name",
    "counterparty.short_name",
    "counterparty.legal_address",
    "contract.id",
    "contract.number",
    "contract.title",
    "contract.date",
    "contract.start_date",
    "contract.end_date",
    "contract.amount",
    "contract.currency",
    "contract.status",
    "organization.id",
    "organization.name",
    "organization.full_name",
    "organization.short_name",
    "organization.unp",
    "organization.legal_address",
    "organization.email",
    "organization.phone",
    "organization.director_name",
    "organization.director_position",
    "organization.bank_name",
    "organization.bank_account",
    "organization.bank_code",
  ]);

export function getCustomTechnicalSpecificationVariables(
  variables: string[],
): string[] {
  return variables.filter(
    (variable) =>
      !systemTechnicalSpecificationVariables.has(
        variable,
      ),
  );
}

const templateVariableLabels: Record<string, string> = {
  "tz.delivery_address": "Адрес поставки",
  "tz.delivery_period": "Срок поставки",
  "tz.quality_requirements": "Требования к качеству",
  "tz.payment_terms": "Условия оплаты",
  "tz.warranty_period": "Гарантийный срок",
  "tz.quantity": "Количество",
  "tz.measurement_unit": "Единица измерения",
};

export function getTechnicalSpecificationVariableLabel(
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
