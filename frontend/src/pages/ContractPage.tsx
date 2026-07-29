import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  Pencil,
  RotateCcw,
  ScrollText,
} from "lucide-react";
import { useState } from "react";
import {
  Link,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  archiveContract,
  getContract,
  getContractEvents,
  getContractStatusHistory,
  restoreContract,
  updateContractStatus,
} from "../api/contracts";
import {
  ContractAnalysisTab,
} from "../components/contracts/ContractAnalysisTab";
import {
  ContractDocumentTab,
} from "../components/contracts/ContractDocumentTab";
import {
  ContractVersionsTab,
} from "../components/contracts/ContractVersionsTab";
import {
  ConfirmDialog,
} from "../components/ui/ConfirmDialog";
import {
  allowedContractStatusTransitions,
  contractEventLabels,
  contractFieldLabels,
  contractRoleLabels,
  contractStatusActionLabels,
  contractStatusLabels,
  getTemplateVariableLabel,
} from "../constants/contracts";
import type {
  Contract,
  ContractEvent,
  ContractStatus,
  ContractStatusHistoryEntry,
} from "../types/contract";
import {
  flattenFormData,
} from "../utils/contractFormData";
import {
  formatAmount,
  formatDate,
  formatDateTime,
} from "../utils/formatters";
import "../styles/records.css";
import "../styles/contracts.css";

type ContractTab =
  | "details"
  | "document"
  | "versions"
  | "analysis"
  | "status-history"
  | "events";

const tabs: Array<{
  id: ContractTab;
  label: string;
}> = [
  { id: "details", label: "Сведения" },
  { id: "document", label: "Документ" },
  { id: "versions", label: "Версии" },
  { id: "analysis", label: "AI-анализ" },
  {
    id: "status-history",
    label: "История статусов",
  },
  { id: "events", label: "События" },
];

function isContractTab(
  value: string | null,
): value is ContractTab {
  return tabs.some((tab) => tab.id === value);
}

function readPositiveInteger(
  value: string | null | undefined,
): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : undefined;
}

function actorLabel(
  userId: number | null,
): string {
  return userId
    ? `Пользователь #${userId}`
    : "Система";
}

function statusLabelFromUnknown(
  value: unknown,
): string {
  if (
    typeof value === "string" &&
    value in contractStatusLabels
  ) {
    return contractStatusLabels[
      value as ContractStatus
    ];
  }

  return "не указан";
}

function eventDescription(
  event: ContractEvent,
): string {
  const data = event.event_data;

  if (!data) {
    return contractEventLabels[event.event_type];
  }

  if (event.event_type === "status_changed") {
    return `${statusLabelFromUnknown(
      data.from_status,
    )} → ${statusLabelFromUnknown(data.to_status)}`;
  }

  if (
    event.event_type === "updated" &&
    Array.isArray(data.changed_fields)
  ) {
    const fields = data.changed_fields
      .filter(
        (field): field is string =>
          typeof field === "string",
      )
      .map(
        (field) =>
          contractFieldLabels[field] ?? field,
      );

    return fields.length
      ? `Изменены поля: ${fields.join(", ")}`
      : "Сведения договора обновлены";
  }

  if (
    event.event_type === "archived" ||
    event.event_type === "restored"
  ) {
    return `Бизнес-статус сохранён: ${statusLabelFromUnknown(
      data.status,
    )}`;
  }

  if (event.event_type === "generated") {
    const version =
      typeof data.version_number === "number"
        ? `, версия ${data.version_number}`
        : "";
    return `Создан DOCX${version}`;
  }

  if (event.event_type === "uploaded") {
    const version =
      typeof data.version_number === "number"
        ? `Версия ${data.version_number}`
        : "Новая версия";
    return `${version} загружена пользователем`;
  }

  return contractEventLabels[event.event_type];
}

