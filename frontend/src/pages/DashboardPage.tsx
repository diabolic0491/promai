import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarClock,
  ClipboardList,
  FilePlus2,
  FileText,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";

import { getContracts } from "../api/contracts";
import {
  getCounterparties,
} from "../api/counterparties";
import {
  getTechnicalSpecifications,
} from "../api/technicalSpecifications";
import {
  contractStatusLabels,
} from "../constants/contracts";
import {
  buildDashboardAttentionItems,
} from "../utils/dashboard";
import {
  formatAmount,
  formatDate,
} from "../utils/formatters";

export function DashboardPage() {
  const counterpartiesQuery = useQuery({
    queryKey: [
      "dashboard",
      "counterparties-summary",
    ],
    queryFn: () =>
      getCounterparties({
        limit: 1,
        offset: 0,
      }),
  });

  const recentContractsQuery = useQuery({
    queryKey: ["dashboard", "recent-contracts"],
    queryFn: () =>
      getContracts({
        limit: 5,
        offset: 0,
      }),
  });

  const pendingContractsQuery = useQuery({
    queryKey: [
      "dashboard",
      "pending-contracts",
    ],
    queryFn: () =>
      getContracts({
        status: "pending_approval",
        limit: 100,
        offset: 0,
      }),
  });

  const activeContractsQuery = useQuery({
    queryKey: [
      "dashboard",
      "active-contracts",
    ],
    queryFn: () =>
      getContracts({
        status: "active",
        limit: 100,
        offset: 0,
      }),
  });

  const technicalSpecificationsQuery = useQuery({
    queryKey: [
      "dashboard",
      "technical-specifications-summary",
    ],
    queryFn: () =>
      getTechnicalSpecifications({
        limit: 1,
        offset: 0,
      }),
  });

  const summaryItems = [
    {
      label: "Активные контрагенты",
      icon: Building2,
      value: counterpartiesQuery.data?.total,
      isLoading: counterpartiesQuery.isLoading,
      isError: counterpartiesQuery.isError,
      link: "/counterparties",
    },
    {
      label: "Неархивные договоры",
      icon: FileText,
      value: recentContractsQuery.data?.total,
      isLoading: recentContractsQuery.isLoading,
      isError: recentContractsQuery.isError,
      link: "/contracts",
    },
    {
      label: "На согласовании",
      icon: CalendarClock,
      value: pendingContractsQuery.data?.total,
      isLoading: pendingContractsQuery.isLoading,
      isError: pendingContractsQuery.isError,
      link: "/contracts?status=pending_approval",
    },
    {
      label: "Технические задания",
      icon: ClipboardList,
      value: technicalSpecificationsQuery.data?.total,
      isLoading:
        technicalSpecificationsQuery.isLoading,
      isError: technicalSpecificationsQuery.isError,
      link: "/technical-specifications",
    },
  ];

  const attentionItems =
    buildDashboardAttentionItems(
    pendingContractsQuery.data?.items ?? [],
    activeContractsQuery.data?.items ?? [],
  );
  const attentionIsLoading =
    pendingContractsQuery.isLoading ||
    activeContractsQuery.isLoading;
  const attentionHasPartialError =
    pendingContractsQuery.isError ||
    activeContractsQuery.isError;

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Рабочий центр
          </span>
          <h1>Обзор</h1>
          <p>
            Общая сводка по договорной работе
            организации.
          </p>
        </div>

        <div
          className="quick-actions"
          aria-label="Быстрые действия"
        >
          <Link
            to="/contracts/new"
            className="button button--primary"
          >
            <FilePlus2 size={18} aria-hidden="true" />
            Создать договор
          </Link>
          <Link
            to="/technical-specifications/new"
            className="button button--secondary"
          >
            <ClipboardList
              size={18}
              aria-hidden="true"
            />
            Создать ТЗ
          </Link>
          <Link
            to="/counterparties?create=1"
            className="button button--secondary"
          >
            <Plus size={18} aria-hidden="true" />
            Добавить контрагента
          </Link>
        </div>
      </div>

      <section
        className="dashboard-section"
        aria-labelledby="summary-title"
      >
        <div className="section-heading">
          <div>
            <span className="section-kicker">
              Текущее состояние
            </span>
            <h2 id="summary-title">
              Общая сводка
            </h2>
          </div>
          <span className="dashboard-live-badge">
            Актуальные данные
          </span>
        </div>

        <div className="summary-grid">
          {summaryItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                className="summary-card"
                key={item.label}
                to={item.link}
                aria-label={`${item.label}: ${
                  item.isError
                    ? "данные недоступны"
                    : item.value ?? "загрузка"
                }`}
              >
                <span className="summary-card__icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span
                  className={
                    item.isError
                      ? "summary-card__value summary-card__value--error"
                      : "summary-card__value"
                  }
                >
                  {item.isError
                    ? "!"
                    : item.isLoading
                      ? "…"
                      : item.value ?? 0}
                </span>
                <span className="summary-card__label">
                  {item.label}
                  {item.isError && (
                    <small>Источник недоступен</small>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="dashboard-columns">
        <section
          className="panel"
          aria-labelledby="attention-title"
        >
          <div className="panel__heading">
            <div>
              <span className="section-kicker">
                Приоритет
              </span>
              <h2 id="attention-title">
                Требуют внимания
              </h2>
            </div>
            <AlertCircle
              size={21}
              aria-hidden="true"
            />
          </div>

          {attentionHasPartialError && (
            <div
              className="dashboard-partial-error"
              role="alert"
            >
              <AlertCircle
                size={17}
                aria-hidden="true"
              />
              <span>
                Часть данных недоступна. Показаны
                сведения из работающих источников.
              </span>
              <button
                type="button"
                onClick={() => {
                  if (pendingContractsQuery.isError) {
                    void pendingContractsQuery.refetch();
                  }
                  if (activeContractsQuery.isError) {
                    void activeContractsQuery.refetch();
                  }
                }}
              >
                <RefreshCw
                  size={15}
                  aria-hidden="true"
                />
                Повторить
              </button>
            </div>
          )}

          {attentionIsLoading &&
            attentionItems.length === 0 && (
              <div
                className="dashboard-loading"
                role="status"
              >
                <span className="loading-spinner" />
                Загружаем приоритеты…
              </div>
            )}

          {!attentionIsLoading &&
            attentionItems.length === 0 && (
              <div className="empty-state empty-state--compact">
                <span className="empty-state__icon">
                  <AlertCircle
                    size={22}
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <strong>
                    На сегодня срочных задач нет
                  </strong>
                  <p>
                    Здесь появятся договоры на
                    согласовании и действующие договоры
                    со сроком завершения в ближайшие 30
                    дней.
                  </p>
                </div>
              </div>
            )}

          {attentionItems.length > 0 && (
            <div className="attention-list">
              {attentionItems.map((item) => (
                <Link
                  key={item.contract.id}
                  to={`/contracts/${item.contract.id}`}
                  className="attention-item"
                >
                  <span
                    className={`status-badge contract-status--${item.contract.status}`}
                  >
                    {
                      contractStatusLabels[
                        item.contract.status
                      ]
                    }
                  </span>
                  <span className="attention-item__content">
                    <strong>
                      № {item.contract.number} —{" "}
                      {item.contract.title}
                    </strong>
                    <small>
                      {item.reason}
                      {item.daysUntilEnd !== null &&
                        item.contract.status ===
                          "active" &&
                        ` · осталось ${item.daysUntilEnd} дн.`}
                    </small>
                  </span>
                  <ArrowRight
                    size={17}
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section
          className="panel"
          aria-labelledby="recent-title"
        >
          <div className="panel__heading">
            <div>
              <span className="section-kicker">
                Последние изменения
              </span>
              <h2 id="recent-title">
                Последние договоры
              </h2>
            </div>
            <Link
              to="/contracts"
              className="text-link"
            >
              Все договоры
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          {recentContractsQuery.isLoading && (
            <div
              className="dashboard-loading"
              role="status"
            >
              <span className="loading-spinner" />
              Загружаем договоры…
            </div>
          )}

          {recentContractsQuery.isError && (
            <div className="dashboard-source-error">
              <AlertCircle
                size={22}
                aria-hidden="true"
              />
              <div>
                <strong>
                  Не удалось загрузить договоры
                </strong>
                <span>
                  {recentContractsQuery.error instanceof
                  Error
                    ? recentContractsQuery.error.message
                    : "Повторите запрос"}
                </span>
              </div>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  void recentContractsQuery.refetch();
                }}
              >
                Повторить
              </button>
            </div>
          )}

          {recentContractsQuery.data?.items.length ===
            0 && (
            <div className="empty-state empty-state--compact">
              <span className="empty-state__icon">
                <FileText size={22} aria-hidden="true" />
              </span>
              <div>
                <strong>Договоров пока нет</strong>
                <p>
                  После создания здесь появятся пять
                  последних договоров.
                </p>
              </div>
            </div>
          )}

          {recentContractsQuery.data &&
            recentContractsQuery.data.items.length >
              0 && (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th scope="col">Номер</th>
                      <th scope="col">Название</th>
                      <th scope="col">Контрагент</th>
                      <th scope="col">Дата</th>
                      <th scope="col">Сумма</th>
                      <th scope="col">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentContractsQuery.data.items.map(
                      (contract) => (
                        <tr key={contract.id}>
                          <td>
                            <Link
                              to={`/contracts/${contract.id}`}
                            >
                              № {contract.number}
                            </Link>
                          </td>
                          <td>{contract.title}</td>
                          <td>
                            {contract.counterparty_name}
                          </td>
                          <td>
                            {formatDate(
                              contract.contract_date,
                            )}
                          </td>
                          <td>
                            {formatAmount(
                              contract.amount,
                              contract.currency,
                            )}
                          </td>
                          <td>
                            <span
                              className={`status-badge contract-status--${contract.status}`}
                            >
                              {
                                contractStatusLabels[
                                  contract.status
                                ]
                              }
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      </div>
    </section>
  );
}
