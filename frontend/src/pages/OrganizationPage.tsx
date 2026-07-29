import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Landmark,
  Pencil,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useForm } from "react-hook-form";
import { useBlocker } from "react-router-dom";
import { z } from "zod";

import {
  getOrganizationProfile,
  updateOrganizationProfile,
} from "../api/organizationProfile";
import { useAuth } from
  "../features/auth/useAuth";
import type {
  OrganizationProfile,
} from "../types/organizationProfile";
import { formatDateTime } from
  "../utils/formatters";
import "../styles/records.css";

const optionalEmail = z
  .string()
  .trim()
  .max(255, "Не более 255 символов")
  .refine(
    (value) =>
      value === "" ||
      z.string().email().safeParse(value).success,
    "Укажите корректный email",
  );

const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Укажите полное наименование")
    .max(500, "Не более 500 символов"),
  shortName: z
    .string()
    .trim()
    .min(1, "Укажите краткое наименование")
    .max(255, "Не более 255 символов"),
  unp: z
    .string()
    .trim()
    .max(50, "Не более 50 символов"),
  legalAddress: z.string().trim(),
  email: optionalEmail,
  phone: z
    .string()
    .trim()
    .max(100, "Не более 100 символов"),
  directorName: z
    .string()
    .trim()
    .max(255, "Не более 255 символов"),
  directorPosition: z
    .string()
    .trim()
    .max(255, "Не более 255 символов"),
  bankName: z
    .string()
    .trim()
    .max(500, "Не более 500 символов"),
  bankAccount: z
    .string()
    .trim()
    .max(100, "Не более 100 символов"),
  bankCode: z
    .string()
    .trim()
    .max(100, "Не более 100 символов"),
});

type OrganizationFormValues = z.infer<
  typeof organizationSchema
>;

const emptyForm: OrganizationFormValues = {
  name: "",
  shortName: "",
  unp: "",
  legalAddress: "",
  email: "",
  phone: "",
  directorName: "",
  directorPosition: "",
  bankName: "",
  bankAccount: "",
  bankCode: "",
};

function toFormValues(
  profile: OrganizationProfile,
): OrganizationFormValues {
  return {
    name: profile.name,
    shortName: profile.short_name,
    unp: profile.unp ?? "",
    legalAddress: profile.legal_address ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    directorName: profile.director_name ?? "",
    directorPosition:
      profile.director_position ?? "",
    bankName: profile.bank_name ?? "",
    bankAccount: profile.bank_account ?? "",
    bankCode: profile.bank_code ?? "",
  };
}

function display(value: string | null): string {
  return value || "Не указано";
}

