import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import { ApiError } from "../../api/client";
import {
  archiveCounterparty,
  restoreCounterparty,
  updateCounterparty,
} from "../../api/counterparties";
import { getContracts } from "../../api/contracts";

import { getContractRoleLabel } from
  "../../constants/contractRoles";

import type { Contract } from "../../types/contract";
import type { Counterparty } from
  "../../types/counterparty";

import { CreateContractModal } from
  "../contracts/CreateContractModal";

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

const emptyForm: FormState = {
  name: "",
  shortName: "",
  legalAddress: "",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU");
}

function formatContractAmount(
  amount: string | null,
  currency: string,
): string {
  if (!amount) {
    return "Не указана";
  }

  return `${Number(amount).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function getContractStatusLabel(
  status: string,
): string {
  const labels: Record<string, string> = {
    draft: "Черновик",
    active: "Действует",
    completed: "Завершён",
    terminated: "Расторгнут",
    archived: "В архиве",
  };

  return labels[status] ?? status;
}

function getContractStatusClass(
  status: string,
): string {
  if (status === "active") {
    return "statusBadgeActive";
  }

  if (
    status === "completed" ||
    status === "archived"
  ) {
    return "statusBadgeArchived";
  }

  return "statusBadgeDraft";
}

export function CounterpartyDetailsDrawer({
  counterparty,
  onClose,
  onChanged,
}: CounterpartyDetailsDrawerProps) {
  const [form, setForm] =
    useState<FormState>(emptyForm);

  const [isSaving, setIsSaving] =
    useState(false);

  const [isChangingStatus, setIsChangingStatus] =
    useState(false);

  const [error, setError] = useState<string | null>(
    null,
  );

  const [contracts, setContracts] = useState<
    Contract[]
  >([]);

  const [isContractsLoading, setIsContractsLoading] =
    useState(false);

  const [contractsError, setContractsError] =
    useState<string | null>(null);

  const [
    isContractModalOpen,
    setIsContractModalOpen,
  ] = useState(false);

  const loadContracts = useCallback(async () => {
    if (!counterparty) {
      setContracts([]);
      return;
    }

    setIsContractsLoading(true);
    setContractsError(null);

    try {
      const loadedContracts = await getContracts({
        counterpartyId: counterparty.id,
        limit: 100,
      });

      setContracts(loadedContracts);
    } catch (requestError) {
      setContractsError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить договоры",
      );
    } finally {
      setIsContractsLoading(false);
    }
  }, [counterparty]);

  useEffect(() => {
    if (!counterparty) {
      setForm(emptyForm);
      setContracts([]);
      setError(null);
      setContractsError(null);
      setIsContractModalOpen(false);
      return;
    }

    setForm({
      name: counterparty.name,
      shortName: counterparty.short_name ?? "",
      legalAddress:
        counterparty.legal_address ?? "",
    });

    setError(null);
    setIsContractModalOpen(false);
  }, [counterparty]);

  useEffect(() => {
    if (!counterparty) {
      return;
    }

    void loadContracts();
  }, [counterparty, loadContracts]);

  useEffect(() => {
    if (!counterparty) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !isSaving &&
        !isChangingStatus &&
        !isContractModalOpen
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
  }, [
    counterparty,
    isSaving,
    isChangingStatus,
    isContractModalOpen,
    onClose,
  ]);

  if (!counterparty) {
    return null;
  }

  const currentCounterparty: Counterparty =
    counterparty;

  const isBusy =
    isSaving || isChangingStatus;

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
      setError(
        "Полное наименование обязательно",
      );
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updated = await updateCounterparty(
        currentCounterparty.id,
        {
          name,
          short_name:
            form.shortName.trim() || null,
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
    const isArchiving =
      currentCounterparty.status === "active";

    const confirmed = window.confirm(
      isArchiving
        ? "Переместить контрагента в архив?"
        : "Восстановить контрагента из архива?",
    );

    if (!confirmed) {
      return;
    }

    setIsChangingStatus(true);
    setError(null);

    try {
      const changed = isArchiving
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
          !isBusy &&
          !isContractModalOpen
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
            disabled={
              isBusy || isContractModalOpen
            }
            aria-label="Закрыть карточку"
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
            <strong>
              {currentCounterparty.unp}
            </strong>
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
                updateField(
                  "name",
                  event.target.value,
                )
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
                {formatDate(
                  currentCounterparty.created_at,
                )}
              </strong>
            </div>

            <div>
              <span>Обновлён</span>

              <strong>
                {formatDate(
                  currentCounterparty.updated_at,
                )}
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

          <div className="drawerActions">
            <button
              type="button"
              className={
                currentCounterparty.status ===
                "active"
                  ? "dangerButton"
                  : "secondaryButton"
              }
              onClick={() =>
                void handleStatusChange()
              }
              disabled={isBusy}
            >
              {isChangingStatus
                ? "Выполняем…"
                : currentCounterparty.status ===
                    "active"
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
          <div className="drawerSectionHeader">
            <div>
              <p className="modalEyebrow">
                Договорная работа
              </p>

              <h3>
                Договоры с контрагентом
              </h3>
            </div>

            <button
              type="button"
              className="secondaryButton"
              onClick={() =>
                setIsContractModalOpen(true)
              }
              disabled={
                currentCounterparty.status ===
                "archived"
              }
            >
              + Новый договор
            </button>
          </div>

          {currentCounterparty.status ===
            "archived" && (
            <div className="drawerNotice">
              Сначала восстановите контрагента
              из архива, чтобы создать новый
              договор.
            </div>
          )}

          {isContractsLoading && (
            <div className="drawerEmptyState">
              <span className="loader" />
              <span>Загружаем договоры…</span>
            </div>
          )}

          {!isContractsLoading &&
            contractsError && (
              <div
                className="drawerContractsError"
                role="alert"
              >
                <div>
                  <strong>
                    Не удалось загрузить договоры
                  </strong>

                  <span>{contractsError}</span>
                </div>

                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() =>
                    void loadContracts()
                  }
                >
                  Повторить
                </button>
              </div>
            )}

          {!isContractsLoading &&
            !contractsError &&
            contracts.length === 0 && (
              <div className="drawerEmptyState">
                <strong>
                  Договоров пока нет
                </strong>

                <span>
                  Создайте первый договор с этим
                  контрагентом.
                </span>
              </div>
            )}

          {!isContractsLoading &&
            !contractsError &&
            contracts.length > 0 && (
              <div className="counterpartyContractsList">
                {contracts.map((contract) => (
                  <article
                    key={contract.id}
                    className="counterpartyContractCard"
                  >
                    <div className="counterpartyContractHeader">
                      <div>
                        <strong>
                          № {contract.number}
                        </strong>

                        <span>
                          {contract.title}
                        </span>
                      </div>

                      <span
                        className={`statusBadge ${getContractStatusClass(
                          contract.status,
                        )}`}
                      >
                        {getContractStatusLabel(
                          contract.status,
                        )}
                      </span>
                    </div>

                    <div className="counterpartyContractMeta">
                      <span>
                        Дата:{" "}
                        <strong>
                          {formatDate(
                            contract.contract_date,
                          )}
                        </strong>
                      </span>

                      <span>
                        Сумма:{" "}
                        <strong>
                          {formatContractAmount(
                            contract.amount,
                            contract.currency,
                          )}
                        </strong>
                      </span>
                    </div>

                    <div className="counterpartyContractRoles">
                      <span>
                        Промас Инжиниринг

                        <strong>
                          {getContractRoleLabel(
                            contract.owner_role,
                          )}
                        </strong>
                      </span>

                      <span>
                        Контрагент

                        <strong>
                          {getContractRoleLabel(
                            contract.counterparty_role,
                          )}
                        </strong>
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
        </section>
      </aside>

      <CreateContractModal
        isOpen={isContractModalOpen}
        initialCounterpartyId={
          currentCounterparty.id
        }
        onClose={() =>
          setIsContractModalOpen(false)
        }
        onCreated={(createdContract) => {
          setContracts((current) => [
            createdContract,
            ...current,
          ]);

          setIsContractModalOpen(false);
        }}
      />
    </div>
  );
}