import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  Building2,
  ClipboardList,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import {
  Link,
  useParams,
} from "react-router-dom";

import {
  archiveCounterparty,
  getCounterparty,
  restoreCounterparty,
  updateCounterparty,
} from "../api/counterparties";
import {
  getCounterpartyContracts,
  getCounterpartyTechnicalSpecifications,
} from "../api/counterpartyRelations";
import {
  CounterpartyFormDialog,
  type CounterpartyFormValues,
} from
  "../components/counterparties/CounterpartyFormDialog";
import { ConfirmDialog } from
  "../components/ui/ConfirmDialog";
import type {
  ContractStatus,
  TechnicalSpecificationStatus,
} from "../types/counterpartyRelations";
import { formatDate, formatDateTime } from
  "../utils/formatters";
import "../styles/records.css";

const contractStatusLabels: Record<
  ContractStatus,
  string
> = {
  draft: "Черновик",
  pending_approval: "На согласовании",
  active: "Действующий",
  completed: "Завершён",
  terminated: "Расторгнут",
};

const technicalSpecificationStatusLabels: Record<
  TechnicalSpecificationStatus,
  string
> = {
  draft: "Черновик",
  pending_approval: "На согласовании",
  approved: "Утверждено",
  issued: "Выдано",
  cancelled: "Отменено",
};

