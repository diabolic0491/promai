import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  Link2,
  Save,
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
  getCustomTechnicalSpecificationVariables,
  getTechnicalSpecificationVariableLabel,
} from "../../constants/technicalSpecifications";
import type {
  Contract,
} from "../../types/contract";
import type {
  Counterparty,
} from "../../types/counterparty";
import type {
  DocumentTemplate,
} from "../../types/documentTemplate";
import type {
  TechnicalSpecification,
  TechnicalSpecificationFormData,
} from "../../types/technicalSpecification";
import {
  buildNestedFormData,
  flattenFormData,
  getNestedValue,
} from "../../utils/contractFormData";

const technicalSpecificationSchema = z
  .object({
    counterpartyId: z
      .string()
      .min(1, "Выберите контрагента"),
    contractId: z.string(),
    templateId: z
      .string()
      .min(1, "Выберите шаблон"),
    title: z
      .string()
      .trim()
      .min(1, "Укажите название ТЗ")
      .max(500, "Не более 500 символов"),
    procurementSubject: z
      .string()
      .trim()
      .min(1, "Укажите предмет закупки")
      .max(1000, "Не более 1000 символов"),
    procurementProcedure: z
      .string()
      .trim()
      .min(1, "Укажите процедуру закупки")
      .max(255, "Не более 255 символов"),
    legalBasis: z
      .string()
      .trim()
      .min(1, "Укажите правовое основание"),
    internalRegulationDocument: z
      .string()
      .trim()
      .min(1, "Укажите внутренний регламент"),
    approvalDate: z.string(),
    workStartDate: z.string(),
    workEndDate: z.string(),
  })
  .superRefine((values, context) => {
    if (
      values.workStartDate &&
      values.workEndDate &&
      values.workEndDate < values.workStartDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workEndDate"],
        message:
          "Дата окончания не может быть раньше даты начала",
      });
    }
  });

type TechnicalSpecificationFormValues = z.infer<
  typeof technicalSpecificationSchema
>;

export interface TechnicalSpecificationFormSubmitValues {
  counterpartyId: number;
  contractId: number | null;
  templateId: number;
  title: string;
  procurementSubject: string;
  procurementProcedure: string;
  legalBasis: string;
  internalRegulationDocument: string;
  approvalDate: string | null;
  workStartDate: string | null;
  workEndDate: string | null;
  formData: TechnicalSpecificationFormData;
}

interface TechnicalSpecificationFormProps {
  mode: "create" | "edit";
  technicalSpecification?: TechnicalSpecification;
  initialCounterpartyId?: number;
  initialContractId?: number;
  counterparties: Counterparty[];
  contracts: Contract[];
  templates: DocumentTemplate[];
  onCancel: () => void;
  onSubmit: (
    values: TechnicalSpecificationFormSubmitValues,
  ) => Promise<void>;
}

function createDefaultValues(
  technicalSpecification?: TechnicalSpecification,
  initialCounterpartyId?: number,
  initialContractId?: number,
): TechnicalSpecificationFormValues {
  return {
    counterpartyId: technicalSpecification
      ? String(
          technicalSpecification.counterparty_id,
        )
      : initialCounterpartyId
        ? String(initialCounterpartyId)
        : "",
    contractId:
      technicalSpecification?.contract_id !== null &&
      technicalSpecification?.contract_id !== undefined
        ? String(technicalSpecification.contract_id)
        : initialContractId
          ? String(initialContractId)
          : "",
    templateId: technicalSpecification
      ? String(technicalSpecification.template_id)
      : "",
    title: technicalSpecification?.title ?? "",
    procurementSubject:
      technicalSpecification?.procurement_subject ?? "",
    procurementProcedure:
      technicalSpecification?.procurement_procedure ??
      "Открытый конкурс",
    legalBasis:
      technicalSpecification?.legal_basis ?? "",
    internalRegulationDocument:
      technicalSpecification
        ?.internal_regulation_document ?? "",
    approvalDate:
      technicalSpecification?.approval_date ?? "",
    workStartDate:
      technicalSpecification?.work_start_date ?? "",
    workEndDate:
      technicalSpecification?.work_end_date ?? "",
  };
}

