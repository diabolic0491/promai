import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from
  "react-router-dom";

import {
  createUser,
  getUsers,
  updateUser,
} from "../api/users";
import {
  UserFormDialog,
  type UserFormSubmitValues,
} from "../components/users/UserFormDialog";
import { useAuth } from
  "../features/auth/useAuth";
import type {
  UserRole,
} from "../features/auth/auth.types";
import type {
  User,
} from "../types/user";
import {
  formatDateTime,
} from "../utils/formatters";
import "../styles/records.css";
import "../styles/contracts.css";
import "../styles/users.css";

const PAGE_SIZE = 20;

function readNonNegativeInteger(
  value: string | null,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : 0;
}

function readRole(
  value: string | null,
): UserRole | undefined {
  return value === "admin" || value === "manager"
    ? value
    : undefined;
}

function readActive(
  value: string | null,
): boolean | undefined {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

const roleLabels: Record<UserRole, string> = {
  admin: "Администратор",
  manager: "Менеджер",
};

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const search = searchParams.get("search") ?? "";
  const role = readRole(searchParams.get("role"));
  const isActive = readActive(
    searchParams.get("active"),
  );
  const offset = readNonNegativeInteger(
    searchParams.get("offset"),
  );
  const [searchInput, setSearchInput] =
    useState(search);
  const [isCreateOpen, setIsCreateOpen] =
    useState(false);
  const [editTarget, setEditTarget] =
    useState<User | null>(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const usersQuery = useQuery({
    queryKey: [
      "users",
      {
        search,
        role,
        isActive,
        limit: PAGE_SIZE,
        offset,
      },
    ],
    queryFn: () =>
      getUsers({
        search,
        role,
        isActive,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    const total = usersQuery.data?.total;

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
    usersQuery.data?.total,
  ]);

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

  async function saveUser(
    values: UserFormSubmitValues,
  ) {
    if (editTarget) {
      const payload = {
        full_name: values.fullName,
        role: values.role,
        is_active: values.isActive,
        ...(values.password
          ? { password: values.password }
          : {}),
      };
      const updated = await updateUser(
        editTarget.id,
        payload,
      );

      setEditTarget(null);
      setSuccessMessage(
        `Пользователь @${updated.username} обновлён`,
      );
    } else {
      const created = await createUser({
        username: values.username,
        full_name: values.fullName,
        password: values.password!,
        role: values.role,
        is_active: values.isActive,
      });

      setIsCreateOpen(false);
      setSuccessMessage(
        `Пользователь @${created.username} создан`,
      );
    }

    await queryClient.invalidateQueries({
      queryKey: ["users"],
    });
  }

  const page = usersQuery.data;
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
    search || role || isActive !== undefined,
  );

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Администрирование
          </span>
          <h1>Пользователи</h1>
          <p>
            Учётные записи сотрудников, роли и доступ
            к системе PromAI.
          </p>
        </div>

        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            setSuccessMessage(null);
            setIsCreateOpen(true);
          }}
        >
          <Plus size={18} aria-hidden="true" />
          Создать пользователя
        </button>
      </div>

      <div className="user-administration-notice">
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <strong>Раздел только для Admin</strong>
          <span>
            Пользователей нельзя удалить физически:
            ненужную учётную запись следует отключить.
          </span>
        </div>
      </div>

      {successMessage && (
        <div className="record-success" role="status">
          {successMessage}
        </div>
      )}

      <section
        className="records-panel"
        aria-labelledby="users-table-title"
      >
        <div className="records-toolbar contracts-toolbar">
          <div>
            <h2 id="users-table-title">
              Учётные записи
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
                placeholder="Логин или ФИО"
                aria-label="Поиск пользователей"
                maxLength={255}
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
          className="contracts-filters users-filters"
          aria-label="Фильтры пользователей"
        >
          <label>
            <span>Роль</span>
            <select
              value={role ?? ""}
              onChange={(event) =>
                updateFilters({
                  role:
                    event.target.value || null,
                  offset: null,
                })
              }
            >
              <option value="">Все роли</option>
              <option value="admin">
                Администратор
              </option>
              <option value="manager">Менеджер</option>
            </select>
          </label>

          <label>
            <span>Доступ</span>
            <select
              value={
                isActive === undefined
                  ? ""
                  : String(isActive)
              }
              onChange={(event) =>
                updateFilters({
                  active:
                    event.target.value || null,
                  offset: null,
                })
              }
            >
              <option value="">Все состояния</option>
              <option value="true">Активные</option>
              <option value="false">Отключённые</option>
            </select>
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

        {usersQuery.isLoading && (
          <div className="records-state" role="status">
            <span className="loading-spinner" />
            <strong>Загружаем пользователей</strong>
            <span>
              Получаем актуальные учётные записи…
            </span>
          </div>
        )}

        {usersQuery.isError && (
          <div className="records-state records-state--error">
            <UserCog size={28} aria-hidden="true" />
            <strong>
              Не удалось загрузить пользователей
            </strong>
            <span>
              {usersQuery.error instanceof Error
                ? usersQuery.error.message
                : "Повторите запрос"}
            </span>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                void usersQuery.refetch();
              }}
            >
              Повторить
            </button>
          </div>
        )}

        {page &&
          !usersQuery.isError &&
          page.items.length === 0 && (
            <div className="records-state">
              <Users size={28} aria-hidden="true" />
              <strong>
                {hasFilters
                  ? "Пользователи не найдены"
                  : "Кроме вас пользователей пока нет"}
              </strong>
              <span>
                {hasFilters
                  ? "Измените запрос или сбросьте фильтры."
                  : "Создайте учётную запись менеджера или администратора."}
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
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus size={18} aria-hidden="true" />
                  Создать пользователя
                </button>
              )}
            </div>
          )}

        {page && page.items.length > 0 && (
          <>
            <div className="records-table-wrap">
              <table className="records-table users-table">
                <thead>
                  <tr>
                    <th scope="col">Пользователь</th>
                    <th scope="col">ФИО</th>
                    <th scope="col">Роль</th>
                    <th scope="col">Доступ</th>
                    <th scope="col">Последний вход</th>
                    <th scope="col">Создан</th>
                    <th scope="col">
                      <span className="sr-only">
                        Действия
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <span className="records-table__primary users-table__username">
                          @{user.username}
                        </span>
                        {user.id === currentUser?.id && (
                          <span className="users-table__self">
                            Вы
                          </span>
                        )}
                      </td>
                      <td>{user.full_name || "—"}</td>
                      <td>
                        <span
                          className={`status-badge user-role--${user.role}`}
                        >
                          {roleLabels[user.role]}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            user.is_active
                              ? "status-badge status-badge--active"
                              : "status-badge status-badge--muted"
                          }
                        >
                          {user.is_active
                            ? "Активен"
                            : "Отключён"}
                        </span>
                      </td>
                      <td>
                        {formatDateTime(
                          user.last_login_at,
                        )}
                      </td>
                      <td>
                        {formatDateTime(user.created_at)}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => {
                              setSuccessMessage(null);
                              setEditTarget(user);
                            }}
                            aria-label={`Редактировать пользователя ${user.username}`}
                            title="Редактировать"
                          >
                            <Pencil
                              size={17}
                              aria-hidden="true"
                            />
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

        {usersQuery.isFetching &&
          !usersQuery.isLoading && (
            <span
              className="records-refreshing"
              role="status"
            >
              Обновляем…
            </span>
          )}
      </section>

      <UserFormDialog
        isOpen={isCreateOpen}
        currentUserId={currentUser!.id}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={saveUser}
      />

      <UserFormDialog
        isOpen={Boolean(editTarget)}
        user={editTarget}
        currentUserId={currentUser!.id}
        onClose={() => setEditTarget(null)}
        onSubmit={saveUser}
      />
    </section>
  );
}
