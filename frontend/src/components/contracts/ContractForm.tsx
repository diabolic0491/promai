import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  FileText,
  Landmark,
  Save,
  UsersRound,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { useBlocker } from "react-router-dom";
import { z } from "zod";

import { ApiError } from "../../api/client";
import {
  contractRoleOptions,
  getTemplateVariableLabel,
  pairedContractRoles,
} from "../../constants/contracts";
import type {
  Contract,
  ContractFormData,
  ContractPartyRole,
} from "../../types/contract";
import type {
  Counterparty,
} from "../../types/counterparty";
import type {
  DocumentTemplate,
} from "../../types/documentTemplate";
import {
  buildNestedFormData,
  flattenFormData,
  getCustomTemplateVariables,
  getNestedValue,
} from "../../utils/contractFormData";

const contractSchema = z
  .object({
    counterpartyId: z
      .string()
      .min(1, "Выберите контрагента"),
    templateId: z.string(),
    number: z
      .string()
      .trim()
      .min(1, "Укажите номер договора")
      .max(100, "Не более 100 символов"),
    title: z
      .string()
      .trim()
      .min(1, "Укажите название договора")
      .max(500, "Не более 500 символов"),
    contractDate: z
      .string()
      .min(1, "Укажите дату договора"),
    startDate: z.string(),
    endDate: z.string(),
    amount: z
      .string()
      .trim()
      .refine(
        (value) =>
          value === "" ||
          /^\d{1,16}(?:\.\d{1,2})?$/.test(value),
        "До 16 цифр до точки и 2 после",
      ),
    currency: z
      .string()
      .trim()
      .regex(
        /^[A-Za-zА-Яа-яЁё]{3}$/,
        "Код валюты должен содержать 3 буквы",
      ),
    ownerRole: z.enum([
      "supplier",
      "buyer",
      "contractor",
      "customer",
      "executor",
      "landlord",
      "tenant",
      "lender",
      "borrower",
      "other",
    ]),
    counterpartyRole: z.enum([
      "supplier",
      "buyer",
      "contractor",
      "customer",
      "executor",
      "landlord",
      "tenant",
      "lender",
      "borrower",
      "other",
    ]),
    notes: z.string(),
  })
  .superRefine((values, context) => {
    if (
      values.startDate &&
      values.endDate &&
      values.endDate < values.startDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message:
          "Дата окончания не может быть раньше даты начала",
      });
    }
  });

export type ContractFormValues = z.infer<
  typeof contractSchema
>;

export interface ContractFormSubmitValues {
  counterpartyId: number;
  templateId: number | null;
  number: string;
  title: string;
  contractDate: string;
  startDate: string | null;
  endDate: string | null;
  amount: string | null;
  currency: string;
  ownerRole: ContractPartyRole;
  counterpartyRole: ContractPartyRole;
  notes: string | null;
  formData: ContractFormData;
}

interface ContractFormProps {
  mode: "create" | "edit";
  contract?: Contract;
  initialCounterpartyId?: number;
  counterparties: Counterparty[];
  templates: DocumentTemplate[];
  onCancel: () => void;
  onSubmit: (
    values: ContractFormSubmitValues,
  ) => Promise<void>;
}

function localToday(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset)
    .toISOString()
    .slice(0, 10);
}

function createDefaultValues(
  contract?: Contract,
  initialCounterpartyId?: number,
): ContractFormValues {
  return {
    counterpartyId: contract
      ? String(contract.counterparty_id)
      : initialCounterpartyId
        ? String(initialCounterpartyId)
        : "",
    templateId: contract?.template_id
      ? String(contract.template_id)
      : "",
    number: contract?.number ?? "",
    title: contract?.title ?? "",
    contractDate:
      contract?.contract_date ?? localToday(),
    startDate: contract?.start_date ?? "",
    endDate: contract?.end_date ?? "",
    amount: contract?.amount ?? "",
    currency: contract?.currency ?? "BYN",
    ownerRole: contract?.owner_role ?? "supplier",
    counterpartyRole:
      contract?.counterparty_role ?? "buyer",
    notes: contract?.notes ?? "",
  };
}

function createInitialTemplateValues(
  contract?: Contract,
): Record<string, string> {
  if (!contract) {
    return {};
  }

  return Object.fromEntries(
    flattenFormData(contract.form_data),
  );
}

