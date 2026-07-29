import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Eye,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  useSearchParams,
} from "react-router-dom";

import {
  archiveContract,
  getContracts,
  restoreContract,
} from "../api/contracts";
import {
  getCounterparties,
} from "../api/counterparties";
import {
  ConfirmDialog,
} from "../components/ui/ConfirmDialog";
import {
  contractStatusLabels,
  contractStatusOptions,
} from "../constants/contracts";
import type {
  Contract,
  ContractStatus,
} from "../types/contract";
import {
  formatAmount,
  formatDate,
  formatDateTime,
} from "../utils/formatters";
import "../styles/records.css";
import "../styles/contracts.css";

const PAGE_SIZE = 20;

function readNonNegativeInteger(
  value: string | null,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : 0;
}

function readPositiveInteger(
  value: string | null,
): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : undefined;
}

function isContractStatus(
  value: string | null,
): value is ContractStatus {
  return contractStatusOptions.some(
    (status) => status.value === value,
  );
}

export function ContractsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const search = searchParams.get("search") ?? "";
  const statusValue = searchParams.get("status");
  const status = isContractStatus(statusValue)
    ? statusValue
    : undefined;
  const counterpartyId = readPositiveInteger(
    searchParams.get("counterparty_id"),
  );
  const includeArchived =
    searchParams.get("archived") === "true";
  const offset = readNonNegativeInteger(
    searchParams.get("offset"),
  );

  const [searchInput, setSearchInput] =
    useState(search);
  const [archiveTarget, setArchiveTarget] =
    useState<Contract | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const contractsQuery = useQuery({
    queryKey: [
      "contracts",
      {
        search,
        status,
        counterpartyId,
        includeArchived,
        limit: PAGE_SIZE,
        offset,
      },
    ],
    queryFn: () =>
      getContracts({
        search,
        status,
        counterpartyId,
        includeArchived,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: (previous) => previous,
  });

  const counterpartiesQuery = useQuery({
    queryKey: [
      "counterparties",
      {
        includeArchived: true,
        limit: 100,
        offset: 0,
      },
    ],
    queryFn: () =>
      getCounterparties({
        includeArchived: true,
        limit: 100,
        offset: 0,
      }),
  });

  useEffect(() => {
    const total = contractsQuery.data?.total;

    if (
      total !== undefined &&
      offset > 0 &&
      offset >= total
    ) {
      const lastOffset = Math.max(
        0,
        Math.floor(
          Math.max(0, total - 1) / PAGE_SIZE,
        ) * PAGE_SIZE,
      );
      const next = new URLSearchParams(searchParams);

      if (lastOffset) {
        next.set("offset", String(lastOffset));
      } else {
        next.delete("offset");
      }

      setSearchParams(next, { replace: true });
    }
  }, [
    contractsQuery.data?.total,
    offset,
    searchParams,
    setSearchParams,
  ]);

  const archiveMutation = useMutation({
    mutationFn: (contract: Contract) =>
      contract.is_archived
        ? restoreContract(contract.id)
        : archiveContract(contract.id),
    onSuccess: async (updated) => {
      setArchiveTarget(null);
      queryClient.setQueryData(
        ["contract", updated.id],
        updated,
      );
      await queryClient.invalidateQueries({
        queryKey: ["contracts"],
      });
    },
  });

  function updateFilters(
    updates: Record<string, string | null>,
  ) {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    });

    setSearchParams(next);
  }

  function submitSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    updateFilters({
      search: searchInput.trim() || null,
      offset: null,
    });
  }

  const page = contractsQuery.data;
  const currentPage =
    Math.floor((page?.offset ?? offset) / PAGE_SIZE) +
    1;
  const pageCount = Math.max(
    1,
    Math.ceil((page?.total ?? 0) / PAGE_SIZE),
  );
  const hasPrevious = offset > 0;
  const hasNext = page
    ? page.offset + page.items.length < page.total
    : false;
  const hasFilters = Boolean(
    search ||
      status ||
      counterpartyId ||
      includeArchived,
  );

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Договорная работа
          </span>
          <h1>Договоры</h1>
          <p>
            Реестр договоров, их жизненный цикл,
            сроки и ответственные стороны.
          </p>
        </div>

        <Link
          to="/contracts/new"
          className="button button--primary"
        >
          <Plus size={18} aria-hidden="true" />
          Создать договор
        </Link>
      </div>

      <section
        className="records-panel"
        aria-labelledby="contracts-table-title"
      >
        <div className="records-toolbar contracts-toolbar">
          <div>
            <h2 id="contracts-table-title">
              Реестр
            </h2>
            <span>
              {page
                ? `Найдено: ${page.total}`
                : "Загружаем данные…"}
            </span>
          </div>

          <div className="records-toolbar__controls">
            <form
              className="records-search"
              role="search"
              onSubmit={submitSearch}
            >
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) =>
                  setSearchInput(event.target.value)
                }
                placeholder="Номер, название, УНП"
                aria-label="Поиск договоров"
                maxLength={500}
              />
              {searchInput && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    setSearchInput("");
                    updateFilters({
                      search: null,
                      offset: null,
                    });
                  }}
                  aria-label="Очистить поиск"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              )}
              <button
                type="submit"
                className="button button--secondary"
              >
                Найти
              </button>
            </form>
          </div>
        </div>

        <div
          className="contracts-filters"
          aria-label="Фильтры договоров"
        >
          <label>
            <span>Контрагент</span>
            <select
              value={counterpartyId ?? ""}
              onChange={(event) =>
                updateFilters({
                  counterparty_id:
                    event.target.value || null,
                  offset: null,
                })
              }
            >
              <option value="">Все контрагенты</option>
              {counterpartiesQuery.data?.items.map(
                (counterparty) => (
                  <option
                    key={counterparty.id}
                    value={counterparty.id}
                  >
                    {counterparty.short_name ||
                      counterparty.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>Статус</span>
            <select
              value={status ?? ""}
              onChange={(event) =>
                updateFilters({
                  status:
                    event.target.value || null,
                  offset: null,
                })
              }
            >
              <option value="">Все статусы</option>
              {contractStatusOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="records-toggle">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) =>
                updateFilters({
                  archived: event.target.checked
                    ? "true"
                    : null,
                  offset: null,
                })
              }
            />
            <span aria-hidden="true" />
            Показывать архивные
          </label>

          {hasFilters && (
            <button
              type="button"
              className="contracts-filter-reset"
              onClick={() => {
                setSearchInput("");
                setSearchParams({});
              }}
            >
              Сбросить фильтры
            </button>
          )}
        </div>

        {contractsQuery.isLoading && (
          <div className="records-state" role="status">
            <span className="loading-spinner" />
            <strong>Загружаем договоры</strong>
            <span>
              Получаем актуальные данные API…
            </span>
          </div>
        )}

        {contractsQuery.isError && (
          <div className="records-state records-state--error">
            <FileText size={28} aria-hidden="true" />
            <strong>
              Не удалось загрузить договоры
            </strong>
            <span>
              {contractsQuery.error instanceof Error
                ? contractsQuery.error.message
                : "Повторите запрос"}
            </span>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                void contractsQuery.refetch();
              }}
            >
              Повторить
            </button>
          </div>
        )}

        {page &&
          !contractsQuery.isError &&
          page.items.length === 0 && (
            <div className="records-state">
              <FileText size={28} aria-hidden="true" />
              <strong>
                {hasFilters
                  ? "По выбранным условиям ничего не найдено"
                  : "Договоров пока нет"}
              </strong>
              <span>
                {hasFilters
                  ? "Измените запрос или сбросьте фильтры."
                  : "Создайте первый договор с активным контрагентом."}
              </span>
              {hasFilters ? (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => {
                    setSearchInput("");
                    setSearchParams({});
                  }}
                >
                  Сбросить фильтры
                </button>
              ) : (
                <Link
                  to="/contracts/new"
                  className="button button--primary"
                >
                  <Plus size={18} aria-hidden="true" />
                  Создать договор
                </Link>
              )}
            </div>
          )}

        {page && page.items.length > 0 && (
          <>
            <div className="records-table-wrap">
              <table className="records-table contracts-table">
                <thead>
                  <tr>
                    <th scope="col">Договор</th>
                    <th scope="col">Контрагент</th>
                    <th scope="col">Дата</th>
                    <th scope="col">Сумма</th>
                    <th scope="col">Статус</th>
                    <th scope="col">Архив</th>
                    <th scope="col">Обновлён</th>
                    <th scope="col">
                      <span className="sr-only">
                        Действия
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((contract) => (
                    <tr key={contract.id}>
                      <td>
                        <Link
                          to={`/contracts/${contract.id}`}
                          className="records-table__primary"
                        >
                          № {contract.number}
                        </Link>
                        <span className="records-table__secondary">
                          {contract.title}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/counterparties/${contract.counterparty_id}`}
                          className="records-table__primary"
                        >
                          {contract.counterparty_name}
                        </Link>
                      </td>
                      <td>
                        {formatDate(contract.contract_date)}
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
                      <td>
                        <span
                          className={
                            contract.is_archived
                              ? "status-badge status-badge--muted"
                              : "contract-archive-empty"
                          }
                        >
                          {contract.is_archived
                            ? "В архиве"
                            : "—"}
                        </span>
                      </td>
                      <td>
                        {formatDateTime(
                          contract.updated_at,
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link
                            to={`/contracts/${contract.id}`}
                            className="icon-button"
                            aria-label={`Открыть договор ${contract.number}`}
                            title="Открыть"
                          >
                            <Eye
                              size={17}
                              aria-hidden="true"
                            />
                          </Link>
                          <Link
                            to={`/contracts/${contract.id}/edit`}
                            className="icon-button"
                            aria-disabled={
                              contract.is_archived
                            }
                            onClick={(event) => {
                              if (
                                contract.is_archived
                              ) {
                                event.preventDefault();
                              }
                            }}
                            title={
                              contract.is_archived
                                ? "Сначала восстановите договор"
                                : "Изменить"
                            }
                          >
                            <Pencil
                              size={17}
                              aria-hidden="true"
                            />
                          </Link>
                          <button
                            type="button"
                            className={
                              contract.is_archived
                                ? "icon-button"
                                : "icon-button icon-button--danger"
                            }
                            onClick={() =>
                              setArchiveTarget(contract)
                            }
                            aria-label={
                              contract.is_archived
                                ? `Восстановить договор ${contract.number}`
                                : `Архивировать договор ${contract.number}`
                            }
                            title={
                              contract.is_archived
                                ? "Восстановить"
                                : "Архивировать"
                            }
                          >
                            {contract.is_archived ? (
                              <RotateCcw
                                size={17}
                                aria-hidden="true"
                              />
                            ) : (
                              <Archive
                                size={17}
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="records-pagination">
              <span>
                Страница {currentPage} из {pageCount}
              </span>
              <div>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={!hasPrevious}
                  onClick={() =>
                    updateFilters({
                      offset: String(
                        Math.max(0, offset - PAGE_SIZE),
                      ),
                    })
                  }
                >
                  <ArrowLeft
                    size={16}
                    aria-hidden="true"
                  />
                  Назад
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={!hasNext}
                  onClick={() =>
                    updateFilters({
                      offset: String(offset + PAGE_SIZE),
                    })
                  }
                >
                  Далее
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </>
        )}

        {contractsQuery.isFetching &&
          !contractsQuery.isLoading && (
            <span
              className="records-refreshing"
              role="status"
            >
              Обновляем…
            </span>
          )}
      </section>

      <ConfirmDialog
        isOpen={Boolean(archiveTarget)}
        title={
          archiveTarget?.is_archived
            ? "Восстановить договор?"
            : "Архивировать договор?"
        }
        description={
          archiveTarget?.is_archived
            ? `Договор № ${archiveTarget.number} снова станет доступен для редактирования и смены статуса.`
            : `Договор № ${archiveTarget?.number ?? ""} станет доступен только для чтения. Его бизнес-статус не изменится.`
        }
        confirmLabel={
          archiveTarget?.is_archived
            ? "Восстановить"
            : "Архивировать"
        }
        tone={
          archiveTarget?.is_archived
            ? "primary"
            : "danger"
        }
        isPending={archiveMutation.isPending}
        onCancel={() => {
          if (!archiveMutation.isPending) {
            setArchiveTarget(null);
          }
        }}
        onConfirm={() => {
          if (archiveTarget) {
            archiveMutation.mutate(archiveTarget);
          }
        }}
      />

      {archiveMutation.isError && (
        <div className="toast toast--error" role="alert">
          {archiveMutation.error instanceof Error
            ? archiveMutation.error.message
            : "Не удалось изменить архивное состояние"}
        </div>
      )}
    </section>
  );
}