function createInitialTemplateValues(
  technicalSpecification?: TechnicalSpecification,
): Record<string, string> {
  if (!technicalSpecification) {
    return {};
  }

  return Object.fromEntries(
    flattenFormData(technicalSpecification.form_data),
  );
}

export function TechnicalSpecificationForm({
  mode,
  technicalSpecification,
  initialCounterpartyId,
  initialContractId,
  counterparties,
  contracts,
  templates,
  onCancel,
  onSubmit,
}: TechnicalSpecificationFormProps) {
  const [templateValues, setTemplateValues] =
    useState<Record<string, string>>(() =>
      createInitialTemplateValues(
        technicalSpecification,
      ),
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
  } = useForm<TechnicalSpecificationFormValues>({
    resolver: zodResolver(
      technicalSpecificationSchema,
    ),
    defaultValues: createDefaultValues(
      technicalSpecification,
      initialCounterpartyId,
      initialContractId,
    ),
  });

  useEffect(() => {
    reset(
      createDefaultValues(
        technicalSpecification,
        initialCounterpartyId,
        initialContractId,
      ),
    );
    setTemplateValues(
      createInitialTemplateValues(
        technicalSpecification,
      ),
    );
    setTemplateErrors({});
    setTemplateValuesDirty(false);
  }, [
    initialCounterpartyId,
    initialContractId,
    reset,
    technicalSpecification,
  ]);

  const selectedCounterpartyId =
    watch("counterpartyId");
  const selectedContractId = watch("contractId");
  const selectedTemplateId = watch("templateId");
  const selectedTemplate = templates.find(
    (template) =>
      template.id === Number(selectedTemplateId),
  );
  const currentTemplateIsUnavailable =
    technicalSpecification !== undefined &&
    !templates.some(
      (template) =>
        template.id ===
        technicalSpecification.template_id,
    );
  const availableContracts = contracts.filter(
    (contract) =>
      contract.counterparty_id ===
        Number(selectedCounterpartyId) &&
      (!contract.is_archived ||
        contract.id ===
          technicalSpecification?.contract_id),
  );
  const customVariables = useMemo(
    () =>
      selectedTemplate
        ? getCustomTechnicalSpecificationVariables(
            selectedTemplate.required_variables,
          )
        : [],
    [selectedTemplate],
  );
  const selectedCounterparty = counterparties.find(
    (counterparty) =>
      counterparty.id ===
      Number(selectedCounterpartyId),
  );
  const selectedContract = availableContracts.find(
    (contract) =>
      contract.id === Number(selectedContractId),
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

  function updateCounterparty(value: string) {
    setValue("counterpartyId", value, {
      shouldDirty: true,
      shouldValidate: true,
    });

    const contractStillMatches = contracts.some(
      (contract) =>
        contract.id === Number(selectedContractId) &&
        contract.counterparty_id === Number(value) &&
        !contract.is_archived,
    );

    if (!contractStillMatches) {
      setValue("contractId", "", {
        shouldDirty: true,
      });
    }
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
          technicalSpecification?.form_data ?? {},
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

  async function submit(
    values: TechnicalSpecificationFormValues,
  ) {
    setSubmissionError(null);

    if (!selectedTemplate) {
      setSubmissionError(
        "Выберите активный шаблон технического задания",
      );
      return;
    }

    if (!validateTemplateValues()) {
      return;
    }

    try {
      await onSubmit({
        counterpartyId: Number(values.counterpartyId),
        contractId: values.contractId
          ? Number(values.contractId)
          : null,
        templateId: Number(values.templateId),
        title: values.title.trim(),
        procurementSubject:
          values.procurementSubject.trim(),
        procurementProcedure:
          values.procurementProcedure.trim(),
        legalBasis: values.legalBasis.trim(),
        internalRegulationDocument:
          values.internalRegulationDocument.trim(),
        approvalDate: values.approvalDate || null,
        workStartDate: values.workStartDate || null,
        workEndDate: values.workEndDate || null,
        formData: buildNestedFormData(
          Object.fromEntries(
            customVariables.map((variable) => [
              variable,
              templateValues[variable] ??
                getNestedValue(
                  technicalSpecification?.form_data ??
                    {},
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
            : "Не удалось сохранить техническое задание",
      );
    }
  }

  return (
    <form
      className="contract-form technical-specification-form"
      onSubmit={(event) => {
        void handleSubmit(submit)(event);
      }}
      noValidate
    >
      <section className="contract-form-section">
        <div className="contract-form-section__heading">
          <span>
            <Link2 size={20} aria-hidden="true" />
          </span>
          <div>
            <small>Связи</small>
            <h2>Контрагент, договор и шаблон</h2>
          </div>
        </div>

        <div className="contract-form-grid">
          <label className="record-field">
            <span>
              Контрагент{" "}
              <strong aria-hidden="true">*</strong>
            </span>
            <select
              value={selectedCounterpartyId}
              onChange={(event) =>
                updateCounterparty(event.target.value)
              }
              disabled={isSubmitting}
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
            <span>Связанный договор</span>
            <select
              {...register("contractId")}
              disabled={
                isSubmitting || !selectedCounterpartyId
              }
            >
              <option value="">Без договора</option>
              {availableContracts.map((contract) => (
                <option
                  key={contract.id}
                  value={contract.id}
                >
                  № {contract.number} — {contract.title}
                </option>
              ))}
            </select>
            <small className="record-field__hint">
              Показываются только договоры выбранного
              контрагента.
            </small>
          </label>

          <label className="record-field">
            <span>
              Шаблон DOCX{" "}
              <strong aria-hidden="true">*</strong>
            </span>
            <select
              {...register("templateId")}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.templateId)}
            >
              <option value="">Выберите шаблон</option>
              {currentTemplateIsUnavailable &&
                technicalSpecification && (
                  <option
                    value={
                      technicalSpecification.template_id
                    }
                    disabled
                  >
                    {technicalSpecification.template_name}{" "}
                    (недоступен — выберите активный)
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
            {errors.templateId && (
              <small
                className="record-field__error"
                role="alert"
              >
                {errors.templateId.message}
              </small>
            )}
            {currentTemplateIsUnavailable &&
              selectedTemplateId ===
                String(
                  technicalSpecification?.template_id,
                ) && (
                <small className="record-field__error">
                  Текущий шаблон выключен или
                  архивирован. Для сохранения выберите
                  активный шаблон.
                </small>
              )}
          </label>
        </div>

        {(selectedCounterparty ||
          selectedContract) && (
          <div className="technical-form-links">
            {selectedCounterparty && (
              <span>
                Контрагент:{" "}
                <strong>
                  {selectedCounterparty.short_name ||
                    selectedCounterparty.name}
                </strong>
              </span>
            )}
            {selectedContract && (
              <span>
                Договор:{" "}
                <strong>
                  № {selectedContract.number}
                </strong>
              </span>
            )}
          </div>
        )}
      </section>

      <section className="contract-form-section">
        <div className="contract-form-section__heading">
          <span>
            <ClipboardList
              size={20}
              aria-hidden="true"
            />
          </span>
          <div>
            <small>Содержание</small>
            <h2>Основные сведения</h2>
          </div>
        </div>

        <div className="contract-form-grid">
          <label className="record-field contract-form-grid__full">
            <span>
              Название ТЗ{" "}
              <strong aria-hidden="true">*</strong>
            </span>
            <input
              {...register("title")}
              type="text"
              maxLength={500}
              autoFocus
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

          <label className="record-field contract-form-grid__wide">
            <span>
              Предмет закупки{" "}
              <strong aria-hidden="true">*</strong>
            </span>
            <textarea
              {...register("procurementSubject")}
              rows={3}
              maxLength={1000}
              aria-invalid={Boolean(
                errors.procurementSubject,
              )}
            />
            {errors.procurementSubject && (
              <small
                className="record-field__error"
                role="alert"
              >
                {errors.procurementSubject.message}
              </small>
            )}
          </label>

          <label className="record-field">
            <span>
              Процедура закупки{" "}
              <strong aria-hidden="true">*</strong>
            </span>
            <input
              {...register("procurementProcedure")}
              type="text"
              maxLength={255}
              aria-invalid={Boolean(
                errors.procurementProcedure,
              )}
            />
            {errors.procurementProcedure && (
              <small
                className="record-field__error"
                role="alert"
              >
                {errors.procurementProcedure.message}
              </small>
            )}
          </label>

          <label className="record-field contract-form-grid__wide">
            <span>
              Правовое основание{" "}
              <strong aria-hidden="true">*</strong>
            </span>
            <textarea
              {...register("legalBasis")}
              rows={4}
              aria-invalid={Boolean(errors.legalBasis)}
            />
            {errors.legalBasis && (
              <small
                className="record-field__error"
                role="alert"
              >
                {errors.legalBasis.message}
              </small>
            )}
          </label>

          <label className="record-field contract-form-grid__wide">
            <span>
              Внутренний документ-регламент{" "}
              <strong aria-hidden="true">*</strong>
            </span>
            <textarea
              {...register(
                "internalRegulationDocument",
              )}
              rows={4}
              aria-invalid={Boolean(
                errors.internalRegulationDocument,
              )}
            />
            {errors.internalRegulationDocument && (
              <small
                className="record-field__error"
                role="alert"
              >
                {
                  errors.internalRegulationDocument
                    .message
                }
              </small>
            )}
          </label>
        </div>
      </section>

      <section className="contract-form-section">
        <div className="contract-form-section__heading">
          <span>
            <CalendarDays
              size={20}
              aria-hidden="true"
            />
          </span>
          <div>
            <small>Сроки</small>
            <h2>Утверждение и период работ</h2>
          </div>
        </div>

        <div className="contract-form-grid">
          <label className="record-field">
            <span>Дата утверждения</span>
            <input
              {...register("approvalDate")}
              type="date"
            />
          </label>

          <label className="record-field">
            <span>Начало работ</span>
            <input
              {...register("workStartDate")}
              type="date"
            />
          </label>

          <label className="record-field">
            <span>Окончание работ</span>
            <input
              {...register("workEndDate")}
              type="date"
              aria-invalid={Boolean(errors.workEndDate)}
            />
            {errors.workEndDate && (
              <small
                className="record-field__error"
                role="alert"
              >
                {errors.workEndDate.message}
              </small>
            )}
          </label>
        </div>
      </section>

      {selectedTemplateId && (
        <section className="contract-form-section">
          <div className="contract-form-section__heading">
            <span>
              <FileText size={20} aria-hidden="true" />
            </span>
            <div>
              <small>Переменные шаблона</small>
              <h2>Дополнительные данные</h2>
            </div>
          </div>

          {customVariables.length === 0 ? (
            <div className="contract-form-note">
              Все обязательные переменные этого шаблона
              заполняются автоматически из ТЗ,
              контрагента, договора и профиля
              организации.
            </div>
          ) : (
            <div className="contract-form-grid">
              {customVariables.map((variable) => (
                <label
                  key={variable}
                  className="record-field"
                >
                  <span>
                    {getTechnicalSpecificationVariableLabel(
                      variable,
                    )}{" "}
                    <strong aria-hidden="true">*</strong>
                  </span>
                  <input
                    type="text"
                    value={
                      templateValues[variable] ??
                      getNestedValue(
                        technicalSpecification?.form_data ??
                          {},
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
                  />
                  <small
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
              ? "Создать ТЗ"
              : "Сохранить изменения"}
        </button>
      </div>
    </form>
  );
}
