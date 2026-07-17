import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { createContract } from "../../api/contracts";
import { getCounterparties } from
  "../../api/counterparties";
import { getOrganizationProfile } from
  "../../api/organizationProfile";
import { ApiError } from "../../api/client";

import {
  contractRoleOptions,
  pairedContractRoles,
} from "../../constants/contractRoles";

import type {
  Contract,
  ContractPartyRole,
  CreateContractPayload,
} from "../../types/contract";
import type { Counterparty } from
  "../../types/counterparty";
import type { OrganizationProfile } from
  "../../types/organizationProfile";

interface CreateContractModalProps {
  isOpen: boolean;
  initialCounterpartyId?: number | null;
  onClose: () => void;
  onCreated: (contract: Contract) => void;
}

interface FormState {
  counterpartyId: string;
  number: string;
  title: string;
  contractDate: string;
  startDate: string;
  endDate: string;
  amount: string;
  currency: string;
  notes: string;
  ownerRole: ContractPartyRole;
  counterpartyRole: ContractPartyRole;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function createInitialState(
  initialCounterpartyId?: number | null,
): FormState {
  return {
    counterpartyId:
      initialCounterpartyId !== null &&
      initialCounterpartyId !== undefined
        ? String(initialCounterpartyId)
        : "",
    number: "",
    title: "",
    contractDate: getToday(),
    startDate: "",
    endDate: "",
    amount: "",
    currency: "BYN",
    notes: "",
    ownerRole: "supplier",
    counterpartyRole: "buyer",
  };
}

export function CreateContractModal({
  isOpen,
  initialCounterpartyId,
  onClose,
  onCreated,
}: CreateContractModalProps) {
  const [form, setForm] = useState<FormState>(
    createInitialState(initialCounterpartyId),
  );

  const [counterparties, setCounterparties] =
    useState<Counterparty[]>([]);

  const [organization, setOrganization] =
    useState<OrganizationProfile | null>(null);

  const [isLoadingData, setIsLoadingData] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] = useState<string | null>(
    null,
  );

  const selectedCounterparty = useMemo(
    () =>
      counterparties.find(
        (counterparty) =>
          counterparty.id ===
          Number(form.counterpartyId),
      ) ?? null,
    [counterparties, form.counterpartyId],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(createInitialState(initialCounterpartyId));
    setError(null);

    async function loadFormData() {
      setIsLoadingData(true);

      try {
        const [
          loadedCounterparties,
          loadedOrganization,
        ] = await Promise.all([
          getCounterparties({
            includeArchived: false,
            limit: 100,
          }),
          getOrganizationProfile(),
        ]);

        setCounterparties(loadedCounterparties);
        setOrganization(loadedOrganization);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Не удалось загрузить данные формы",
        );
      } finally {
        setIsLoadingData(false);
      }
    }

