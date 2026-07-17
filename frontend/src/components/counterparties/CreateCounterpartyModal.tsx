import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  createCounterparty,
  type CreateCounterpartyPayload,
} from "../../api/counterparties";
import { ApiError } from "../../api/client";
import type { Counterparty } from "../../types/counterparty";

interface CreateCounterpartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (counterparty: Counterparty) => void;
}

interface FormState {
  unp: string;
  name: string;
  shortName: string;
  legalAddress: string;
}

const initialFormState: FormState = {
  unp: "",
  name: "",
  shortName: "",
  legalAddress: "",
};

export function CreateCounterpartyModal({
  isOpen,
  onClose,
  onCreated,
}: CreateCounterpartyModalProps) {
  const [form, setForm] =
    useState<FormState>(initialFormState);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(initialFormState);
    setError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
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
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

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

    const unp = form.unp.trim();
    const name = form.name.trim();

    if (!unp || !name) {
      setError("Заполните УНП и полное наименование");
      return;
    }

    const payload: CreateCounterpartyPayload = {
      unp,
      name,
      short_name: form.shortName.trim() || null,
      legal_address:
        form.legalAddress.trim() || null,
    };

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await createCounterparty(
        payload,
      );

      onCreated(created);
      onClose();
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError(
          "Не удалось создать контрагента",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="modalBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSubmitting
        ) {
          onClose();
        }
      }}
    >
      <section
        className="modalCard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-counterparty-title"
      >
        <div className="modalHeader">
          <div>
            <p className="modalEyebrow">
              Новый контрагент
            </p>

            <h2 id="create-counterparty-title">
              Добавление организации
            </h2>
          </div>

          <button
            type="button"
            className="modalCloseButton"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <form
          className="counterpartyForm"
          onSubmit={handleSubmit}
        >
          <label className="formField">
            <span>
              УНП <strong>*</strong>
            </span>

            <input
              type="text"
              value={form.unp}
              onChange={(event) =>
                updateField("unp", event.target.value)
              }
              placeholder="Например, 190000001"
              maxLength={50}
              autoFocus
              disabled={isSubmitting}
            />
          </label>

          <label className="formField">
            <span>
              Полное наименование <strong>*</strong>
            </span>

            <input
              type="text"
              value={form.name}
              onChange={(event) =>
                updateField("name", event.target.value)
              }
              placeholder='ООО "Название компании"'
              maxLength={500}
              disabled={isSubmitting}
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
              placeholder='ООО "Название"'
              maxLength={255}
              disabled={isSubmitting}
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
              placeholder="220000, г. Минск, ул. ..."
              rows={3}
              maxLength={1000}
              disabled={isSubmitting}
            />
          </label>

          {error && (
            <div className="formError" role="alert">
              {error}
            </div>
          )}

          <div className="modalActions">
            <button
              type="button"
              className="secondaryButton"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Отмена
            </button>

            <button
              type="submit"
              className="primaryButton"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Сохраняем…"
                : "Создать контрагента"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}