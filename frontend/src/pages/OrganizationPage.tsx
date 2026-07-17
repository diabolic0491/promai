import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  getOrganizationProfile,
  updateOrganizationProfile,
  type UpdateOrganizationProfilePayload,
} from "../api/organizationProfile";
import { ApiError } from "../api/client";

import type { OrganizationProfile } from
  "../types/organizationProfile";

interface FormState {
  name: string;
  shortName: string;
  unp: string;
  legalAddress: string;
  email: string;
  phone: string;
  directorName: string;
  bankName: string;
  bankAccount: string;
  bankCode: string;
}

function createFormState(
  profile: OrganizationProfile,
): FormState {
  return {
    name: profile.name,
    shortName: profile.short_name,
    unp: profile.unp ?? "",
    legalAddress: profile.legal_address ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    directorName: profile.director_name ?? "",
    bankName: profile.bank_name ?? "",
    bankAccount: profile.bank_account ?? "",
    bankCode: profile.bank_code ?? "",
  };
}

export function OrganizationPage() {
  const [profile, setProfile] =
    useState<OrganizationProfile | null>(null);

  const [form, setForm] =
    useState<FormState | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState<string | null>(
    null,
  );

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedProfile =
        await getOrganizationProfile();

      setProfile(loadedProfile);
      setForm(createFormState(loadedProfile));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить профиль предприятия",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value,
      };
    });

    setSuccessMessage(null);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!form) {
      return;
    }

    if (!form.name.trim()) {
      setError("Укажите полное наименование");
      return;
    }

    if (!form.shortName.trim()) {
      setError("Укажите краткое наименование");
      return;
    }

    const payload: UpdateOrganizationProfilePayload = {
      name: form.name.trim(),
      short_name: form.shortName.trim(),
      unp: form.unp.trim() || null,
      legal_address:
        form.legalAddress.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      director_name:
        form.directorName.trim() || null,
      bank_name: form.bankName.trim() || null,
      bank_account:
        form.bankAccount.trim() || null,
      bank_code: form.bankCode.trim() || null,
    };

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated =
        await updateOrganizationProfile(payload);

      setProfile(updated);
      setForm(createFormState(updated));
      setSuccessMessage("Реквизиты сохранены");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Не удалось сохранить реквизиты",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="page">
        <div className="tablePanel">
          <div className="tableState">
            <span className="loader" />
            Загружаем профиль предприятия…
          </div>
        </div>
      </section>
    );
  }

  if (error && !form) {
    return (
      <section className="page">
        <div className="errorState">
          <div>
            <strong>
              Не удалось загрузить профиль
            </strong>
            <span>{error}</span>
          </div>

          <button
            type="button"
            className="secondaryButton"
            onClick={() => void loadProfile()}
          >
            Повторить
          </button>
        </div>
      </section>
    );
  }

  if (!form || !profile) {
    return null;
  }

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <p className="pageEyebrow">
            Владелец CRM
          </p>

          <h1>Наша компания</h1>

          <p>
            Реквизиты ООО «Промас Инжиниринг»,
            используемые в договорах и документах.
          </p>
        </div>

        <span className="organizationStatus">
          Основная организация
        </span>
      </div>

      <div className="organizationLayout">
        <aside className="organizationSummaryCard">
          <div className="organizationAvatar">
            ПИ
          </div>

          <div className="organizationSummaryText">
            <span>Наша организация</span>

            <h2>
              {profile.short_name || profile.name}
            </h2>

            <p>{profile.name}</p>
          </div>

          <div className="organizationQuickInfo">
            <div>
              <span>УНП</span>
              <strong>{profile.unp || "Не указан"}</strong>
            </div>

            <div>
              <span>Руководитель</span>
              <strong>
                {profile.director_name ||
                  "Не указан"}
              </strong>
            </div>

            <div>
              <span>Контакты</span>
              <strong>
                {profile.phone ||
                  profile.email ||
                  "Не указаны"}
              </strong>
            </div>
          </div>

          <div className="organizationHint">
            Эти данные будут подставляться в договоры,
            письма и шаблоны документов.
          </div>
        </aside>

        <form
          className="organizationFormCard"
          onSubmit={handleSubmit}
        >
          <section className="organizationFormSection">
            <div className="formSectionHeader">
              <div>
                <span>Общие сведения</span>
                <strong>
                  Наименование и реквизиты
                </strong>
              </div>
            </div>

            <div className="contractFormGrid">
              <label className="formField contractWideField">
                <span>
                  Полное наименование <strong>*</strong>
                </span>

                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    updateField(
                      "name",
                      event.target.value,
                    )
                  }
                  maxLength={500}
                  disabled={isSaving}
                />
              </label>

              <label className="formField">
                <span>
                  Краткое наименование <strong>*</strong>
                </span>

                <input
                  type="text"
                  value={form.shortName}
                  onChange={(event) =>
                    updateField(
                      "shortName",
                      event.target.value,
                    )
                  }
                  maxLength={255}
                  disabled={isSaving}
                />
              </label>

              <label className="formField">
                <span>УНП</span>

                <input
                  type="text"
                  value={form.unp}
                  onChange={(event) =>
                    updateField(
                      "unp",
                      event.target.value,
                    )
                  }
                  maxLength={50}
                  disabled={isSaving}
                />
              </label>

              <label className="formField contractWideField">
                <span>Юридический адрес</span>

                <textarea
                  value={form.legalAddress}
                  onChange={(event) =>
                    updateField(
                      "legalAddress",
                      event.target.value,
                    )
                  }
                  rows={3}
                  disabled={isSaving}
                />
              </label>
            </div>
          </section>

          <section className="organizationFormSection">
            <div className="formSectionHeader">
              <div>
                <span>Контакты</span>
                <strong>
                  Руководитель и связь
                </strong>
              </div>
            </div>

            <div className="contractFormGrid">
              <label className="formField contractWideField">
                <span>Руководитель</span>

                <input
                  type="text"
                  value={form.directorName}
                  onChange={(event) =>
                    updateField(
                      "directorName",
                      event.target.value,
                    )
                  }
                  placeholder="Фамилия Имя Отчество"
                  maxLength={255}
                  disabled={isSaving}
                />
              </label>

              <label className="formField">
                <span>Телефон</span>

                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    updateField(
                      "phone",
                      event.target.value,
                    )
                  }
                  placeholder="+375 ..."
                  maxLength={100}
                  disabled={isSaving}
                />
              </label>

              <label className="formField">
                <span>Email</span>

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    updateField(
                      "email",
                      event.target.value,
                    )
                  }
                  placeholder="info@example.by"
                  maxLength={255}
                  disabled={isSaving}
                />
              </label>
            </div>
          </section>

          <section className="organizationFormSection">
            <div className="formSectionHeader">
              <div>
                <span>Банковские реквизиты</span>
                <strong>
                  Банк и расчётный счёт
                </strong>
              </div>
            </div>

            <div className="contractFormGrid">
              <label className="formField contractWideField">
                <span>Наименование банка</span>

                <input
                  type="text"
                  value={form.bankName}
                  onChange={(event) =>
                    updateField(
                      "bankName",
                      event.target.value,
                    )
                  }
                  maxLength={500}
                  disabled={isSaving}
                />
              </label>

              <label className="formField">
                <span>Расчётный счёт</span>

                <input
                  type="text"
                  value={form.bankAccount}
                  onChange={(event) =>
                    updateField(
                      "bankAccount",
                      event.target.value,
                    )
                  }
                  maxLength={100}
                  disabled={isSaving}
                />
              </label>

              <label className="formField">
                <span>Банковский код</span>

                <input
                  type="text"
                  value={form.bankCode}
                  onChange={(event) =>
                    updateField(
                      "bankCode",
                      event.target.value,
                    )
                  }
                  maxLength={100}
                  disabled={isSaving}
                />
              </label>
            </div>
          </section>

          {error && (
            <div className="formError" role="alert">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="formSuccess" role="status">
              {successMessage}
            </div>
          )}

          <div className="organizationFormActions">
            <button
              type="submit"
              className="primaryButton"
              disabled={isSaving}
            >
              {isSaving
                ? "Сохраняем…"
                : "Сохранить реквизиты"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}