export function OrganizationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const organizationQuery = useQuery({
    queryKey: ["organization-profile"],
    queryFn: getOrganizationProfile,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: {
      errors,
      isDirty,
    },
  } = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: emptyForm,
  });

  useEffect(() => {
    if (organizationQuery.data) {
      reset(toFormValues(organizationQuery.data));
    }
  }, [organizationQuery.data, reset]);

  useEffect(() => {
    if (!isEditing || !isDirty) {
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
  }, [isDirty, isEditing]);

  const blocker = useBlocker(isEditing && isDirty);

  useEffect(() => {
    if (blocker.state !== "blocked") {
      return;
    }

    if (
      window.confirm(
        "Покинуть страницу? Несохранённые изменения будут потеряны.",
      )
    ) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

  const updateMutation = useMutation({
    mutationFn: (values: OrganizationFormValues) =>
      updateOrganizationProfile({
        name: values.name.trim(),
        short_name: values.shortName.trim(),
        unp: values.unp.trim() || null,
        legal_address:
          values.legalAddress.trim() || null,
        email: values.email.trim() || null,
        phone: values.phone.trim() || null,
        director_name:
          values.directorName.trim() || null,
        director_position:
          values.directorPosition.trim() || null,
        bank_name: values.bankName.trim() || null,
        bank_account:
          values.bankAccount.trim() || null,
        bank_code: values.bankCode.trim() || null,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ["organization-profile"],
        updated,
      );
      reset(toFormValues(updated));
      setIsEditing(false);
      setSuccessMessage("Реквизиты сохранены");
    },
  });

  function cancelEditing() {
    if (
      isDirty &&
      !window.confirm(
        "Отменить редактирование? Изменения будут потеряны.",
      )
    ) {
      return;
    }

    if (organizationQuery.data) {
      reset(toFormValues(organizationQuery.data));
    }
    updateMutation.reset();
    setIsEditing(false);
  }

  if (organizationQuery.isLoading) {
    return (
      <section className="page">
        <div
          className="records-state records-state--card"
          role="status"
        >
          <span className="loading-spinner" />
          <strong>Загружаем организацию</strong>
          <span>Получаем актуальные реквизиты…</span>
        </div>
      </section>
    );
  }

  if (
    organizationQuery.isError ||
    !organizationQuery.data
  ) {
    return (
      <section className="page">
        <div className="records-state records-state--error records-state--card">
          <Building2 size={30} aria-hidden="true" />
          <strong>
            Не удалось загрузить профиль организации
          </strong>
          <span>
            {organizationQuery.error instanceof Error
              ? organizationQuery.error.message
              : "Профиль предприятия не найден"}
          </span>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              void organizationQuery.refetch();
            }}
          >
            Повторить
          </button>
        </div>
      </section>
    );
  }

  const profile = organizationQuery.data;

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Настройки предприятия
          </span>
          <h1>Организация</h1>
          <p>
            Реквизиты собственной организации,
            используемые в договорах и документах.
          </p>
        </div>

        <div className="organization-heading-actions">
          <span className="status-badge status-badge--active">
            Основная организация
          </span>
          {isAdmin && !isEditing && (
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                setSuccessMessage(null);
                setIsEditing(true);
              }}
            >
              <Pencil size={17} aria-hidden="true" />
              Редактировать
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="record-notice" role="note">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Режим просмотра</strong>
            <span>
              Изменять реквизиты может только
              администратор.
            </span>
          </div>
        </div>
      )}

      {successMessage && (
        <div
          className="record-success"
          role="status"
        >
          <CheckCircle2 size={20} aria-hidden="true" />
          {successMessage}
        </div>
      )}

      <div className="organization-layout">
        <aside className="organization-summary">
          <div className="organization-summary__mark">
            <Building2 size={27} aria-hidden="true" />
          </div>
          <span className="section-kicker">
            Наша организация
          </span>
          <h2>{profile.short_name}</h2>
          <p>{profile.name}</p>

          <dl>
            <div>
              <dt>УНП</dt>
              <dd>{display(profile.unp)}</dd>
            </div>
            <div>
              <dt>Руководитель</dt>
              <dd>{display(profile.director_name)}</dd>
            </div>
            <div>
              <dt>Обновлено</dt>
              <dd>
                {formatDateTime(profile.updated_at)}
              </dd>
            </div>
          </dl>

          <div className="organization-summary__hint">
            Эти данные автоматически используются при
            формировании документов.
          </div>
        </aside>

        {isEditing && isAdmin ? (
          <form
            className="organization-form"
            onSubmit={(event) => {
              void handleSubmit((values) =>
                updateMutation.mutateAsync(values),
              )(event);
            }}
            noValidate
          >
            <OrganizationFormSection
              icon={Building2}
              kicker="Основные реквизиты"
              title="Наименование и адрес"
            >
              <label className="record-field record-field--full">
                <span>
                  Полное наименование{" "}
                  <strong aria-hidden="true">*</strong>
                </span>
                <input
                  {...register("name")}
                  type="text"
                  maxLength={500}
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
                  Краткое наименование{" "}
                  <strong aria-hidden="true">*</strong>
                </span>
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
              <label className="record-field">
                <span>УНП</span>
                <input
                  {...register("unp")}
                  type="text"
                  maxLength={50}
                  aria-invalid={Boolean(errors.unp)}
                />
                {errors.unp && (
                  <small
                    className="record-field__error"
                    role="alert"
                  >
                    {errors.unp.message}
                  </small>
                )}
              </label>
              <label className="record-field record-field--full">
                <span>Юридический адрес</span>
                <textarea
                  {...register("legalAddress")}
                  rows={3}
                />
              </label>
            </OrganizationFormSection>

            <OrganizationFormSection
              icon={UserRound}
              kicker="Контакты"
              title="Руководитель и связь"
            >
              <label className="record-field">
                <span>ФИО руководителя</span>
                <input
                  {...register("directorName")}
                  type="text"
                  maxLength={255}
                  aria-invalid={Boolean(
                    errors.directorName,
                  )}
                />
                {errors.directorName && (
                  <small
                    className="record-field__error"
                    role="alert"
                  >
                    {errors.directorName.message}
                  </small>
                )}
              </label>
              <label className="record-field">
                <span>Должность руководителя</span>
                <input
                  {...register("directorPosition")}
                  type="text"
                  maxLength={255}
                  aria-invalid={Boolean(
                    errors.directorPosition,
                  )}
                />
                {errors.directorPosition && (
                  <small
                    className="record-field__error"
                    role="alert"
                  >
                    {errors.directorPosition.message}
                  </small>
                )}
              </label>
              <label className="record-field">
                <span>Email</span>
                <input
                  {...register("email")}
                  type="email"
                  maxLength={255}
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email && (
                  <small
                    className="record-field__error"
                    role="alert"
                  >
                    {errors.email.message}
                  </small>
                )}
              </label>
              <label className="record-field">
                <span>Телефон</span>
                <input
                  {...register("phone")}
                  type="tel"
                  maxLength={100}
                  aria-invalid={Boolean(errors.phone)}
                />
                {errors.phone && (
                  <small
                    className="record-field__error"
                    role="alert"
                  >
                    {errors.phone.message}
                  </small>
                )}
              </label>
            </OrganizationFormSection>

            <OrganizationFormSection
              icon={Landmark}
              kicker="Банковские реквизиты"
              title="Банк и расчётный счёт"
            >
              <label className="record-field record-field--full">
                <span>Наименование банка</span>
                <input
                  {...register("bankName")}
                  type="text"
                  maxLength={500}
                  aria-invalid={Boolean(
                    errors.bankName,
                  )}
                />
                {errors.bankName && (
                  <small
                    className="record-field__error"
                    role="alert"
                  >
                    {errors.bankName.message}
                  </small>
                )}
              </label>
              <label className="record-field">
                <span>Расчётный счёт</span>
                <input
                  {...register("bankAccount")}
                  type="text"
                  maxLength={100}
                  aria-invalid={Boolean(
                    errors.bankAccount,
                  )}
                />
                {errors.bankAccount && (
                  <small
                    className="record-field__error"
                    role="alert"
                  >
                    {errors.bankAccount.message}
                  </small>
                )}
              </label>
              <label className="record-field">
                <span>БИК / код банка</span>
                <input
                  {...register("bankCode")}
                  type="text"
                  maxLength={100}
                  aria-invalid={Boolean(
                    errors.bankCode,
                  )}
                />
                {errors.bankCode && (
                  <small
                    className="record-field__error"
                    role="alert"
                  >
                    {errors.bankCode.message}
                  </small>
                )}
              </label>
            </OrganizationFormSection>

            {updateMutation.isError && (
              <div className="form-alert" role="alert">
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : "Не удалось сохранить реквизиты"}
              </div>
            )}

            <div className="organization-form__actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={cancelEditing}
                disabled={updateMutation.isPending}
              >
                <X size={17} aria-hidden="true" />
                Отмена
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  updateMutation.isPending || !isDirty
                }
              >
                {updateMutation.isPending ? (
                  <span
                    className="button-spinner"
                    aria-hidden="true"
                  />
                ) : (
                  <Save
                    size={17}
                    aria-hidden="true"
                  />
                )}
                {updateMutation.isPending
                  ? "Сохраняем…"
                  : "Сохранить"}
              </button>
            </div>
          </form>
        ) : (
          <div className="organization-details">
            <OrganizationDetailsSection
              icon={Building2}
              kicker="Основные реквизиты"
              title="Наименование и адрес"
              items={[
                ["Полное наименование", profile.name],
                [
                  "Краткое наименование",
                  profile.short_name,
                ],
                ["УНП", display(profile.unp)],
                [
                  "Юридический адрес",
                  display(profile.legal_address),
                ],
              ]}
            />
            <OrganizationDetailsSection
              icon={UserRound}
              kicker="Контакты"
              title="Руководитель и связь"
              items={[
                [
                  "ФИО руководителя",
                  display(profile.director_name),
                ],
                [
                  "Должность",
                  display(profile.director_position),
                ],
                ["Email", display(profile.email)],
                ["Телефон", display(profile.phone)],
              ]}
            />
            <OrganizationDetailsSection
              icon={Landmark}
              kicker="Банковские реквизиты"
              title="Банк и расчётный счёт"
              items={[
                [
                  "Наименование банка",
                  display(profile.bank_name),
                ],
                [
                  "Расчётный счёт",
                  display(profile.bank_account),
                ],
                [
                  "БИК / код банка",
                  display(profile.bank_code),
                ],
              ]}
            />
          </div>
        )}
      </div>
    </section>
  );
}

interface OrganizationSectionProps {
  icon: typeof Building2;
  kicker: string;
  title: string;
}

interface OrganizationFormSectionProps
  extends OrganizationSectionProps {
  children: ReactNode;
}

function OrganizationFormSection({
  icon: Icon,
  kicker,
  title,
  children,
}: OrganizationFormSectionProps) {
  return (
    <section className="organization-section">
      <div className="organization-section__heading">
        <span>
          <Icon size={20} aria-hidden="true" />
        </span>
        <div>
          <small>{kicker}</small>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="record-form__grid">{children}</div>
    </section>
  );
}

interface OrganizationDetailsSectionProps
  extends OrganizationSectionProps {
  items: Array<[string, string]>;
}

function OrganizationDetailsSection({
  icon: Icon,
  kicker,
  title,
  items,
}: OrganizationDetailsSectionProps) {
  return (
    <section className="organization-section">
      <div className="organization-section__heading">
        <span>
          <Icon size={20} aria-hidden="true" />
        </span>
        <div>
          <small>{kicker}</small>
          <h2>{title}</h2>
        </div>
      </div>
      <dl className="description-list">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
