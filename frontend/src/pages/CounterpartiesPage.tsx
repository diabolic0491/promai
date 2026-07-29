import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Building2,
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
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  archiveCounterparty,
  createCounterparty,
  getCounterparties,
  restoreCounterparty,
  updateCounterparty,
} from "../api/counterparties";
import {
  CounterpartyFormDialog,
  type CounterpartyFormValues,
} from
  "../components/counterparties/CounterpartyFormDialog";
import { ConfirmDialog } from
  "../components/ui/ConfirmDialog";
import type {
  Counterparty,
} from "../types/counterparty";
import { formatDateTime } from
  "../utils/formatters";
import "../styles/records.css";

const PAGE_SIZE = 20;

function readOffset(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : 0;
}

export function CounterpartiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] =
    useSearchParams();

  const search = searchParams.get("search") ?? "";
  const includeArchived =
    searchParams.get("archived") === "true";
  const offset = readOffset(
    searchParams.get("offset"),
  );

  const [searchInput, setSearchInput] =
    useState(search);
  const [isCreateOpen, setIsCreateOpen] =
    useState(false);
  const [editingCounterparty, setEditingCounterparty] =
    useState<Counterparty | null>(null);
  const [statusTarget, setStatusTarget] =
    useState<Counterparty | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const counterpartiesQuery = useQuery({
    queryKey: [
      "counterparties",
      {
        search,
        includeArchived,
        limit: PAGE_SIZE,
        offset,
      },
    ],
    queryFn: () =>
      getCounterparties({
        search,
        includeArchived,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    const total = counterpartiesQuery.data?.total;

    if (
      total !== undefined &&
      offset > 0 &&
      offset >= total
    ) {
      const lastOffset = Math.max(
        0,
        Math.floor(Math.max(0, total - 1) / PAGE_SIZE) *
          PAGE_SIZE,
      );
      const next = new URLSearchParams(searchParams);

      if (lastOffset > 0) {
        next.set("offset", String(lastOffset));
      } else {
        next.delete("offset");
      }

      setSearchParams(next, { replace: true });
    }
  }, [
    counterpartiesQuery.data?.total,
    offset,
    searchParams,
    setSearchParams,
  ]);

  const statusMutation = useMutation({
    mutationFn: (counterparty: Counterparty) =>
      counterparty.status === "archived"
        ? restoreCounterparty(counterparty.id)
        : archiveCounterparty(counterparty.id),
    onSuccess: async () => {
      setStatusTarget(null);
      await queryClient.invalidateQueries({
        queryKey: ["counterparties"],
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

  async function create(
    values: CounterpartyFormValues,
  ) {
    const created = await createCounterparty({
      unp: values.unp.trim(),
      name: values.name.trim(),
      short_name: values.shortName.trim() || null,
      legal_address:
        values.legalAddress.trim() || null,
    });

    setIsCreateOpen(false);
    await queryClient.invalidateQueries({
      queryKey: ["counterparties"],
    });
    navigate(`/counterparties/${created.id}`);
  }

  async function update(
    values: CounterpartyFormValues,
  ) {
    if (!editingCounterparty) {
      return;
    }

    const updated = await updateCounterparty(
      editingCounterparty.id,
      {
        name: values.name.trim(),
        short_name: values.shortName.trim() || null,
        legal_address:
          values.legalAddress.trim() || null,
      },
    );

    setEditingCounterparty(null);
    queryClient.setQueryData(
      ["counterparty", updated.id],
      updated,
    );
    await queryClient.invalidateQueries({
      queryKey: ["counterparties"],
    });
  }

  const page = counterpartiesQuery.data;
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

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Справочник
          </span>
          <h1>Контрагенты</h1>
          <p>
            Предприятия и организации, связанные с
            договорами и техническими заданиями.
          </p>
        </div>

        <button
          type="button"
          className="button button--primary"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus size={18} aria-hidden="true" />
          Добавить контрагента
        </button>
      </div>

      <section
        className="records-panel"
        aria-labelledby="counterparties-table-title"
      >
        <div className="records-toolbar">
          <div>
            <h2 id="counterparties-table-title">
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
                placeholder="Название или УНП"
                aria-label="Поиск контрагентов"
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
          </div>
        </div>

        {counterpartiesQuery.isLoading && (
          <div
            className="records-state"
            role="status"
          >
            <span className="loading-spinner" />
            <strong>Загружаем контрагентов</strong>
            <span>Получаем актуальные данные API…</span>
          </div>
        )}

        {counterpartiesQuery.isError && (
          <div className="records-state records-state--error">
            <Building2 size={28} aria-hidden="true" />
            <strong>
              Не удалось загрузить контрагентов
            </strong>
            <span>
              {counterpartiesQuery.error instanceof Error
                ? counterpartiesQuery.error.message
                : "Повторите запрос"}
            </span>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                void counterpartiesQuery.refetch();
              }}
            >
              Повторить
            </button>
          </div>
        )}

        {page &&
          !counterpartiesQuery.isError &&
          page.items.length === 0 && (
            <div className="records-state">
              <Building2 size={28} aria-hidden="true" />
              <strong>
                {search
                  ? "По вашему запросу ничего не найдено"
                  : "Контрагентов пока нет"}
              </strong>
              <span>
                {search
                  ? "Измените запрос или сбросьте фильтры."
                  : "Добавьте первую организацию в справочник."}
              </span>
              {!search && (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus size={18} aria-hidden="true" />
                  Добавить
                </button>
              )}
            </div>
          )}

        {page && page.items.length > 0 && (
          <>
            <div className="records-table-wrap">
              <table className="records-table">
                <thead>
                  <tr>
                    <th scope="col">УНП</th>
                    <th scope="col">Наименование</th>
                    <th scope="col">Адрес</th>
                    <th scope="col">Состояние</th>
                    <th scope="col">Обновлён</th>
                    <th scope="col">
                      <span className="sr-only">
                        Действия
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((counterparty) => (
                    <tr key={counterparty.id}>
                      <td>
                        <span className="records-table__unp">
                          {counterparty.unp}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/counterparties/${counterparty.id}`}
                          className="records-table__primary"
                        >
                          {counterparty.short_name ||
                            counterparty.name}
                        </Link>
                        {counterparty.short_name && (
                          <span className="records-table__secondary">
                            {counterparty.name}
                          </span>
                        )}
                      </td>
                      <td>
                        {counterparty.legal_address ||
                          "—"}
                      </td>
                      <td>
                        <span
                          className={
                            counterparty.status ===
                            "archived"
                              ? "status-badge status-badge--muted"
                              : "status-badge status-badge--active"
                          }
                        >
                          {counterparty.status ===
                          "archived"
                            ? "В архиве"
                            : "Активен"}
                        </span>
                      </td>
                      <td>
                        {formatDateTime(
                          counterparty.updated_at,
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link
                            to={`/counterparties/${counterparty.id}`}
                            className="icon-button"
                            aria-label={`Открыть ${counterparty.name}`}
                            title="Открыть"
                          >
                            <Eye
                              size={17}
                              aria-hidden="true"
                            />
                          </Link>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() =>
                              setEditingCounterparty(
                                counterparty,
                              )
                            }
                            disabled={
                              counterparty.status ===
                              "archived"
                            }
                            aria-label={`Изменить ${counterparty.name}`}
                            title={
                              counterparty.status ===
                              "archived"
                                ? "Сначала восстановите контрагента"
                                : "Изменить"
                            }
                          >
                            <Pencil
                              size={17}
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            className={
                              counterparty.status ===
                              "archived"
                                ? "icon-button"
                                : "icon-button icon-button--danger"
                            }
                            onClick={() =>
                              setStatusTarget(
                                counterparty,
                              )
                            }
                            aria-label={
                              counterparty.status ===
                              "archived"
                                ? `Восстановить ${counterparty.name}`
                                : `Архивировать ${counterparty.name}`
                            }
                            title={
                              counterparty.status ===
                              "archived"
                                ? "Восстановить"
                                : "Архивировать"
                            }
                          >
                            {counterparty.status ===
                            "archived" ? (
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
                    size={17}
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
                    size={17}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </>
        )}

        {counterpartiesQuery.isFetching &&
          !counterpartiesQuery.isLoading && (
            <span
              className="records-refreshing"
              role="status"
            >
              Обновляем…
            </span>
          )}
      </section>

      {isCreateOpen && (
        <CounterpartyFormDialog
          mode="create"
          onClose={() => setIsCreateOpen(false)}
          onSubmit={create}
        />
      )}

      {editingCounterparty && (
        <CounterpartyFormDialog
          mode="edit"
          counterparty={editingCounterparty}
          onClose={() =>
            setEditingCounterparty(null)
          }
          onSubmit={update}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(statusTarget)}
        title={
          statusTarget?.status === "archived"
            ? "Восстановить контрагента?"
            : "Архивировать контрагента?"
        }
        description={
          statusTarget?.status === "archived"
            ? "Карточка снова станет доступна для редактирования и создания связанных документов."
            : "Контрагент исчезнет из списка активных. Его данные и связанные документы сохранятся."
        }
        confirmLabel={
          statusTarget?.status === "archived"
            ? "Восстановить"
            : "Архивировать"
        }
        tone={
          statusTarget?.status === "archived"
            ? "primary"
            : "danger"
        }
        isPending={statusMutation.isPending}
        onCancel={() => {
          if (!statusMutation.isPending) {
            setStatusTarget(null);
            statusMutation.reset();
          }
        }}
        onConfirm={() => {
          if (statusTarget) {
            statusMutation.mutate(statusTarget);
          }
        }}
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
