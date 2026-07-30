import { zodResolver } from "@hookform/resolvers/zod";
import {
  FileStack,
  Plus,
  Save,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type KeyboardEvent,
} from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  ApiError,
} from "../../api/client";
import type {
  DocumentTemplate,
  DocumentTemplateType,
} from "../../types/documentTemplate";

const MAX_TEMPLATE_SIZE_BYTES = 10 * 1024 * 1024;
const TEMPLATE_VARIABLE_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)*$/;

const templateFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Укажите название шаблона")
    .max(255, "Не более 255 символов"),
  templateType: z.enum([
    "contract",
    "technical_specification",
  ]),
  description: z.string(),
  isActive: z.boolean(),
});

type TemplateFormValues = z.infer<
  typeof templateFormSchema
>;

export interface TemplateFormSubmitValues {
  name: string;
  templateType: DocumentTemplateType;
  description: string | null;
  requiredVariables: string[];
  file: File | null;
  isActive: boolean;
}

interface TemplateFormDialogProps {
  isOpen: boolean;
  template?: DocumentTemplate | null;
  onClose: () => void;
  onSubmit: (
    values: TemplateFormSubmitValues,
  ) => Promise<void>;
}

function createDefaultValues(
  template?: DocumentTemplate | null,
): TemplateFormValues {
  return {
    name: template?.name ?? "",
    templateType:
      template?.template_type ?? "contract",
    description: template?.description ?? "",
    isActive: template?.is_active ?? true,
  };
}

function normalizeVariable(value: string): string {
  const trimmed = value.trim();
  const placeholderMatch = trimmed.match(
    /^{{\s*(.*?)\s*}}$/,
  );

  return placeholderMatch?.[1]?.trim() ?? trimmed;
}

function getFileServerError(
  error: unknown,
): string | null {
  if (!(error instanceof ApiError)) {
    return null;
  }

  if (error.status === 413) {
    return "Размер шаблона превышает 10 МБ";
  }

  if (error.status !== 422) {
    return null;
  }

  const responseDetail =
    error.detail &&
    typeof error.detail === "object" &&
    "detail" in error.detail
      ? (
          error.detail as {
            detail?: unknown;
          }
        ).detail
      : null;

  if (
    responseDetail &&
    typeof responseDetail === "object"
  ) {
    const detail = responseDetail as {
      message?: unknown;
      invalid_variables?: unknown;
    };
    const invalidVariables =
      Array.isArray(detail.invalid_variables)
        ? detail.invalid_variables.filter(
            (value): value is string =>
              typeof value === "string",
          )
        : [];

    if (invalidVariables.length > 0) {
      return `${
        typeof detail.message === "string"
          ? detail.message
          : "DOCX содержит некорректные переменные"
      }: ${invalidVariables.join(", ")}`;
    }
  }

  return error.message;
}