export function CounterpartyPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const counterpartyId = Number(id);
  const isValidId =
    Number.isInteger(counterpartyId) &&
    counterpartyId > 0;

  const [isEditing, setIsEditing] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] =
    useState(false);

  const counterpartyQuery = useQuery({
    queryKey: ["counterparty", counterpartyId],
    queryFn: () => getCounterparty(counterpartyId),
    enabled: isValidId,
  });

  const contractsQuery = useQuery({
    queryKey: [
      "counterparty",
      counterpartyId,
      "contracts",
    ],
    queryFn: () =>
      getCounterpartyContracts(counterpartyId),
    enabled:
      isValidId && Boolean(counterpartyQuery.data),
  });

  const technicalSpecificationsQuery = useQuery({
    queryKey: [
      "counterparty",
      counterpartyId,
      "technical-specifications",
    ],
    queryFn: () =>
      getCounterpartyTechnicalSpecifications(
        counterpartyId,
      ),
    enabled:
      isValidId && Boolean(counterpartyQuery.data),
  });

  const statusMutation = useMutation({
    mutationFn: () => {
      const counterparty = counterpartyQuery.data;

      if (!counterparty) {
        throw new Error("Контрагент не загружен");
      }

      return counterparty.status === "archived"
        ? restoreCounterparty(counterparty.id)
        : archiveCounterparty(counterparty.id);
    },
    onSuccess: async (updated) => {
      setIsStatusDialogOpen(false);
      queryClient.setQueryData(
        ["counterparty", updated.id],
        updated,
      );
      await queryClient.invalidateQueries({
        queryKey: ["counterparties"],
      });
    },
  });

  async function update(
    values: CounterpartyFormValues,
  ) {
    const updated = await updateCounterparty(
      counterpartyId,
      {
        name: values.name.trim(),
        short_name: values.shortName.trim() || null,
        legal_address:
          values.legalAddress.trim() || null,
      },
    );

    queryClient.setQueryData(
      ["counterparty", updated.id],
      updated,
    );
    setIsEditing(false);
    await queryClient.invalidateQueries({
      queryKey: ["counterparties"],
    });
  }

  if (!isValidId) {
    return (
      <section className="page">
        <div className="records-state records-state--error records-state--card">
          <Building2 size={30} aria-hidden="true" />
          <strong>Некорректный идентификатор</strong>
          <span>
            Проверьте адрес страницы контрагента.
          </span>
          <Link
            to="/counterparties"
            className="button button--secondary"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            В реестр
          </Link>
        </div>
      </section>
    );
  }

  if (counterpartyQuery.isLoading) {
    return (
      <section className="page">
        <div
          className="records-state records-state--card"
          role="status"
        >
          <span className="loading-spinner" />
          <strong>Загружаем карточку</strong>
          <span>Получаем реквизиты контрагента…</span>
        </div>
      </section>
    );
  }

  if (
    counterpartyQuery.isError ||
    !counterpartyQuery.data
  ) {
    return (
      <section className="page">
        <div className="records-state records-state--error records-state--card">
          <Building2 size={30} aria-hidden="true" />
          <strong>
            Не удалось открыть контрагента
          </strong>
          <span>
            {counterpartyQuery.error instanceof Error
              ? counterpartyQuery.error.message
              : "Контрагент не найден"}
          </span>
          <div className="records-state__actions">
            <Link
              to="/counterparties"
              className="button button--secondary"
            >
              <ArrowLeft
                size={17}
                aria-hidden="true"
              />
              В реестр
            </Link>
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                void counterpartyQuery.refetch();
              }}
            >
              Повторить
            </button>
          </div>
        </div>
      </section>
    );
  }

  const counterparty = counterpartyQuery.data;
  const isArchived =
    counterparty.status === "archived";

  return (
    <section className="page">
      <div className="detail-breadcrumb">
        <Link to="/counterparties">
          <ArrowLeft size={16} aria-hidden="true" />
          Контрагенты
        </Link>
      </div>

      <div className="detail-heading">
        <div className="detail-heading__identity">
          <span className="detail-heading__icon">
            <Building2 size={25} aria-hidden="true" />
          </span>
          <div>
            <span className="page-eyebrow">
              УНП {counterparty.unp}
            </span>
            <h1>
              {counterparty.short_name ||
                counterparty.name}
            </h1>
            {counterparty.short_name && (
              <p>{counterparty.name}</p>
            )}
          </div>
        </div>

        <div className="detail-heading__actions">
          <span
            className={
              isArchived
                ? "status-badge status-badge--muted"
                : "status-badge status-badge--active"
            }
          >
            {isArchived ? "В архиве" : "Активен"}
          </span>
          <button
            type="button"
            className="button button--secondary"
            disabled={isArchived}
            onClick={() => setIsEditing(true)}
            title={
              isArchived
                ? "Сначала восстановите контрагента"
                : undefined
            }
          >
            <Pencil size={17} aria-hidden="true" />
            Изменить
          </button>
          <button
            type="button"
            className={
              isArchived
                ? "button button--primary"
                : "button button--danger"
            }
            onClick={() => setIsStatusDialogOpen(true)}
          >
            {isArchived ? (
              <RotateCcw size={17} aria-hidden="true" />
            ) : (
              <Archive size={17} aria-hidden="true" />
            )}
            {isArchived
              ? "Восстановить"
              : "Архивировать"}
          </button>
        </div>
      </div>

      {isArchived && (
        <div className="record-notice" role="note">
          <Archive size={20} aria-hidden="true" />
          <div>
            <strong>Карточка только для чтения</strong>
            <span>
              Восстановите контрагента, чтобы изменить
              реквизиты или создать связанный документ.
            </span>
          </div>
        </div>
      )}

      <div className="detail-grid">
        <section className="detail-card">
          <div className="detail-card__heading">
            <div>
              <span className="section-kicker">
                Основные сведения
              </span>
              <h2>Реквизиты</h2>
            </div>
          </div>

          <dl className="description-list">
            <div>
              <dt>УНП</dt>
              <dd>{counterparty.unp}</dd>
            </div>
            <div>
              <dt>Краткое наименование</dt>
              <dd>{counterparty.short_name || "—"}</dd>
            </div>
            <div className="description-list__wide">
              <dt>Полное наименование</dt>
              <dd>{counterparty.name}</dd>
            </div>
            <div className="description-list__wide">
              <dt>Юридический адрес</dt>
              <dd>
                {counterparty.legal_address || "—"}
              </dd>
            </div>
            <div>
              <dt>Создан</dt>
              <dd>
                {formatDateTime(
                  counterparty.created_at,
                )}
              </dd>
            </div>
            <div>
              <dt>Последнее изменение</dt>
              <dd>
                {formatDateTime(
                  counterparty.updated_at,
                )}
              </dd>
            </div>
          </dl>
        </section>

        <aside className="detail-card detail-card--actions">
          <div className="detail-card__heading">
            <div>
              <span className="section-kicker">
                Быстрые действия
              </span>
              <h2>Создать документ</h2>
            </div>
          </div>

          <Link
            to={`/contracts/new?counterparty_id=${counterparty.id}`}
            className={
              isArchived
                ? "record-action record-action--disabled"
                : "record-action"
            }
            aria-disabled={isArchived}
            onClick={(event) => {
              if (isArchived) {
                event.preventDefault();
              }
            }}
          >
            <FileText size={20} aria-hidden="true" />
            <span>
              <strong>Новый договор</strong>
              <small>
                Контрагент будет выбран заранее
              </small>
            </span>
            <Plus size={17} aria-hidden="true" />
          </Link>

          <Link
            to={`/technical-specifications/new?counterparty_id=${counterparty.id}`}
            className={
              isArchived
                ? "record-action record-action--disabled"
                : "record-action"
            }
            aria-disabled={isArchived}
            onClick={(event) => {
              if (isArchived) {
                event.preventDefault();
              }
            }}
          >
            <ClipboardList
              size={20}
              aria-hidden="true"
            />
            <span>
              <strong>Новое ТЗ</strong>
              <small>
                Создать техническое задание
              </small>
            </span>
            <Plus size={17} aria-hidden="true" />
          </Link>
        </aside>
      </div>

      <div className="related-grid">
        <section className="detail-card">
          <div className="detail-card__heading detail-card__heading--linked">
            <div>
              <span className="section-kicker">
                Связанные записи
              </span>
              <h2>Договоры</h2>
            </div>
            <Link
              to={`/contracts?counterparty_id=${counterparty.id}`}
            >
              Все договоры
            </Link>
          </div>

          {contractsQuery.isLoading && (
            <div
              className="related-state"
              role="status"
            >
              <span className="loading-spinner" />
              Загружаем договоры…
            </div>
          )}
          {contractsQuery.isError && (
            <div className="related-state related-state--error">
              <span>Не удалось загрузить договоры.</span>
              <button
                type="button"
                onClick={() => {
                  void contractsQuery.refetch();
                }}
              >
                Повторить
              </button>
            </div>
          )}
          {contractsQuery.data?.items.length ===
            0 && (
            <div className="related-empty">
              <FileText size={24} aria-hidden="true" />
              <span>Связанных договоров пока нет</span>
            </div>
          )}
          {contractsQuery.data &&
            contractsQuery.data.items.length > 0 && (
              <ul className="related-list">
                {contractsQuery.data.items.map(
                  (contract) => (
                    <li key={contract.id}>
                      <Link
                        to={`/contracts/${contract.id}`}
                      >
                        <span>
                          <strong>
                            {contract.number}
                          </strong>
                          <small>{contract.title}</small>
                        </span>
                        <span>
                          {formatDate(
                            contract.contract_date,
                          )}
                          <small>
                            {
                              contractStatusLabels[
                                contract.status
                              ]
                            }
                          </small>
                        </span>
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            )}
        </section>

        <section className="detail-card">
          <div className="detail-card__heading detail-card__heading--linked">
            <div>
              <span className="section-kicker">
                Связанные записи
              </span>
              <h2>Технические задания</h2>
            </div>
            <Link
              to={`/technical-specifications?counterparty_id=${counterparty.id}`}
            >
              Все ТЗ
            </Link>
          </div>

          {technicalSpecificationsQuery.isLoading && (
            <div
              className="related-state"
              role="status"
            >
              <span className="loading-spinner" />
              Загружаем ТЗ…
            </div>
          )}
          {technicalSpecificationsQuery.isError && (
            <div className="related-state related-state--error">
              <span>Не удалось загрузить ТЗ.</span>
              <button
                type="button"
                onClick={() => {
                  void technicalSpecificationsQuery.refetch();
                }}
              >
                Повторить
              </button>
            </div>
          )}
          {technicalSpecificationsQuery.data?.items
            .length === 0 && (
            <div className="related-empty">
              <ClipboardList
                size={24}
                aria-hidden="true"
              />
              <span>Связанных ТЗ пока нет</span>
            </div>
          )}
          {technicalSpecificationsQuery.data &&
            technicalSpecificationsQuery.data.items
              .length > 0 && (
              <ul className="related-list">
                {technicalSpecificationsQuery.data.items.map(
                  (specification) => (
                    <li key={specification.id}>
                      <Link
                        to={`/technical-specifications/${specification.id}`}
                      >
                        <span>
                          <strong>
                            {specification.title}
                          </strong>
                          <small>
                            {
                              specification.procurement_subject
                            }
                          </small>
                        </span>
                        <span>
                          {formatDateTime(
                            specification.updated_at,
                          )}
                          <small>
                            {
                              technicalSpecificationStatusLabels[
                                specification.status
                              ]
                            }
                          </small>
                        </span>
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            )}
        </section>
      </div>

      {isEditing && (
        <CounterpartyFormDialog
          mode="edit"
          counterparty={counterparty}
          onClose={() => setIsEditing(false)}
          onSubmit={update}
        />
      )}

      <ConfirmDialog
        isOpen={isStatusDialogOpen}
        title={
          isArchived
            ? "Восстановить контрагента?"
            : "Архивировать контрагента?"
        }
        description={
          isArchived
            ? "Карточка снова станет доступна для редактирования и создания связанных документов."
            : "Все данные и связи сохранятся. Контрагент исчезнет из списка активных."
        }
        confirmLabel={
          isArchived ? "Восстановить" : "Архивировать"
        }
        tone={isArchived ? "primary" : "danger"}
        isPending={statusMutation.isPending}
        onCancel={() => {
          if (!statusMutation.isPending) {
            setIsStatusDialogOpen(false);
            statusMutation.reset();
          }
        }}
        onConfirm={() => statusMutation.mutate()}
      />

      {statusMutation.isError && (
        <div
          className="toast toast--error"
          role="alert"
        >
          {statusMutation.error instanceof Error
            ? statusMutation.error.message
            : "Не удалось изменить состояние"}
        </div>
      )}
    </section>
  );
}
