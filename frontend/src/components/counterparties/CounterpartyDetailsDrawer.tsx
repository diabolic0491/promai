import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  archiveCounterparty,
  restoreCounterparty,
  updateCounterparty,
} from "../../api/counterparties";
import { ApiError } from "../../api/client";
import type { Counterparty } from "../../types/counterparty";

interface CounterpartyDetailsDrawerProps {
  counterparty: Counterparty | null;
  onClose: () => void;
  onChanged: (counterparty: Counterparty) => void;
}

interface FormState {
  name: string;
  shortName: string;
  legalAddress: string;
}

const initialFormState: FormState = {
  name: "",
  shortName: "",
  legalAddress: "",
};

export function CounterpartyDetailsDrawer({
  counterparty,
  onClose,
  onChanged,
}: CounterpartyDetailsDrawerProps) {
  const [form, setForm] =
    useState<FormState>(initialFormState);

  const [isSaving, setIsSaving] = useState(false);

  const [isChangingStatus, setIsChangingStatus] =
    useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!counterparty) {
      setForm(initialFormState);
      setError(null);
      return;
    }

    setForm({
      name: counterparty.name,
      shortName: counterparty.short_name ?? "",
      legalAddress: counterparty.legal_address ?? "",
    });

    setError(null);
  }, [counterparty]);

  useEffect(() => {
    if (!counterparty) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !isSaving &&
        !isChangingStatus
      ) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape,
      );

      document.body.style.overflow = "";
    };
  }, [
    counterparty,
    isSaving,
    isChangingStatus,
    onClose,
  ]);

  if (!counterparty) {
    return null;
  }

  const currentCounterparty = counterparty;
  const isBusy = isSaving || isChangingStatus;

  function updateField(
    field: keyof FormState,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const name = form.name.trim();

    if (!name) {
      setError("Полное наименование обязательно");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updated = await updateCounterparty(
        currentCounterparty.id,
        {
          name,
          short_name: form.shortName.trim() || null,
          legal_address:
            form.legalAddress.trim() || null,
        },
      );

      onChanged(updated);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Не удалось сохранить изменения",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange() {
    const action =
      currentCounterparty.status === "active"
        ? "переместить контрагента в архив"
        : "восстановить контрагента";

    const confirmed = window.confirm(
      `Вы действительно хотите ${action}?`,
    );

    if (!confirmed) {
      return;
    }

    setIsChangingStatus(true);
    setError(null);

    try {
      const changed =
        currentCounterparty.status === "active"
          ? await archiveCounterparty(
              currentCounterparty.id,
            )
          : await restoreCounterparty(
              currentCounterparty.id,
            );

      onChanged(changed);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Не удалось изменить статус",
      );
    } finally {
      setIsChangingStatus(false);
    }
  }

  return (
    <div
      className="drawerBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isBusy
        ) {
          onClose();
        }
      }}
    >
      <aside
        className="detailsDrawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="counterparty-details-title"
      >
        <header className="drawerHeader">
          <div>
            <p className="modalEyebrow">
              Карточка контрагента
            </p>

            <h2 id="counterparty-details-title">
              {currentCounterparty.short_name ||
                currentCounterparty.name}
            </h2>
          </div>

          <button
            type="button"
            className="modalCloseButton"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <div className="counterpartyIdentity">
          <span className="counterpartyLargeAvatar">
            {currentCounterparty.name
              .charAt(0)
              .toUpperCase()}
          </span>

          <div>
            <span>УНП</span>
            <strong>{currentCounterparty.unp}</strong>
          </div>

          <span
            className={`statusBadge ${
              currentCounterparty.status === "active"
                ? "statusBadgeActive"
                : "statusBadgeArchived"
            }`}
          >
            {currentCounterparty.status === "active"
              ? "Активен"
              : "В архиве"}
          </span>
        </div>

        <form
          className="drawerForm"
          onSubmit={handleSubmit}
        >
          <label className="formField">
            <span>
              Полное наименование <strong>*</strong>
            </span>

            <textarea
              value={form.name}
              onChange={(event) =>
                updateField("name", event.target.value)
              }
              rows={3}
              maxLength={500}
              disabled={isBusy}
            />
          </label>

          <label className="formField">
            <span>Краткое наименование</span>

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
              disabled={isBusy}
            />
          </label>

          <label className="formField">
            <span>Юридический адрес</span>

            <textarea
              value={form.legalAddress}
              onChange={(event) =>
                updateField(
                  "legalAddress",
                  event.target.value,
                )
              }
              rows={4}
              maxLength={1000}
              disabled={isBusy}
            />
          </label>

          <div className="metadataGrid">
            <div>
              <span>Создан</span>

              <strong>
                {new Date(
                  currentCounterparty.created_at,
                ).toLocaleDateString("ru-RU")}
              </strong>
            </div>

            <div>
              <span>Обновлён</span>

              <strong>
                {new Date(
                  currentCounterparty.updated_at,
                ).toLocaleDateString("ru-RU")}
              </strong>
            </div>
          </div>

          {error && (
            <div className="formError" role="alert">
              {error}
            </div>
          )}

          <div className="drawerActions">
            <button
              type="button"
              className={
                currentCounterparty.status === "active"
                  ? "dangerButton"
                  : "secondaryButton"
              }
              onClick={() => void handleStatusChange()}
              disabled={isBusy}
            >
              {isChangingStatus
                ? "Выполняем…"
                : currentCounterparty.status === "active"
                  ? "В архив"
                  : "Восстановить"}
            </button>

            <button
              type="submit"
              className="primaryButton"
              disabled={isBusy}
            >
              {isSaving
                ? "Сохраняем…"
                : "Сохранить изменения"}
            </button>
          </div>
        </form>

        <section className="drawerContracts">
          <div>
            <p className="modalEyebrow">Договоры</p>
            <h3>Договоры контрагента</h3>
          </div>

          <div className="drawerEmptyState">
            <strong>
              Раздел договоров будет подключён следующим этапом
            </strong>

            <span>
              Здесь появятся связанные договоры и кнопка
              создания нового договора.
            </span>
          </div>
        </section>
      </aside>
    </div>
  );
}