export function ContractForm({
  mode,
  contract,
  initialCounterpartyId,
  counterparties,
  templates,
  onCancel,
  onSubmit,
}: ContractFormProps) {
  const [
    templateValues,
    setTemplateValues,
  ] = useState<Record<string, string>>(() =>
    createInitialTemplateValues(contract),
  );
  const [templateErrors, setTemplateErrors] =
    useState<Record<string, string>>({});
  const [templateValuesDirty, setTemplateValuesDirty] =
    useState(false);
  const [submissionError, setSubmissionError] =
    useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: {
      errors,
      isDirty,
      isSubmitting,
    },
  } = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: createDefaultValues(
      contract,
      initialCounterpartyId,
    ),
  });

  useEffect(() => {
    reset(
      createDefaultValues(
        contract,
        initialCounterpartyId,
      ),
    );
    setTemplateValues(
      createInitialTemplateValues(contract),
    );
    setTemplateErrors({});
    setTemplateValuesDirty(false);
  }, [contract, initialCounterpartyId, reset]);

  const selectedTemplateId = watch("templateId");
  const selectedCounterpartyId =
    watch("counterpartyId");
  const selectedTemplate = templates.find(
    (template) =>
      template.id === Number(selectedTemplateId),
  );
  const currentTemplateIsUnavailable =
    Boolean(contract?.template_id) &&
    !templates.some(
      (template) =>
        template.id === contract?.template_id,
    );

  const customVariables = useMemo(() => {
    if (selectedTemplate) {
      return getCustomTemplateVariables(
        selectedTemplate.required_variables,
      );
    }

    if (
      currentTemplateIsUnavailable &&
      selectedTemplateId ===
        String(contract?.template_id)
    ) {
      return flattenFormData(
        contract?.form_data ?? {},
      ).map(([variable]) => variable);
    }

    return [];
  }, [
    contract,
    currentTemplateIsUnavailable,
    selectedTemplate,
    selectedTemplateId,
  ]);

  const selectedCounterparty = counterparties.find(
    (counterparty) =>
      counterparty.id === Number(selectedCounterpartyId),
  );
  const hasUnsavedChanges =
    (isDirty || templateValuesDirty) && !isSubmitting;
  const blocker = useBlocker(hasUnsavedChanges);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    function handleBeforeUnload(
      event: BeforeUnloadEvent,
    ) {
      event.preventDefault();
    }

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload,
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload,
      );
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (blocker.state !== "blocked") {
      return;
    }

    if (
      window.confirm(
        "Покинуть форму? Несохранённые изменения будут потеряны.",
      )
    ) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

  function updateOwnerRole(
    role: ContractPartyRole,
  ) {
    setValue("ownerRole", role, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(
      "counterpartyRole",
      pairedContractRoles[role] ?? "other",
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  }

  function updateTemplateValue(
    variable: string,
    value: string,
  ) {
    setTemplateValues((current) => ({
      ...current,
      [variable]: value,
    }));
    setTemplateValuesDirty(true);
    setTemplateErrors((current) => {
      if (!current[variable]) {
        return current;
      }

      const next = { ...current };
      delete next[variable];
      return next;
    });
  }

  function validateTemplateValues(): boolean {
    const nextErrors: Record<string, string> = {};

    customVariables.forEach((variable) => {
      const value =
        templateValues[variable] ??
        getNestedValue(
          contract?.form_data ?? {},
          variable,
        );

      if (!value.trim()) {
        nextErrors[variable] =
          "Заполните обязательную переменную шаблона";
      }
    });

    setTemplateErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(values: ContractFormValues) {
    setSubmissionError(null);

    if (!validateTemplateValues()) {
      return;
    }

    try {
      await onSubmit({
        counterpartyId: Number(values.counterpartyId),
        templateId: values.templateId
          ? Number(values.templateId)
          : null,
        number: values.number.trim(),
        title: values.title.trim(),
        contractDate: values.contractDate,
        startDate: values.startDate || null,
        endDate: values.endDate || null,
        amount: values.amount.trim() || null,
        currency: values.currency.trim().toUpperCase(),
        ownerRole: values.ownerRole,
        counterpartyRole: values.counterpartyRole,
        notes: values.notes.trim() || null,
        formData: buildNestedFormData(
          Object.fromEntries(
            customVariables.map((variable) => [
              variable,
              templateValues[variable] ??
                getNestedValue(
                  contract?.form_data ?? {},
                  variable,
                ),
            ]),
          ),
        ),
      });
    } catch (error) {
      setSubmissionError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Не удалось сохранить договор",
      );
    }
  }

  return (
    <form
      className="contract-form"
      onSubmit={(event) => {
        void handleSubmit(submit)(event);
      }}
      noValidate
    >
      <section className="contract-form-section">
        <div className="contract-form-section__heading">
          <span>
            <UsersRound size={20} aria-hidden="true" />
          </span>
          <div>
            <small>Стороны</small>
            <h2>Участники договора</h2>
          </div>
        </div>

        <div className="contract-parties-grid">
          <div className="contract-party-card">
            <span className="contract-party-card__number">
              1
            </span>
            <div>
              <small>Наша организация</small>
              <strong>Профиль организации PromAI</strong>
            </div>
            <label className="record-field">
              <span>
                Роль нашей организации{" "}
                <strong aria-hidden="true">*</strong>
              </span>
              <select
                value={watch("ownerRole")}
                onChange={(event) =>
                  updateOwnerRole(
                    event.target
                      .value as ContractPartyRole,
                  )
                }
                disabled={isSubmitting}
              >
                {contractRoleOptions.map((role) => (
                  <option
                    key={role.value}
                    value={role.value}
                  >
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="contract-party-card">
            <span className="contract-party-card__number">
              2
            </span>
            <div>
              <small>Контрагент</small>
              <strong>
                {selectedCounterparty?.short_name ||
                  selectedCounterparty?.name ||
                  contract?.counterparty_name ||
                  "Выберите организацию"}
              </strong>
            </div>
            <label className="record-field">
              <span>
                Контрагент{" "}
                <strong aria-hidden="true">*</strong>
              </span>
              <select
                {...register("counterpartyId")}
                disabled={
                  isSubmitting || mode === "edit"
                }
                aria-invalid={Boolean(
                  errors.counterpartyId,
                )}
              >
                <option value="">
                  Выберите контрагента
                </option>
                {counterparties.map((counterparty) => (
                  <option
                    key={counterparty.id}
                    value={counterparty.id}
                  >
                    {counterparty.short_name ||
                      counterparty.name}{" "}
                    — УНП {counterparty.unp}
                  </option>
                ))}
              </select>
              {errors.counterpartyId && (
                <small
                  className="record-field__error"
                  role="alert"
                >
                  {errors.counterpartyId.message}
                </small>
              )}
            </label>
            <label className="record-field">
              <span>
                Роль контрагента{" "}
                <strong aria-hidden="true">*</strong>
              </span>
              <select
                {...register("counterpartyRole")}
                disabled={isSubmitting}
              >
                {contractRoleOptions.map((role) => (
                  <option
                    key={role.value}
                    value={role.value}
                  >
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="contract-form-section">
        <div className="contract-form-section__heading">
          <span>
            <FileText size={20} aria-hidden="true" />
          </span>
          <div>
            <small>Реквизиты</small>
            <h2>Основные сведения</h2>
          </div>
        </div>

        <div className="contract-form-grid">
          <label className="record-field">
            <span>
              Номер договора{" "}
              <strong aria-hidden="true">*</strong>
            </span>
            <input
              {...register("number")}
              type="text"
              maxLength={100}
              autoFocus
              aria-invalid={Boolean(errors.number)}
            />
            {errors.number && (
              <small
                className="record-field__error"
                role="alert"
              >
                {errors.number.message}
              </small>
            )}
          </label>

          <label className="record-field contract-form-grid__wide">
            <span>
              Название{" "}
              <strong aria-hidden="true">*</strong>
            </span>
            <input
              {...register("title")}
              type="text"
              maxLength={500}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title && (
              <small
                className="record-field__error"
                role="alert"
              >
                {errors.title.message}
              </small>
            )}
          </label>

          <label className="record-field">
            <span>
              Шаблон DOCX
              <small className="record-field__hint">
                {" "}
                — необязательно
              </small>
            </span>
            <select
              {...register("templateId")}
              disabled={isSubmitting}
            >
              <option value="">Без шаблона</option>
              {currentTemplateIsUnavailable &&
                contract?.template_id && (
                  <option
                    value={contract.template_id}
                  >
                    {contract.template_name ||
                      `Шаблон #${contract.template_id}`}{" "}
                    (недоступен для новых договоров)
                  </option>
                )}
              {templates.map((template) => (
                <option
                  key={template.id}
                  value={template.id}
                >
                  {template.name} · версия{" "}
                  {template.version}
                </option>
              ))}
            </select>
          </label>

          <label className="record-field">
            <span>
              Дата договора{" "}
              <strong aria-hidden="true">*</strong>
            </span>
            <input
              {...register("contractDate")}
              type="date"
              aria-invalid={Boolean(
                errors.contractDate,
              )}
            />
            {errors.contractDate && (
              <small
                className="record-field__error"
                role="alert"
              >
                {errors.contractDate.message}
              </small>
            )}
          </label>

          <label className="record-field">
            <span>Начало действия</span>
            <input
              {...register("startDate")}
              type="date"
            />
          </label>

          <label className="record-field">
            <span>Окончание действия</span>
            <input
              {...register("endDate")}
              type="date"
              aria-invalid={Boolean(errors.endDate)}
            />
            {errors.endDate && (
              <small
                className="record-field__error"
                role="alert"
              >
                {errors.endDate.message}
              </small>
            )}
          </label>
        </div>
      </section>

      <section className="contract-form-section">
        <div className="contract-form-section__heading">
          <span>
            <Landmark size={20} aria-hidden="true" />
          </span>
          <div>
            <small>Расчёты</small>
            <h2>Стоимость и примечания</h2>
          </div>
        </div>

        <div className="contract-form-grid">
          <label className="record-field">
            <span>Сумма</span>
            <input
              {...register("amount")}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              aria-invalid={Boolean(errors.amount)}
            />
            {errors.amount && (
              <small
                className="record-field__error"
                role="alert"
              >
                {errors.amount.message}
              </small>
            )}
          </label>

          <label className="record-field">
            <span>
              Валюта{" "}
              <strong aria-hidden="true">*</strong>
            </span>
            <input
              {...register("currency")}
              type="text"
              maxLength={3}
              aria-invalid={Boolean(errors.currency)}
            />
            {errors.currency && (
              <small
                className="record-field__error"
                role="alert"
              >
                {errors.currency.message}
              </small>
            )}
          </label>

          <label className="record-field contract-form-grid__full">
            <span>Внутреннее примечание</span>
            <textarea
              {...register("notes")}
              rows={4}
            />
          </label>
        </div>
      </section>

      {selectedTemplateId && (
        <section className="contract-form-section">
          <div className="contract-form-section__heading">
            <span>
              <CalendarDays
                size={20}
                aria-hidden="true"
              />
            </span>
            <div>
              <small>Переменные шаблона</small>
              <h2>Дополнительные данные</h2>
            </div>
          </div>

          {customVariables.length === 0 ? (
            <div className="contract-form-note">
              Все обязательные переменные этого шаблона
              заполняются автоматически из договора,
              контрагента и профиля организации.
            </div>
          ) : (
            <div className="contract-form-grid">
              {customVariables.map((variable) => (
                <label
                  key={variable}
                  className="record-field"
                >
                  <span>
                    {getTemplateVariableLabel(variable)}{" "}
                    <strong aria-hidden="true">*</strong>
                  </span>
                  <input
                    type="text"
                    value={
                      templateValues[variable] ??
                      getNestedValue(
                        contract?.form_data ?? {},
                        variable,
                      )
                    }
                    onChange={(event) =>
                      updateTemplateValue(
                        variable,
                        event.target.value,
                      )
                    }
                    aria-invalid={Boolean(
                      templateErrors[variable],
                    )}
                    aria-describedby={`${variable}-hint`}
                  />
                  <small
                    id={`${variable}-hint`}
                    className={
                      templateErrors[variable]
                        ? "record-field__error"
                        : "record-field__hint"
                    }
                    role={
                      templateErrors[variable]
                        ? "alert"
                        : undefined
                    }
                  >
                    {templateErrors[variable] ||
                      `Переменная: ${variable}`}
                  </small>
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      {submissionError && (
        <div className="form-alert" role="alert">
          {submissionError}
        </div>
      )}

      <div className="contract-form-actions">
        <button
          type="button"
          className="button button--secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Отмена
        </button>
        <button
          type="submit"
          className="button button--primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span
              className="button-spinner"
              aria-hidden="true"
            />
          ) : (
            <Save size={18} aria-hidden="true" />
          )}
          {isSubmitting
            ? "Сохраняем…"
            : mode === "create"
              ? "Создать договор"
              : "Сохранить изменения"}
        </button>
      </div>
    </form>
  );
}
