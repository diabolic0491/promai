import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import { ApiError } from "../../api/client";
import {
  archiveContract,
  restoreContract,
  updateContract,
} from "../../api/contracts";

import { contractRoleOptions } from
  "../../constants/contractRoles";

import type {
  Contract,
  ContractPartyRole,
  UpdateContractPayload,
} from "../../types/contract";
import type { Counterparty } from
  "../../types/counterparty";
import type { OrganizationProfile } from
  "../../types/organizationProfile";


interface ContractDetailsDrawerProps {
  contract: Contract | null;
  counterparty: Counterparty | null;
  organization: OrganizationProfile | null;
  onClose: () => void;
  onChanged: (contract: Contract) => void;
}


interface FormState {
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


function createFormState(
  contract: Contract,
): FormState {
  return {
    number: contract.number,
    title: contract.title,

    contractDate: contract.contract_date,
    startDate: contract.start_date ?? "",
    endDate: contract.end_date ?? "",

    amount: contract.amount ?? "",
    currency: contract.currency,
    notes: contract.notes ?? "",

    ownerRole: contract.owner_role,
    counterpartyRole:
      contract.counterparty_role,
  };
}


function validateForm(
  formState: FormState,
): string | null {
  if (!formState.number.trim()) {
    return "Укажите номер договора";
  }

  if (!formState.title.trim()) {
    return "Укажите название или предмет договора";
  }

  if (!formState.contractDate) {
    return "Укажите дату договора";
  }

  if (
    formState.startDate &&
    formState.endDate &&
    formState.endDate < formState.startDate
  ) {
    return (
      "Дата окончания не может быть раньше " +
      "даты начала"
    );
  }

  if (
    formState.amount &&
    (
      Number.isNaN(Number(formState.amount)) ||
      Number(formState.amount) < 0
    )
  ) {
    return "Сумма договора указана неверно";
  }

  const currency =
    formState.currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    return (
      "Код валюты должен состоять " +
      "из трёх букв"
    );
  }

  return null;
}


function formatStatus(
  status: string,
): string {
  const statuses: Record<string, string> = {
    draft: "Черновик",
    pending_approval: "На согласовании",
    active: "Действующий",
    completed: "Завершён",
    terminated: "Расторгнут",
    archived: "В архиве",
  };

  return statuses[status] ?? status;
}