    void loadFormData();
  }, [isOpen, initialCounterpartyId]);

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

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleOwnerRoleChange(
    role: ContractPartyRole,
  ) {
    const pairedRole = pairedContractRoles[role];

    setForm((current) => ({
      ...current,
      ownerRole: role,
      counterpartyRole:
        pairedRole ?? current.counterpartyRole,
    }));
  }

  function validateForm(): string | null {
    if (!form.counterpartyId) {
      return "Выберите контрагента";
    }

    if (!form.number.trim()) {
      return "Укажите номер договора";
    }

    if (!form.title.trim()) {
      return "Укажите название или предмет договора";
    }

    if (!form.contractDate) {
      return "Укажите дату договора";
    }

    if (
      form.startDate &&
      form.endDate &&
      form.endDate < form.startDate
    ) {
      return "Дата окончания не может быть раньше даты начала";
    }

    if (
      form.amount &&
      Number.isNaN(Number(form.amount))
    ) {
      return "Сумма договора указана неверно";
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload: CreateContractPayload = {
      counterparty_id: Number(form.counterpartyId),
      number: form.number.trim(),
      title: form.title.trim(),
      contract_date: form.contractDate,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      amount: form.amount.trim() || null,
      currency: form.currency.trim().toUpperCase(),
      notes: form.notes.trim() || null,
      owner_role: form.ownerRole,
      counterparty_role: form.counterpartyRole,
    };

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await createContract(payload);

      onCreated(created);
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Не удалось создать договор",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isBusy = isLoadingData || isSubmitting;

  return (
    <div
      className="modalBackdrop"
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
      <section
        className="modalCard contractModalCard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-contract-title"
      >
        <div className="modalHeader">
          <div>
            <p className="modalEyebrow">
              Новый договор
            </p>

            <h2 id="create-contract-title">
              Создание договора
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
        </div>

        <form
          className="counterpartyForm contractForm"
          onSubmit={handleSubmit}
        >
          <section className="contractPartiesSection">
            <div className="formSectionHeader">
              <div>
                <span>Стороны договора</span>
                <strong>
                  Наша организация и контрагент
                </strong>
              </div>
            </div>

            <div className="contractPartiesGrid">
              <article className="contractPartyCard ownerPartyCard">
                <div className="contractPartyHeading">
                  <span className="partyNumber">1</span>

                  <div>
                    <small>Наша организация</small>
                    <strong>
                      {organization?.short_name ||
                        organization?.name ||
                        "ООО «Промас Инжиниринг»"}
                    </strong>
                  </div>
                </div>

                <label className="formField">
                  <span>Роль нашей организации</span>

                  <select
                    value={form.ownerRole}
                    onChange={(event) =>
                      handleOwnerRoleChange(
                        event.target
                          .value as ContractPartyRole,
                      )
                    }
                    disabled={isBusy}
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
              </article>

              <article className="contractPartyCard">
                <div className="contractPartyHeading">
                  <span className="partyNumber">2</span>

                  <div>
                    <small>Внешняя сторона</small>
                    <strong>
                      {selectedCounterparty
                        ? selectedCounterparty.short_name ||
                          selectedCounterparty.name
                        : "Выберите контрагента"}
                    </strong>
                  </div>
                </div>

                <label className="formField">
                  <span>
                    Контрагент <strong>*</strong>
                  </span>

                  <select
                    value={form.counterpartyId}
                    onChange={(event) =>
                      updateField(
                        "counterpartyId",
                        event.target.value,
                      )
                    }
                    disabled={
                      isBusy ||
                      initialCounterpartyId !== null &&
                        initialCounterpartyId !==
                          undefined
                    }
                  >
                    <option value="">
                      Выберите контрагента
                    </option>

                    {counterparties.map(
                      (counterparty) => (
                        <option
                          key={counterparty.id}
                          value={counterparty.id}
                        >
                          {counterparty.short_name ||
                            counterparty.name}{" "}
                          — УНП {counterparty.unp}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="formField">
                  <span>Роль контрагента</span>

                  <select
                    value={form.counterpartyRole}
                    onChange={(event) =>
                      updateField(
                        "counterpartyRole",
                        event.target
                          .value as ContractPartyRole,
                      )
                    }
                    disabled={isBusy}
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
              </article>
            </div>

            <p className="roleHint">
              Роли предлагаются автоматически, но их можно
              изменить независимо для каждой стороны.
            </p>
          </section>

          <section className="contractFieldsSection">
            <div className="formSectionHeader">
              <div>
                <span>Основные сведения</span>
                <strong>Реквизиты договора</strong>
              </div>
            </div>

            <div className="contractFormGrid">
              <label className="formField">
                <span>
                  Номер договора <strong>*</strong>
                </span>

                <input
                  type="text"
                  value={form.number}
                  onChange={(event) =>
                    updateField(
                      "number",
                      event.target.value,
                    )
                  }
                  placeholder="Например, 15/07-2026"
                  maxLength={100}
                  disabled={isBusy}
                />
              </label>

              <label className="formField">
                <span>
                  Дата договора <strong>*</strong>
                </span>

                <input
                  type="date"
                  value={form.contractDate}
                  onChange={(event) =>
                    updateField(
                      "contractDate",
                      event.target.value,
                    )
                  }
                  disabled={isBusy}
                />
              </label>

              <label className="formField contractWideField">
                <span>
                  Название или предмет договора{" "}
                  <strong>*</strong>
                </span>

                <input
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    updateField(
                      "title",
                      event.target.value,
                    )
                  }
                  placeholder="Договор поставки оборудования"
                  maxLength={500}
                  disabled={isBusy}
                />
              </label>

              <label className="formField">
                <span>Дата начала</span>

                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    updateField(
                      "startDate",
                      event.target.value,
                    )
                  }
                  disabled={isBusy}
                />
              </label>

              <label className="formField">
                <span>Дата окончания</span>

                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    updateField(
                      "endDate",
                      event.target.value,
                    )
                  }
                  disabled={isBusy}
                />
              </label>

              <label className="formField">
                <span>Сумма договора</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    updateField(
                      "amount",
                      event.target.value,
                    )
                  }
                  placeholder="0.00"
                  disabled={isBusy}
                />
              </label>

              <label className="formField">
                <span>Валюта</span>

                <select
                  value={form.currency}
                  onChange={(event) =>
                    updateField(
                      "currency",
                      event.target.value,
                    )
                  }
                  disabled={isBusy}
                >
                  <option value="BYN">BYN</option>
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="CNY">CNY</option>
                </select>
              </label>

              <label className="formField contractWideField">
                <span>Примечание</span>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    updateField(
                      "notes",
                      event.target.value,
                    )
                  }
                  rows={3}
                  placeholder="Дополнительная информация"
                  disabled={isBusy}
                />
              </label>
            </div>
          </section>

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
              disabled={isBusy}
            >
              Отмена
            </button>

            <button
              type="submit"
              className="primaryButton"
              disabled={isBusy}
            >
              {isSubmitting
                ? "Создаём…"
                : "Создать договор"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}