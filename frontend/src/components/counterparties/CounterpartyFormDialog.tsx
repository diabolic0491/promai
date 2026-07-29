import { zodResolver } from "@hookform/resolvers/zod";
import { Save, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "../../api/client";
import type {
  Counterparty,
} from "../../types/counterparty";

const counterpartySchema = z.object({
  unp: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "УНП должен содержать 9 цифр"),
  name: z
    .string()
    .trim()
    .min(1, "Укажите полное наименование")
    .max(500, "Не более 500 символов"),
  shortName: z
    .string()
    .trim()
    .max(255, "Не более 255 символов"),
  legalAddress: z
    .string()
    .trim()
    .max(500, "Не более 500 символов"),
});

export type CounterpartyFormValues = z.infer<
  typeof counterpartySchema
>;

interface CounterpartyFormDialogProps {
  mode: "create" | "edit";
  counterparty?: Counterparty;
  onClose: () => void;
  onSubmit: (
    values: CounterpartyFormValues,
  ) => Promise<void>;
}

export function CounterpartyFormDialog({
  mode,
  counterparty,
  onClose,
  onSubmit,
}: CounterpartyFormDialogProps) {
  const titleId = `counterparty-${mode}-title`;
  const closeButtonRef =
    useRef<HTMLButtonElement>(null);
  const [submissionError, setSubmissionError] =
    useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: {
      errors,
      isDirty,
      isSubmitting,
    },
  } = useForm<CounterpartyFormValues>({
    resolver: zodResolver(counterpartySchema),
    defaultValues: {
      unp: counterparty?.unp ?? "",
      name: counterparty?.name ?? "",
      shortName: counterparty?.short_name ?? "",
      legalAddress:
        counterparty?.legal_address ?? "",
    },
  });

  function requestClose() {
    if (
      isDirty &&
      !isSubmitting &&
      !window.confirm(
        "Закрыть форму? Несохранённые изменения будут потеряны.",
      )
    ) {
      return;
    }

    onClose();
  }

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        requestClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  });

  async function submit(
    values: CounterpartyFormValues,
  ) {
    setSubmissionError(null);

    try {
      await onSubmit(values);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        mode === "create"
      ) {
        setError("unp", {
          type: "server",
          message: error.message,
        });
        return;
      }

      setSubmissionError(
        error instanceof ApiError
          ? error.message
          : "Не удалось сохранить контрагента",
      );
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
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="dialog-card__heading">
          <div>
            <span className="section-kicker">
              {mode === "create"
                ? "Новая запись"
                : "Редактирование"}
            </span>
            <h2 id={titleId}>
              {mode === "create"
                ? "Добавить контрагента"
                : "Изменить реквизиты"}
            </h2>
            <p>
              {mode === "create"
                ? "УНП после создания изменить нельзя."
                : "УНП доступен только для чтения."}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button"
            onClick={requestClose}
            disabled={isSubmitting}
            aria-label="Закрыть форму"
          >
            <X size={20} aria-hidden="true" />
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
                УНП <strong aria-hidden="true">*</strong>
              </span>
              <input
                {...register("unp")}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={9}
                readOnly={mode === "edit"}
                aria-invalid={Boolean(errors.unp)}
                aria-describedby={
                  errors.unp
                    ? "counterparty-unp-error"
                    : undefined
                }
                autoFocus={mode === "create"}
              />
              {errors.unp && (
                <small
                  id="counterparty-unp-error"
                  className="record-field__error"
                  role="alert"
                >
                  {errors.unp.message}
                </small>
              )}
            </label>

            <label className="record-field record-field--wide">
              <span>
                Полное наименование{" "}
                <strong aria-hidden="true">*</strong>
              </span>
              <input
                {...register("name")}
                type="text"
                maxLength={500}
                autoFocus={mode === "edit"}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={
                  errors.name
                    ? "counterparty-name-error"
                    : undefined
                }
              />
              {errors.name && (
                <small
                  id="counterparty-name-error"
                  className="record-field__error"
                  role="alert"
                >
                  {errors.name.message}
                </small>
              )}
            </label>

            <label className="record-field record-field--wide">
              <span>Краткое наименование</span>
              <input
                {...register("shortName")}
                type="text"
                maxLength={255}
                aria-invalid={Boolean(
                  errors.shortName,
                )}
              />
              {errors.shortName && (
                <small
                  className="record-field__error"
                  role="alert"
                >
                  {errors.shortName.message}
                </small>
              )}
            </label>

            <label className="record-field record-field--full">
              <span>Юридический адрес</span>
              <textarea
                {...register("legalAddress")}
                rows={3}
                maxLength={500}
                aria-invalid={Boolean(
                  errors.legalAddress,
                )}
              />
              {errors.legalAddress && (
                <small
                  className="record-field__error"
                  role="alert"
                >
                  {errors.legalAddress.message}
                </small>
              )}
            </label>
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
                : mode === "create"
                  ? "Создать"
                  : "Сохранить"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