export function ContractDetailsDrawer({
  contract,
  counterparty,
  organization,
  onClose,
  onChanged,
}: ContractDetailsDrawerProps) {
  const [form, setForm] =
    useState<FormState | null>(null);

  const [isSaving, setIsSaving] =
    useState(false);

  const [
    isChangingArchiveStatus,
    setIsChangingArchiveStatus,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const isArchived =
    contract?.status === "archived";

  const isBusy =
    isSaving || isChangingArchiveStatus;


  useEffect(() => {
    if (!contract) {
      setForm(null);
      return;
    }

    setForm(createFormState(contract));
    setError(null);
    setSuccessMessage(null);
  }, [contract]);


  useEffect(() => {
    if (!contract) {
      return;
    }

    function handleEscape(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape" &&
        !isBusy
      ) {
        onClose();
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape,
    );

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape,
      );

      document.body.style.overflow = "";
    };
  }, [contract, isBusy, onClose]);


  function updateField<
    K extends keyof FormState,
  >(
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

    setError(null);
    setSuccessMessage(null);
  }


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const currentForm = form;
    const currentContract = contract;

    if (!currentForm || !currentContract) {
      setError(
        "Данные договора ещё не загружены",
      );
      return;
    }

    if (currentContract.status === "archived") {
      setError(
        "Архивный договор сначала " +
        "нужно восстановить",
      );
      return;
    }

    const validationError =
      validateForm(currentForm);

    if (validationError) {
      setError(validationError);
      setSuccessMessage(null);
      return;
    }

    const payload: UpdateContractPayload = {
      number: currentForm.number.trim(),
      title: currentForm.title.trim(),

      contract_date:
        currentForm.contractDate,

      start_date:
        currentForm.startDate || null,

      end_date:
        currentForm.endDate || null,

      amount:
        currentForm.amount.trim() || null,

      currency:
        currentForm.currency
          .trim()
          .toUpperCase(),

      notes:
        currentForm.notes.trim() || null,

      owner_role:
        currentForm.ownerRole,

      counterparty_role:
        currentForm.counterpartyRole,
    };

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated =
        await updateContract(
          currentContract.id,
          payload,
        );

      setForm(createFormState(updated));
      onChanged(updated);

      setSuccessMessage(
        "Изменения сохранены",
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Не удалось сохранить договор",
      );
    } finally {
      setIsSaving(false);
    }
  }


  async function handleArchiveStatusChange() {
    const currentContract = contract;

    if (!currentContract) {
      setError(
        "Данные договора ещё не загружены",
      );
      return;
    }

    const isArchiving =
      currentContract.status !== "archived";

    const confirmed = window.confirm(
      isArchiving
        ? "Переместить договор в архив?"
        : "Восстановить договор из архива?",
    );

    if (!confirmed) {
      return;
    }

    setIsChangingArchiveStatus(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const changed = isArchiving
        ? await archiveContract(
            currentContract.id,
          )
        : await restoreContract(
            currentContract.id,
          );

      setForm(createFormState(changed));
      onChanged(changed);

      setSuccessMessage(
        isArchiving
          ? "Договор перемещён в архив"
          : "Договор восстановлен",
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : (
              "Не удалось изменить архивный " +
              "статус договора"
            ),
      );
    } finally {
      setIsChangingArchiveStatus(false);
    }
  }


  if (!contract || !form) {
    return null;
  }

  const organizationName =
    organization?.short_name ||
    organization?.name ||
    "ООО «Промас Инжиниринг»";

  const counterpartyName =
    counterparty?.short_name ||
    counterparty?.name ||
    `Контрагент #${contract.counterparty_id}`;

  const fieldsDisabled =
    isBusy || isArchived;


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
        className={
          "detailsDrawer " +
          "contractDetailsDrawer"
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-details-title"
      >
        <header className="drawerHeader">
          <div>
            <p className="modalEyebrow">
              Карточка договора
            </p>

            <h2 id="contract-details-title">
              Договор № {contract.number}
            </h2>

            <span className="drawerHeaderSubtitle">
              {contract.title}
            </span>
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

        <form
          className={
            "drawerForm " +
            "contractDetailsForm"
          }
          onSubmit={handleSubmit}
        >
          <section className="contractDetailsSection">
            <div className="formSectionHeader">
              <div>
                <span>Стороны договора</span>

                <strong>
                  Участники и их роли
                </strong>
              </div>
            </div>

            <div className="contractDetailsParties">
              <article
                className={
                  "contractDetailsParty " +
                  "ownerPartyCard"
                }
              >
                <div>
                  <small>
                    Наша организация
                  </small>

                  <strong>
                    {organizationName}
                  </strong>

                  {organization?.unp && (
                    <span>
                      УНП {organization.unp}
                    </span>
                  )}
                </div>

                <label className="formField">
                  <span>
                    Роль нашей организации
                  </span>

                  <select
                    value={form.ownerRole}
                    onChange={(event) =>
                      updateField(
                        "ownerRole",
                        event.target
                          .value as ContractPartyRole,
                      )
                    }
                    disabled={fieldsDisabled}
                  >
                    {contractRoleOptions.map(
                      (role) => (
                        <option
                          key={role.value}
                          value={role.value}
                        >
                          {role.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </article>

              <article className="contractDetailsParty">
                <div>
                  <small>
                    Контрагент
                  </small>

                  <strong>
                    {counterpartyName}
                  </strong>

                  {counterparty?.unp && (
                    <span>
                      УНП {counterparty.unp}
                    </span>
                  )}
                </div>

                <label className="formField">
                  <span>
                    Роль контрагента
                  </span>

                  <select
                    value={
                      form.counterpartyRole
                    }
                    onChange={(event) =>
                      updateField(
                        "counterpartyRole",
                        event.target
                          .value as ContractPartyRole,
                      )
                    }
                    disabled={fieldsDisabled}
                  >
                    {contractRoleOptions.map(
                      (role) => (
                        <option
                          key={role.value}
                          value={role.value}
                        >
                          {role.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </article>
            </div>
          </section>

          <section className="contractDetailsSection">
            <div className="formSectionHeader">
              <div>
                <span>Реквизиты</span>

                <strong>
                  Основные сведения
                </strong>
              </div>
            </div>

            <div className="contractFormGrid">
              <label className="formField">
                <span>
                  Номер договора{" "}
                  <strong>*</strong>
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
                  maxLength={100}
                  disabled={fieldsDisabled}
                />
              </label>

              <label className="formField">
                <span>
                  Дата договора{" "}
                  <strong>*</strong>
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
                  disabled={fieldsDisabled}
                />
              </label>

              <label
                className={
                  "formField " +
                  "contractWideField"
                }
              >
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
                  maxLength={500}
                  disabled={fieldsDisabled}
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
                  disabled={fieldsDisabled}
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
                  disabled={fieldsDisabled}
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
                  disabled={fieldsDisabled}
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
                  disabled={fieldsDisabled}
                >
                  <option value="BYN">
                    BYN
                  </option>

                  <option value="RUB">
                    RUB
                  </option>

                  <option value="USD">
                    USD
                  </option>

                  <option value="EUR">
                    EUR
                  </option>

                  <option value="CNY">
                    CNY
                  </option>
                </select>
              </label>

              <label
                className={
                  "formField " +
                  "contractWideField"
                }
              >
                <span>Примечание</span>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    updateField(
                      "notes",
                      event.target.value,
                    )
                  }
                  rows={4}
                  disabled={fieldsDisabled}
                />
              </label>
            </div>
          </section>

          <div className="contractSystemInfo">
            <div>
              <span>Статус</span>

              <strong>
                {formatStatus(contract.status)}
              </strong>
            </div>

            <div>
              <span>Создан</span>

              <strong>
                {new Date(
                  contract.created_at,
                ).toLocaleDateString("ru-RU")}
              </strong>
            </div>

            <div>
              <span>Обновлён</span>

              <strong>
                {new Date(
                  contract.updated_at,
                ).toLocaleDateString("ru-RU")}
              </strong>
            </div>
          </div>

          {error && (
            <div
              className="formError"
              role="alert"
            >
              {error}
            </div>
          )}

          {successMessage && (
            <div
              className="formSuccess"
              role="status"
            >
              {successMessage}
            </div>
          )}

          <div
            className={
              "drawerActions " +
              "contractDrawerActions"
            }
          >
            <button
              type="button"
              className={
                isArchived
                  ? "secondaryButton"
                  : "dangerButton"
              }
              onClick={() =>
                void handleArchiveStatusChange()
              }
              disabled={isBusy}
            >
              {isChangingArchiveStatus
                ? "Выполняем…"
                : isArchived
                  ? "Восстановить"
                  : "В архив"}
            </button>

            <button
              type="button"
              className="secondaryButton"
              onClick={onClose}
              disabled={isBusy}
            >
              Закрыть
            </button>

            <button
              type="submit"
              className="primaryButton"
              disabled={fieldsDisabled}
            >
              {isSaving
                ? "Сохраняем…"
                : isArchived
                  ? "Договор в архиве"
                  : "Сохранить изменения"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}