export function TemplateFormDialog({
  isOpen,
  template,
  onClose,
  onSubmit,
}: TemplateFormDialogProps) {
  const isCreate = !template;
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [requiredVariables, setRequiredVariables] =
    useState<string[]>([]);
  const [variableInput, setVariableInput] =
    useState("");
  const [variableError, setVariableError] =
    useState<string | null>(null);
  const [fileError, setFileError] =
    useState<string | null>(null);
  const [submissionError, setSubmissionError] =
    useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: {
      errors,
      isDirty,
      isSubmitting,
    },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: createDefaultValues(template),
  });

  const hasUnsavedChanges =
    isDirty ||
    selectedFile !== null ||
    (isCreate &&
      (requiredVariables.length > 0 ||
        Boolean(variableInput.trim())));

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    reset(createDefaultValues(template));
    setSelectedFile(null);
    setRequiredVariables(
      template?.required_variables ?? [],
    );
    setVariableInput("");
    setVariableError(null);
    setFileError(null);
    setSubmissionError(null);
  }, [isOpen, reset, template]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        if (
          !hasUnsavedChanges ||
          window.confirm(
            "Закрыть форму? Несохранённые изменения будут потеряны.",
          )
        ) {
          onClose();
        }
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    hasUnsavedChanges,
    isOpen,
    isSubmitting,
    onClose,
  ]);

  if (!isOpen) {
    return null;
  }

  function requestClose() {
    if (
      hasUnsavedChanges &&
      !isSubmitting &&
      !window.confirm(
        "Закрыть форму? Несохранённые изменения будут потеряны.",
      )
    ) {
      return;
    }

    onClose();
  }

  function addVariable() {
    const normalized = normalizeVariable(variableInput);

    if (!normalized) {
      setVariableError("Введите имя переменной");
      return;
    }

    if (!TEMPLATE_VARIABLE_PATTERN.test(normalized)) {
      setVariableError(
        "Используйте латинские буквы, цифры, _, - и точки",
      );
      return;
    }

    if (requiredVariables.includes(normalized)) {
      setVariableError("Такая переменная уже добавлена");
      return;
    }

    setRequiredVariables((current) => [
      ...current,
      normalized,
    ]);
    setVariableInput("");
    setVariableError(null);
  }

  function handleVariableKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (
      event.key === "Enter" ||
      event.key === ","
    ) {
      event.preventDefault();
      addVariable();
    }
  }

  function selectFile(file: File | null) {
    setSelectedFile(file);
    setFileError(null);

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      setFileError(
        "Можно загрузить только файл формата DOCX",
      );
      return;
    }

    if (file.size > MAX_TEMPLATE_SIZE_BYTES) {
      setFileError(
        "Размер шаблона не должен превышать 10 МБ",
      );
    }
  }

  async function submit(values: TemplateFormValues) {
    setSubmissionError(null);
    setFileError(null);

    if (
      isCreate &&
      (!selectedFile ||
        !selectedFile.name
          .toLowerCase()
          .endsWith(".docx"))
    ) {
      setFileError("Выберите корректный DOCX-файл");
      return;
    }

    if (
      isCreate &&
      selectedFile &&
      selectedFile.size > MAX_TEMPLATE_SIZE_BYTES
    ) {
      setFileError(
        "Размер шаблона не должен превышать 10 МБ",
      );
      return;
    }

    try {
      await onSubmit({
        name: values.name.trim(),
        templateType: values.templateType,
        description:
          values.description.trim() || null,
        requiredVariables,
        file: selectedFile,
        isActive: values.isActive,
      });
    } catch (error) {
      const serverFileError = getFileServerError(error);

      if (isCreate && serverFileError) {
        setFileError(serverFileError);
      } else {
        setSubmissionError(
          error instanceof Error
            ? error.message
            : "Не удалось сохранить шаблон",
        );
      }
    }
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSubmitting
        ) {
          requestClose();
        }
      }}
    >
      <section
        className="dialog-card template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-dialog-title"
      >
        <div className="dialog-card__heading">
          <span className="template-dialog__icon">
            <FileStack size={22} aria-hidden="true" />
          </span>
          <div>
            <h2 id="template-dialog-title">
              {isCreate
                ? "Новый шаблон"
                : "Редактирование шаблона"}
            </h2>
            <p>
              {isCreate
                ? "Загрузите корпоративный DOCX и укажите данные шаблона."
                : "Измените название, описание или доступность шаблона."}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={requestClose}
            disabled={isSubmitting}
            aria-label="Закрыть диалог"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <form
          className="record-form"
          onSubmit={(event) => {
            void handleSubmit(submit)(event);
          }}
          noValidate
        >
          <div className="record-form__grid">
            <label className="record-field">
              <span>
                Название{" "}
                <strong aria-hidden="true">*</strong>
              </span>
              <input
                {...register("name")}
                type="text"
                maxLength={255}
                autoFocus
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && (
                <small
                  className="record-field__error"
                  role="alert"
                >
                  {errors.name.message}
                </small>
              )}
            </label>

            <label className="record-field">
              <span>
                Тип{" "}
                <strong aria-hidden="true">*</strong>
              </span>
              <select
                {...register("templateType")}
                disabled={!isCreate}
              >
                <option value="contract">
                  Договор
                </option>
                <option value="technical_specification">
                  Техническое задание
                </option>
              </select>
              {!isCreate && (
                <small className="record-field__hint">
                  Тип после создания не изменяется.
                </small>
              )}
            </label>

            <label className="record-field record-field--full">
              <span>Описание</span>
              <textarea
                {...register("description")}
                rows={3}
              />
            </label>

            {isCreate ? (
              <>
                <div className="record-field record-field--full">
                  <span>Обязательные переменные</span>
                  <div className="template-variable-entry">
                    <input
                      type="text"
                      value={variableInput}
                      onChange={(event) => {
                        setVariableInput(
                          event.target.value,
                        );
                        setVariableError(null);
                      }}
                      onKeyDown={handleVariableKeyDown}
                      placeholder="Например, contract.number"
                      aria-label="Имя переменной"
                      aria-invalid={Boolean(variableError)}
                    />
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={addVariable}
                    >
                      <Plus size={17} aria-hidden="true" />
                      Добавить
                    </button>
                  </div>
                  {variableError && (
                    <small
                      className="record-field__error"
                      role="alert"
                    >
                      {variableError}
                    </small>
                  )}
                  {requiredVariables.length > 0 && (
                    <div
                      className="template-variable-chips"
                      aria-label="Обязательные переменные"
                    >
                      {requiredVariables.map((variable) => (
                        <span key={variable}>
                          {variable}
                          <button
                            type="button"
                            onClick={() =>
                              setRequiredVariables(
                                (current) =>
                                  current.filter(
                                    (item) =>
                                      item !== variable,
                                  ),
                              )
                            }
                            aria-label={`Удалить переменную ${variable}`}
                          >
                            <X
                              size={13}
                              aria-hidden="true"
                            />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <small className="record-field__hint">
                    Переменные из DOCX будут обнаружены
                    сервером и добавлены автоматически.
                  </small>
                </div>

                <label className="record-field record-field--full">
                  <span>
                    Файл DOCX{" "}
                    <strong aria-hidden="true">*</strong>
                  </span>
                  <input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) =>
                      selectFile(
                        event.target.files?.[0] ?? null,
                      )
                    }
                    aria-invalid={Boolean(fileError)}
                  />
                  {selectedFile && !fileError && (
                    <small className="record-field__hint">
                      Выбран файл: {selectedFile.name}
                    </small>
                  )}
                  {fileError ? (
                    <small
                      className="record-field__error"
                      role="alert"
                    >
                      {fileError}
                    </small>
                  ) : (
                    <small className="record-field__hint">
                      Только корректный DOCX, не более
                      10 МБ.
                    </small>
                  )}
                </label>
              </>
            ) : (
              <>
                <div className="template-file-summary">
                  <span>Исходный файл</span>
                  <strong>{template.file_name}</strong>
                  <small>
                    Версия {template.version}. Для замены
                    файла создайте новый шаблон.
                  </small>
                </div>

                <label className="records-toggle template-active-toggle">
                  <input
                    {...register("isActive")}
                    type="checkbox"
                  />
                  <span aria-hidden="true" />
                  Доступен для новых документов
                </label>
              </>
            )}
          </div>

          {submissionError && (
            <div className="form-alert" role="alert">
              {submissionError}
            </div>
          )}

          <div className="dialog-card__actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={requestClose}
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
                : isCreate
                  ? "Создать шаблон"
                  : "Сохранить"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
