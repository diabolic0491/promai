import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Eye,
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

import { getContracts } from "../api/contracts";
import {
  getCounterparties,
} from "../api/counterparties";
import {
  getDocumentTemplates,
} from "../api/documentTemplates";
import {
  archiveTechnicalSpecification,
  getTechnicalSpecifications,
  restoreTechnicalSpecification,
} from "../api/technicalSpecifications";
import {
  ConfirmDialog,
} from "../components/ui/ConfirmDialog";
import {
  technicalSpecificationStatusLabels,
  technicalSpecificationStatusOptions,
} from "../constants/technicalSpecifications";
import type {
  TechnicalSpecification,
  TechnicalSpecificationStatus,
} from "../types/technicalSpecification";
import {
  formatDate,
  formatDateTime,
} from "../utils/formatters";
import "../styles/records.css";
import "../styles/contracts.css";
import "../styles/technicalSpecifications.css";

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

function isTechnicalSpecificationStatus(
  value: string | null,
): value is TechnicalSpecificationStatus {
  return technicalSpecificationStatusOptions.some(
    (status) => status.value === value,
  );
}

export function TechnicalSpecificationsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const search = searchParams.get("search") ?? "";
  const counterpartyId = readPositiveInteger(
    searchParams.get("counterparty_id"),
  );
  const contractId = readPositiveInteger(
    searchParams.get("contract_id"),
  );
  const templateId = readPositiveInteger(
    searchParams.get("template_id"),
  );
  const statusValue = searchParams.get("status");
  const status = isTechnicalSpecificationStatus(
    statusValue,
  )
    ? statusValue
    : undefined;
  const includeArchived =
    searchParams.get("archived") === "true";
  const offset = readNonNegativeInteger(
    searchParams.get("offset"),
  );

  const [searchInput, setSearchInput] =
    useState(search);
  const [archiveTarget, setArchiveTarget] =
    useState<TechnicalSpecification | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const technicalSpecificationsQuery = useQuery({
    queryKey: [
      "technical-specifications",
      {
        search,
        counterpartyId,
        contractId,
        templateId,
        status,
        includeArchived,
        limit: PAGE_SIZE,
        offset,
      },
    ],
    queryFn: () =>
      getTechnicalSpecifications({
        search,
        counterpartyId,
        contractId,
        templateId,
        status,
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
        purpose: "technical-specifications-filter",
      },
    ],
    queryFn: () =>
      getCounterparties({
        includeArchived: true,
        limit: 100,
        offset: 0,
      }),
  });

  const contractsQuery = useQuery({
    queryKey: [
      "contracts",
      {
        includeArchived: true,
        limit: 100,
        offset: 0,
        purpose: "technical-specifications-filter",
      },
    ],
    queryFn: () =>
      getContracts({
        includeArchived: true,
        limit: 100,
        offset: 0,
      }),
  });

  const templatesQuery = useQuery({
    queryKey: [
      "document-templates",
      {
        templateType: "technical_specification",
        includeArchived: true,
        limit: 100,
        offset: 0,
        purpose: "technical-specifications-filter",
      },
    ],
    queryFn: () =>
      getDocumentTemplates({
        templateType: "technical_specification",
        includeArchived: true,
        limit: 100,
        offset: 0,
      }),
  });

  useEffect(() => {
    const total =
      technicalSpecificationsQuery.data?.total;

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
    offset,
    searchParams,
    setSearchParams,
    technicalSpecificationsQuery.data?.total,
  ]);

  const archiveMutation = useMutation({
    mutationFn: (
      technicalSpecification: TechnicalSpecification,
    ) =>
      technicalSpecification.is_archived
        ? restoreTechnicalSpecification(
            technicalSpecification.id,
          )
        : archiveTechnicalSpecification(
            technicalSpecification.id,
          ),
    onSuccess: async (updated) => {
      setArchiveTarget(null);
      queryClient.setQueryData(
        ["technical-specification", updated.id],
        updated,
      );
      await queryClient.invalidateQueries({
        queryKey: ["technical-specifications"],
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

  const page = technicalSpecificationsQuery.data;
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
      counterpartyId ||
      contractId ||
      templateId ||
      status ||
      includeArchived,
  );

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Документы
          </span>
          <h1>Технические задания</h1>
          <p>
            Реестр ТЗ, связи с закупками и договорами,
            сроки и готовые DOCX-документы.
          </p>
        </div>

        <Link
          to="/technical-specifications/new"
          className="button button--primary"
        >
          <Plus size={18} aria-hidden="true" />
          Создать ТЗ
        </Link>
      </div>

      <section
        className="records-panel"
        aria-labelledby="technical-specifications-table-title"
      >
        <div className="records-toolbar contracts-toolbar">
          <div>
            <h2 id="technical-specifications-table-title">
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
                placeholder="Название, предмет, УНП, договор"
                aria-label="Поиск технических заданий"
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
          className="contracts-filters technical-specifications-filters"
          aria-label="Фильтры технических заданий"
        >
          <label>
            <span>Контрагент</span>
            <select
              value={counterpartyId ?? ""}
              onChange={(event) =>
                updateFilters({
                  counterparty_id:
                    event.target.value || null,
                  contract_id: null,
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
            <span>Договор</span>
            <select
              value={contractId ?? ""}
              onChange={(event) =>
                updateFilters({
                  contract_id:
                    event.target.value || null,
                  offset: null,
                })
              }
            >
              <option value="">Все договоры</option>
              {contractsQuery.data?.items
                .filter(
                  (contract) =>
                    !counterpartyId ||
                    contract.counterparty_id ===
                      counterpartyId,
                )
                .map((contract) => (
                  <option
                    key={contract.id}
                    value={contract.id}
                  >
                    № {contract.number}
                  </option>
                ))}
            </select>
          </label>

          <label>
            <span>Шаблон</span>
            <select
              value={templateId ?? ""}
              onChange={(event) =>
                updateFilters({
                  template_id:
                    event.target.value || null,
                  offset: null,
                })
              }
            >
              <option value="">Все шаблоны</option>
              {templatesQuery.data?.items.map(
                (template) => (
                  <option
                    key={template.id}
                    value={template.id}
                  >
                    {template.name}
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
              {technicalSpecificationStatusOptions.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
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

        {technicalSpecificationsQuery.isLoading && (
          <div className="records-state" role="status">
            <span className="loading-spinner" />
            <strong>
              Загружаем технические задания
            </strong>
            <span>
              Получаем актуальные данные API…
            </span>
          </div>
        )}

        {technicalSpecificationsQuery.isError && (
          <div className="records-state records-state--error">
            <ClipboardList
              size={28}
              aria-hidden="true"
            />
            <strong>Не удалось загрузить ТЗ</strong>
            <span>
              {technicalSpecificationsQuery.error instanceof
              Error
                ? technicalSpecificationsQuery.error.message
                : "Повторите запрос"}
            </span>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                void technicalSpecificationsQuery.refetch();
              }}
            >
              Повторить
            </button>
          </div>
        )}

        {page &&
          !technicalSpecificationsQuery.isError &&
          page.items.length === 0 && (
            <div className="records-state">
              <ClipboardList
                size={28}
                aria-hidden="true"
              />
              <strong>
                {hasFilters
                  ? "По выбранным условиям ничего не найдено"
                  : "Технических заданий пока нет"}
              </strong>
              <span>
                {hasFilters
                  ? "Измените запрос или сбросьте фильтры."
                  : "Создайте первое ТЗ по активному DOCX-шаблону."}
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
                  to="/technical-specifications/new"
                  className="button button--primary"
                >
                  <Plus size={18} aria-hidden="true" />
                  Создать ТЗ
                </Link>
              )}
            </div>
          )}

        {page && page.items.length > 0 && (
          <>
            <div className="records-table-wrap">
              <table className="records-table technical-specifications-table">
                <thead>
                  <tr>
                    <th scope="col">Техническое задание</th>
                    <th scope="col">Контрагент</th>
                    <th scope="col">Договор</th>
                    <th scope="col">Шаблон</th>
                    <th scope="col">Статус</th>
                    <th scope="col">Сроки работ</th>
                    <th scope="col">Архив</th>
                    <th scope="col">Обновлено</th>
                    <th scope="col">
                      <span className="sr-only">
                        Действия
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map(
                    (technicalSpecification) => (
                      <tr
                        key={technicalSpecification.id}
                      >
                        <td>
                          <Link
                            to={`/technical-specifications/${technicalSpecification.id}`}
                            className="records-table__primary"
                          >
                            {technicalSpecification.title}
                          </Link>
                          <span className="records-table__secondary">
                            {
                              technicalSpecification.procurement_subject
                            }
                          </span>
                        </td>
                        <td>
                          <Link
                            to={`/counterparties/${technicalSpecification.counterparty_id}`}
                            className="records-table__primary"
                          >
                            {
                              technicalSpecification.counterparty_name
                            }
                          </Link>
                        </td>
                        <td>
                          {technicalSpecification.contract_id ? (
                            <Link
                              to={`/contracts/${technicalSpecification.contract_id}`}
                              className="records-table__primary"
                            >
                              №{" "}
                              {
                                technicalSpecification.contract_number
                              }
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {
                            technicalSpecification.template_name
                          }
                        </td>
                        <td>
                          <span
                            className={`status-badge technical-specification-status--${technicalSpecification.status}`}
                          >
                            {
                              technicalSpecificationStatusLabels[
                                technicalSpecification
                                  .status
                              ]
                            }
                          </span>
                        </td>
                        <td>
                          <span className="technical-specification-dates">
                            {formatDate(
                              technicalSpecification.work_start_date,
                            )}{" "}
                            —{" "}
                            {formatDate(
                              technicalSpecification.work_end_date,
                            )}
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              technicalSpecification.is_archived
                                ? "status-badge status-badge--muted"
                                : "contract-archive-empty"
                            }
                          >
                            {technicalSpecification.is_archived
                              ? "В архиве"
                              : "—"}
                          </span>
                        </td>
                        <td>
                          {formatDateTime(
                            technicalSpecification.updated_at,
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            <Link
                              to={`/technical-specifications/${technicalSpecification.id}`}
                              className="icon-button"
                              aria-label={`Открыть ТЗ ${technicalSpecification.title}`}
                              title="Открыть"
                            >
                              <Eye
                                size={17}
                                aria-hidden="true"
                              />
                            </Link>
                            <Link
                              to={`/technical-specifications/${technicalSpecification.id}/edit`}
                              className="icon-button"
                              aria-disabled={
                                technicalSpecification.is_archived
                              }
                              onClick={(event) => {
                                if (
                                  technicalSpecification.is_archived
                                ) {
                                  event.preventDefault();
                                }
                              }}
                              title={
                                technicalSpecification.is_archived
                                  ? "Сначала восстановите ТЗ"
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
                                technicalSpecification.is_archived
                                  ? "icon-button"
                                  : "icon-button icon-button--danger"
                              }
                              onClick={() =>
                                setArchiveTarget(
                                  technicalSpecification,
                                )
                              }
                              aria-label={
                                technicalSpecification.is_archived
                                  ? `Восстановить ТЗ ${technicalSpecification.title}`
                                  : `Архивировать ТЗ ${technicalSpecification.title}`
                              }
                              title={
                                technicalSpecification.is_archived
                                  ? "Восстановить"
                                  : "Архивировать"
                              }
                            >
                              {technicalSpecification.is_archived ? (
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
                    ),
                  )}
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

        {technicalSpecificationsQuery.isFetching &&
          !technicalSpecificationsQuery.isLoading && (
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
            ? "Восстановить техническое задание?"
            : "Архивировать техническое задание?"
        }
        description={
          archiveTarget?.is_archived
            ? "ТЗ снова станет доступно для редактирования и генерации DOCX."
            : "ТЗ станет доступно только для чтения. Ранее сгенерированный файл сохранится."
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
