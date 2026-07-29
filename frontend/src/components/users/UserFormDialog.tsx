import { zodResolver } from "@hookform/resolvers/zod";
import {
  Save,
  UserCog,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "../../api/client";
import type {
  UserRole,
} from "../../features/auth/auth.types";
import type {
  User,
} from "../../types/user";

const userFormBaseSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Не менее 3 символов")
    .max(100, "Не более 100 символов")
    .refine(
      (value) => !/\s/.test(value),
      "Имя пользователя не должно содержать пробелы",
    ),
  fullName: z
    .string()
    .max(255, "Не более 255 символов"),
  password: z.string().max(
    128,
    "Не более 128 символов",
  ),
  role: z.enum(["admin", "manager"]),
  isActive: z.boolean(),
});

function createUserFormSchema(isCreate: boolean) {
  return userFormBaseSchema.superRefine(
    (values, context) => {
    if (
      isCreate &&
      values.password.length < 12
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Не менее 12 символов",
      });
    }

    if (
      !isCreate &&
      values.password.length > 0 &&
      values.password.length < 12
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message:
          "Новый пароль должен содержать не менее 12 символов",
      });
    }
    },
  );
}

type UserFormValues = z.infer<
  typeof userFormBaseSchema
>;

export interface UserFormSubmitValues {
  username: string;
  fullName: string | null;
  password: string | null;
  role: UserRole;
  isActive: boolean;
}

interface UserFormDialogProps {
  isOpen: boolean;
  user?: User | null;
  currentUserId: number;
  onClose: () => void;
  onSubmit: (
    values: UserFormSubmitValues,
  ) => Promise<void>;
}

function createDefaultValues(
  user?: User | null,
): UserFormValues {
  return {
    username: user?.username ?? "",
    fullName: user?.full_name ?? "",
    password: "",
    role: user?.role ?? "manager",
    isActive: user?.is_active ?? true,
  };
}

export function UserFormDialog({
  isOpen,
  user,
  currentUserId,
  onClose,
  onSubmit,
}: UserFormDialogProps) {
  const [submissionError, setSubmissionError] =
    useState<string | null>(null);
  const isCreate = !user;
  const isSelf = user?.id === currentUserId;

  const {
    register,
    handleSubmit,
    reset,
    formState: {
      errors,
      isDirty,
      isSubmitting,
    },
  } = useForm<UserFormValues>({
    resolver: zodResolver(
      createUserFormSchema(isCreate),
    ),
    defaultValues: createDefaultValues(user),
  });

  useEffect(() => {
    if (isOpen) {
      reset(createDefaultValues(user));
      setSubmissionError(null);
    }
  }, [isOpen, reset, user]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        if (
          !isDirty ||
          window.confirm(
            "Закрыть форму? Несохранённые изменения будут потеряны.",
          )
        ) {
          onClose();
        }
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
  }, [isDirty, isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

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

  async function submit(values: UserFormValues) {
    setSubmissionError(null);

    try {
      await onSubmit({
        username: values.username.trim().toLowerCase(),
        fullName: values.fullName.trim() || null,
        password: values.password || null,
        role: isSelf ? user!.role : values.role,
        isActive: isSelf
          ? user!.is_active
          : values.isActive,
      });
    } catch (error) {
      setSubmissionError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Не удалось сохранить пользователя",
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
        className="dialog-card user-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-dialog-title"
      >
        <div className="dialog-card__heading">
          <span className="user-dialog__icon">
            <UserCog size={22} aria-hidden="true" />
          </span>
          <div>
            <h2 id="user-dialog-title">
              {isCreate
                ? "Новый пользователь"
                : "Редактирование пользователя"}
            </h2>
            <p>
              {isCreate
                ? "Создайте учётную запись сотрудника и назначьте роль."
                : `Изменение учётной записи @${user.username}.`}
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
                Имя пользователя{" "}
                <strong aria-hidden="true">*</strong>
              </span>
              <input
                {...register("username")}
                type="text"
                maxLength={100}
                autoComplete="username"
                readOnly={!isCreate}
                autoFocus={isCreate}
                aria-invalid={Boolean(errors.username)}
              />
              {errors.username && (
                <small
                  className="record-field__error"
                  role="alert"
                >
                  {errors.username.message}
                </small>
              )}
              {!isCreate && (
                <small className="record-field__hint">
                  Логин после создания не изменяется.
                </small>
              )}
            </label>

            <label className="record-field">
              <span>ФИО</span>
              <input
                {...register("fullName")}
                type="text"
                maxLength={255}
                autoComplete="name"
                aria-invalid={Boolean(errors.fullName)}
              />
              {errors.fullName && (
                <small
                  className="record-field__error"
                  role="alert"
                >
                  {errors.fullName.message}
                </small>
              )}
            </label>

            <label className="record-field">
              <span>
                {isCreate ? "Пароль" : "Новый пароль"}{" "}
                {isCreate && (
                  <strong aria-hidden="true">*</strong>
                )}
              </span>
              <input
                {...register("password")}
                type="password"
                minLength={isCreate ? 12 : undefined}
                maxLength={128}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
              />
              {errors.password ? (
                <small
                  className="record-field__error"
                  role="alert"
                >
                  {errors.password.message}
                </small>
              ) : (
                <small className="record-field__hint">
                  {isCreate
                    ? "От 12 до 128 символов."
                    : "Оставьте пустым, чтобы не менять."}
                </small>
              )}
            </label>

            <label className="record-field">
              <span>
                Роль{" "}
                <strong aria-hidden="true">*</strong>
              </span>
              <select
                {...register("role")}
                disabled={Boolean(isSelf)}
              >
                <option value="manager">
                  Менеджер
                </option>
                <option value="admin">
                  Администратор
                </option>
              </select>
              {isSelf && (
                <small className="record-field__hint">
                  Нельзя изменить собственную роль.
                </small>
              )}
            </label>

            <label className="records-toggle user-active-toggle">
              <input
                {...register("isActive")}
                type="checkbox"
                disabled={Boolean(isSelf)}
              />
              <span aria-hidden="true" />
              Разрешить вход
            </label>

            {isSelf && (
              <div className="user-self-notice">
                Собственную учётную запись нельзя
                отключить. Это защищает доступ к
                администрированию.
              </div>
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
                  ? "Создать пользователя"
                  : "Сохранить"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