function ContractTimeline({
  items,
}: {
  items: ContractStatusHistoryEntry[];
}) {
  if (items.length === 0) {
    return (
      <div className="contract-tab-empty">
        <History size={28} aria-hidden="true" />
        <strong>История пока пуста</strong>
        <span>
          Первый статус появится после создания
          договора.
        </span>
      </div>
    );
  }

  return (
    <ol className="contract-timeline">
      {items.map((entry) => (
        <li key={entry.id}>
          <span
            className={`contract-timeline__marker contract-status--${entry.to_status}`}
            aria-hidden="true"
          />
          <div>
            <strong>
              {entry.from_status
                ? `${
                    contractStatusLabels[
                      entry.from_status
                    ]
                  } → ${
                    contractStatusLabels[
                      entry.to_status
                    ]
                  }`
                : `Начальный статус: ${
                    contractStatusLabels[
                      entry.to_status
                    ]
                  }`}
            </strong>
            <span>
              {actorLabel(entry.changed_by_user_id)}
            </span>
          </div>
          <time dateTime={entry.changed_at}>
            {formatDateTime(entry.changed_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}

function ContractEvents({
  items,
}: {
  items: ContractEvent[];
}) {
  if (items.length === 0) {
    return (
      <div className="contract-tab-empty">
        <Clock3 size={28} aria-hidden="true" />
        <strong>Событий пока нет</strong>
        <span>
          Здесь появится проверяемая хронология
          действий.
        </span>
      </div>
    );
  }

  return (
    <ul className="contract-events">
      {items.map((event) => (
        <li key={event.id}>
          <span className="contract-events__icon">
            <Clock3 size={17} aria-hidden="true" />
          </span>
          <div>
            <strong>
              {contractEventLabels[event.event_type]}
            </strong>
            <span>{eventDescription(event)}</span>
            <small>
              {actorLabel(event.actor_user_id)}
            </small>
          </div>
          <time dateTime={event.created_at}>
            {formatDateTime(event.created_at)}
          </time>
        </li>
      ))}
    </ul>
  );
}

function ContractDetails({
  contract,
  onStatusChange,
}: {
  contract: Contract;
  onStatusChange: (status: ContractStatus) => void;
}) {
  const formData = flattenFormData(contract.form_data);
  const allowedStatuses =
    allowedContractStatusTransitions[contract.status];

  return (
    <div className="contract-details-layout">
      <div className="contract-details-main">
        <section className="detail-card">
          <div className="detail-card__heading">
            <div>
              <span className="section-kicker">
                Основные сведения
              </span>
              <h2>Реквизиты договора</h2>
            </div>
          </div>

          <dl className="description-list">
            <div>
              <dt>Номер</dt>
              <dd>№ {contract.number}</dd>
            </div>
            <div>
              <dt>Дата договора</dt>
              <dd>
                {formatDate(contract.contract_date)}
              </dd>
            </div>
            <div className="description-list__wide">
              <dt>Название</dt>
              <dd>{contract.title}</dd>
            </div>
            <div>
              <dt>Начало действия</dt>
              <dd>{formatDate(contract.start_date)}</dd>
            </div>
            <div>
              <dt>Окончание действия</dt>
              <dd>{formatDate(contract.end_date)}</dd>
            </div>
            <div>
              <dt>Сумма</dt>
              <dd>
                {formatAmount(
                  contract.amount,
                  contract.currency,
                )}
              </dd>
            </div>
            <div>
              <dt>Шаблон</dt>
              <dd>
                {contract.template_name || "Не выбран"}
              </dd>
            </div>
            <div>
              <dt>Наша роль</dt>
              <dd>
                {contractRoleLabels[
                  contract.owner_role
                ]}
              </dd>
            </div>
            <div>
              <dt>Роль контрагента</dt>
              <dd>
                {contractRoleLabels[
                  contract.counterparty_role
                ]}
              </dd>
            </div>
            <div className="description-list__wide">
              <dt>Внутреннее примечание</dt>
              <dd>{contract.notes || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="detail-card">
          <div className="detail-card__heading">
            <div>
              <span className="section-kicker">
                Связи
              </span>
              <h2>Контрагент</h2>
            </div>
            <Link
              to={`/counterparties/${contract.counterparty_id}`}
            >
              Открыть карточку
            </Link>
          </div>
          <div className="contract-counterparty-card">
            <span>
              <ScrollText size={21} aria-hidden="true" />
            </span>
            <div>
              <strong>
                {contract.counterparty_name}
              </strong>
              <small>
                Контрагент #{contract.counterparty_id}
              </small>
            </div>
          </div>
        </section>

        {formData.length > 0 && (
          <section className="detail-card">
            <div className="detail-card__heading">
              <div>
                <span className="section-kicker">
                  Шаблон
                </span>
                <h2>Дополнительные данные</h2>
              </div>
            </div>
            <dl className="description-list">
              {formData.map(([variable, value]) => (
                <div key={variable}>
                  <dt>
                    {getTemplateVariableLabel(variable)}
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      <aside className="contract-lifecycle">
        <section className="detail-card">
          <div className="detail-card__heading">
            <div>
              <span className="section-kicker">
                Жизненный цикл
              </span>
              <h2>Текущий статус</h2>
            </div>
          </div>

          <span
            className={`contract-status-large contract-status--${contract.status}`}
          >
            {contractStatusLabels[contract.status]}
          </span>

          {contract.is_archived ? (
            <p className="contract-lifecycle__hint">
              Смена статуса недоступна, пока договор
              находится в архиве.
            </p>
          ) : allowedStatuses.length > 0 ? (
            <div className="contract-status-actions">
              {allowedStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={
                    status === "terminated"
                      ? "button button--danger"
                      : "button button--secondary"
                  }
                  onClick={() => onStatusChange(status)}
                >
                  {contractStatusActionLabels[status] ??
                    contractStatusLabels[status]}
                </button>
              ))}
            </div>
          ) : (
            <div className="contract-final-status">
              <CheckCircle2
                size={18}
                aria-hidden="true"
              />
              Финальный статус. Дальнейшие переходы не
              предусмотрены.
            </div>
          )}
        </section>

        <section className="detail-card">
          <div className="detail-card__heading">
            <div>
              <span className="section-kicker">
                Системные данные
              </span>
              <h2>Карточка</h2>
            </div>
          </div>
          <dl className="contract-system-list">
            <div>
              <dt>Создан</dt>
              <dd>{formatDateTime(contract.created_at)}</dd>
            </div>
            <div>
              <dt>Обновлён</dt>
              <dd>{formatDateTime(contract.updated_at)}</dd>
            </div>
            <div>
              <dt>Архивирован</dt>
              <dd>
                {formatDateTime(contract.archived_at)}
              </dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  );
}

export function ContractPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const contractId = readPositiveInteger(id);
  const tabValue = searchParams.get("tab");
  const requestedVersionNumber =
    readPositiveInteger(searchParams.get("version"));
  const activeTab = isContractTab(tabValue)
    ? tabValue
    : "details";
  const [statusTarget, setStatusTarget] =
    useState<ContractStatus | null>(null);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] =
    useState(false);

  const contractQuery = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => getContract(contractId!),
    enabled: Boolean(contractId),
  });

  const historyQuery = useQuery({
    queryKey: [
      "contract",
      contractId,
      "status-history",
    ],
    queryFn: () =>
      getContractStatusHistory(contractId!),
    enabled:
      Boolean(contractId) &&
      activeTab === "status-history",
  });

  const eventsQuery = useQuery({
    queryKey: ["contract", contractId, "events"],
    queryFn: () => getContractEvents(contractId!),
    enabled:
      Boolean(contractId) && activeTab === "events",
  });

  async function refreshContractData(
    updated: Contract,
  ) {
    queryClient.setQueryData(
      ["contract", updated.id],
      updated,
    );
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["contracts"],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "contract",
          updated.id,
          "status-history",
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "contract",
          updated.id,
          "events",
        ],
      }),
    ]);
  }

  const statusMutation = useMutation({
    mutationFn: (status: ContractStatus) =>
      updateContractStatus(contractId!, status),
    onSuccess: async (updated) => {
      setStatusTarget(null);
      await refreshContractData(updated);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => {
      const contract = contractQuery.data;

      if (!contract) {
        throw new Error("Договор не загружен");
      }

      return contract.is_archived
        ? restoreContract(contract.id)
        : archiveContract(contract.id);
    },
    onSuccess: async (updated) => {
      setIsArchiveDialogOpen(false);
      await refreshContractData(updated);
    },
  });

  if (!contractId) {
    return (
      <section className="page">
        <div className="records-state records-state--error records-state--card">
          <FileText size={30} aria-hidden="true" />
          <strong>Некорректный идентификатор</strong>
          <span>Проверьте адрес страницы договора.</span>
          <Link
            to="/contracts"
            className="button button--secondary"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            В реестр
          </Link>
        </div>
      </section>
    );
  }

  if (contractQuery.isLoading) {
    return (
      <section className="page">
        <div
          className="records-state records-state--card"
          role="status"
        >
          <span className="loading-spinner" />
          <strong>Загружаем договор</strong>
          <span>
            Получаем реквизиты и текущее состояние…
          </span>
        </div>
      </section>
    );
  }

  if (
    contractQuery.isError ||
    !contractQuery.data
  ) {
    return (
      <section className="page">
        <div className="records-state records-state--error records-state--card">
          <FileText size={30} aria-hidden="true" />
          <strong>Не удалось открыть договор</strong>
          <span>
            {contractQuery.error instanceof Error
              ? contractQuery.error.message
              : "Договор не найден"}
          </span>
          <div className="records-state__actions">
            <Link
              to="/contracts"
              className="button button--secondary"
            >
              <ArrowLeft size={17} aria-hidden="true" />
              В реестр
            </Link>
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                void contractQuery.refetch();
              }}
            >
              Повторить
            </button>
          </div>
        </div>
      </section>
    );
  }

  const contract = contractQuery.data;

  return (
    <section className="page">
      <div className="detail-breadcrumb">
        <Link to="/contracts">
          <ArrowLeft size={16} aria-hidden="true" />
          Договоры
        </Link>
      </div>

      <div className="detail-heading">
        <div className="detail-heading__identity">
          <span className="detail-heading__icon">
            <ScrollText size={25} aria-hidden="true" />
          </span>
          <div>
            <span className="page-eyebrow">
              Договор № {contract.number}
            </span>
            <h1>{contract.title}</h1>
            <p>{contract.counterparty_name}</p>
          </div>
        </div>

        <div className="detail-heading__actions">
          <span
            className={`status-badge contract-status--${contract.status}`}
          >
            {contractStatusLabels[contract.status]}
          </span>
          {contract.is_archived && (
            <span className="status-badge status-badge--muted">
              В архиве
            </span>
          )}
          <Link
            to={`/contracts/${contract.id}/edit`}
            className="button button--secondary"
            aria-disabled={contract.is_archived}
            onClick={(event) => {
              if (contract.is_archived) {
                event.preventDefault();
              }
            }}
            title={
              contract.is_archived
                ? "Сначала восстановите договор"
                : undefined
            }
          >
            <Pencil size={17} aria-hidden="true" />
            Изменить
          </Link>
          <button
            type="button"
            className={
              contract.is_archived
                ? "button button--primary"
                : "button button--danger"
            }
            onClick={() =>
              setIsArchiveDialogOpen(true)
            }
          >
            {contract.is_archived ? (
              <RotateCcw size={17} aria-hidden="true" />
            ) : (
              <Archive size={17} aria-hidden="true" />
            )}
            {contract.is_archived
              ? "Восстановить"
              : "Архивировать"}
          </button>
        </div>
      </div>

      {contract.is_archived && (
        <div className="record-notice" role="note">
          <Archive size={20} aria-hidden="true" />
          <div>
            <strong>Карточка только для чтения</strong>
            <span>
              Архивирование не изменило бизнес-статус
              «{contractStatusLabels[contract.status]}».
              Восстановите договор для редактирования и
              переходов статуса.
            </span>
          </div>
        </div>
      )}

      <nav
        className="contract-tabs"
        aria-label="Разделы карточки договора"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to={
              tab.id === "details"
                ? `/contracts/${contract.id}`
                : `/contracts/${contract.id}?tab=${tab.id}`
            }
            className={
              activeTab === tab.id
                ? "contract-tab contract-tab--active"
                : "contract-tab"
            }
            aria-current={
              activeTab === tab.id ? "page" : undefined
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === "details" && (
        <ContractDetails
          contract={contract}
          onStatusChange={setStatusTarget}
        />
      )}

      {activeTab === "document" && (
        <ContractDocumentTab contract={contract} />
      )}

      {activeTab === "versions" && (
        <ContractVersionsTab contract={contract} />
      )}

      {activeTab === "analysis" && (
        <ContractAnalysisTab
          key={requestedVersionNumber ?? "latest"}
          contractId={contract.id}
          requestedVersionNumber={
            requestedVersionNumber
          }
        />
      )}

      {activeTab === "status-history" && (
        <section className="detail-card contract-tab-panel">
          <div className="detail-card__heading">
            <div>
              <span className="section-kicker">
                Неизменяемая хронология
              </span>
              <h2>История статусов</h2>
            </div>
          </div>
          {historyQuery.isLoading && (
            <div
              className="contract-tab-loading"
              role="status"
            >
              <span className="loading-spinner" />
              Загружаем историю…
            </div>
          )}
          {historyQuery.isError && (
            <div className="contract-tab-error">
              <span>
                {historyQuery.error instanceof Error
                  ? historyQuery.error.message
                  : "Не удалось загрузить историю"}
              </span>
              <button
                type="button"
                onClick={() => {
                  void historyQuery.refetch();
                }}
              >
                Повторить
              </button>
            </div>
          )}
          {historyQuery.data && (
            <ContractTimeline
              items={historyQuery.data}
            />
          )}
        </section>
      )}

      {activeTab === "events" && (
        <section className="detail-card contract-tab-panel">
          <div className="detail-card__heading">
            <div>
              <span className="section-kicker">
                Аудит действий
              </span>
              <h2>События договора</h2>
            </div>
          </div>
          {eventsQuery.isLoading && (
            <div
              className="contract-tab-loading"
              role="status"
            >
              <span className="loading-spinner" />
              Загружаем события…
            </div>
          )}
          {eventsQuery.isError && (
            <div className="contract-tab-error">
              <span>
                {eventsQuery.error instanceof Error
                  ? eventsQuery.error.message
                  : "Не удалось загрузить события"}
              </span>
              <button
                type="button"
                onClick={() => {
                  void eventsQuery.refetch();
                }}
              >
                Повторить
              </button>
            </div>
          )}
          {eventsQuery.data && (
            <ContractEvents items={eventsQuery.data} />
          )}
        </section>
      )}

      <ConfirmDialog
        isOpen={Boolean(statusTarget)}
        title={
          statusTarget
            ? `${contractStatusActionLabels[statusTarget] ?? "Изменить статус"}?`
            : "Изменить статус?"
        }
        description={
          statusTarget
            ? `Статус договора изменится с «${contractStatusLabels[contract.status]}» на «${contractStatusLabels[statusTarget]}». Действие будет записано в историю.`
            : ""
        }
        confirmLabel={
          statusTarget
            ? contractStatusActionLabels[statusTarget] ??
              "Изменить"
            : "Изменить"
        }
        tone={
          statusTarget === "terminated"
            ? "danger"
            : "primary"
        }
        isPending={statusMutation.isPending}
        onCancel={() => {
          if (!statusMutation.isPending) {
            setStatusTarget(null);
          }
        }}
        onConfirm={() => {
          if (statusTarget) {
            statusMutation.mutate(statusTarget);
          }
        }}
      />

      <ConfirmDialog
        isOpen={isArchiveDialogOpen}
        title={
          contract.is_archived
            ? "Восстановить договор?"
            : "Архивировать договор?"
        }
        description={
          contract.is_archived
            ? `Договор № ${contract.number} снова станет доступен для редактирования. Статус «${contractStatusLabels[contract.status]}» сохранится.`
            : `Договор № ${contract.number} станет доступен только для чтения. Статус «${contractStatusLabels[contract.status]}» не изменится.`
        }
        confirmLabel={
          contract.is_archived
            ? "Восстановить"
            : "Архивировать"
        }
        tone={
          contract.is_archived ? "primary" : "danger"
        }
        isPending={archiveMutation.isPending}
        onCancel={() => {
          if (!archiveMutation.isPending) {
            setIsArchiveDialogOpen(false);
          }
        }}
        onConfirm={() => archiveMutation.mutate()}
      />

      {(statusMutation.isError ||
        archiveMutation.isError) && (
        <div className="toast toast--error" role="alert">
          {statusMutation.error instanceof Error
            ? statusMutation.error.message
            : archiveMutation.error instanceof Error
              ? archiveMutation.error.message
              : "Не удалось выполнить действие"}
        </div>
      )}
    </section>
  );
}
