import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { z } from "zod";

import { ApiError } from "../api/client";
import { BrandMark } from
  "../components/ui/BrandMark";
import { FullPageLoader } from
  "../components/ui/FullPageLoader";
import { useAuth } from
  "../features/auth/useAuth";

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Введите имя пользователя")
    .max(100, "Не более 100 символов"),
  password: z
    .string()
    .min(1, "Введите пароль")
    .max(128, "Не более 128 символов"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginLocationState {
  from?: {
    pathname?: string;
  };
}

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] =
    useState(false);
  const [serverError, setServerError] =
    useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  if (status === "restoring") {
    return (
      <FullPageLoader label="Проверяем сессию" />
    );
  }

  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  const state =
    location.state as LoginLocationState | null;
  const returnPath =
    state?.from?.pathname &&
    state.from.pathname !== "/login"
      ? state.from.pathname
      : "/dashboard";

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);

    try {
      await login(values);
      navigate(returnPath, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.message);
      } else {
        setServerError(
          "Сервер временно недоступен. Повторите попытку.",
        );
      }
    }
  }

  return (
    <main className="login-page">
      <section className="login-page__intro">
        <BrandMark />

        <div className="login-page__message">
          <span className="login-page__kicker">
            Договорная работа без лишней рутины
          </span>
          <h1>
            Документы, контрагенты и AI-анализ
            в одной системе
          </h1>
          <p>
            Корпоративная CRM-система для подготовки,
            согласования и контроля договоров и
            технических заданий.
          </p>
        </div>

        <div className="login-page__security">
          <ShieldCheck size={19} aria-hidden="true" />
          <span>
            Защищённая рабочая область организации
          </span>
        </div>
      </section>

      <section className="login-page__form-area">
        <div className="login-card">
          <div className="login-card__mobile-brand">
            <BrandMark />
          </div>

          <div className="login-card__heading">
            <span className="login-card__icon">
              <LockKeyhole
                size={22}
                aria-hidden="true"
              />
            </span>
            <div>
              <h2>Вход в PromAI</h2>
              <p>
                Используйте учётную запись сотрудника
              </p>
            </div>
          </div>

          <form
            className="login-form"
            onSubmit={(event) =>
              void handleSubmit(onSubmit)(event)
            }
            noValidate
          >
            {serverError && (
              <div
                className="form-alert"
                role="alert"
                aria-live="assertive"
              >
                {serverError}
              </div>
            )}

            <label className="field">
              <span className="field__label">
                Имя пользователя
              </span>
              <span
                className={
                  errors.username
                    ? "field__control field__control--error"
                    : "field__control"
                }
              >
                <UserRound
                  size={18}
                  aria-hidden="true"
                />
                <input
                  {...register("username")}
                  type="text"
                  autoComplete="username"
                  placeholder="Введите имя пользователя"
                  aria-invalid={
                    errors.username ? "true" : "false"
                  }
                  aria-describedby={
                    errors.username
                      ? "username-error"
                      : undefined
                  }
                  autoFocus
                />
              </span>
              {errors.username && (
                <span
                  className="field__error"
                  id="username-error"
                >
                  {errors.username.message}
                </span>
              )}
            </label>

            <label className="field">
              <span className="field__label">
                Пароль
              </span>
              <span
                className={
                  errors.password
                    ? "field__control field__control--error"
                    : "field__control"
                }
              >
                <LockKeyhole
                  size={18}
                  aria-hidden="true"
                />
                <input
                  {...register("password")}
                  type={
                    showPassword ? "text" : "password"
                  }
                  autoComplete="current-password"
                  placeholder="Введите пароль"
                  aria-invalid={
                    errors.password ? "true" : "false"
                  }
                  aria-describedby={
                    errors.password
                      ? "password-error"
                      : undefined
                  }
                />
                <button
                  type="button"
                  className="field__visibility"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current,
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Скрыть пароль"
                      : "Показать пароль"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </span>
              {errors.password && (
                <span
                  className="field__error"
                  id="password-error"
                >
                  {errors.password.message}
                </span>
              )}
            </label>

            <button
              type="submit"
              className="button button--primary login-form__submit"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <span className="button-spinner" />
              )}
              {isSubmitting ? "Входим…" : "Войти"}
            </button>
          </form>
        </div>

        <p className="login-page__support">
          Нет доступа? Обратитесь к администратору
          PromAI.
        </p>
      </section>
    </main>
  );
}
