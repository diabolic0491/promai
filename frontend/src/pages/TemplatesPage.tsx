import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Download,
  FileStack,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
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
  archiveDocumentTemplate,
  createDocumentTemplate,
  downloadDocumentTemplate,
  getDocumentTemplates,
  restoreDocumentTemplate,
  updateDocumentTemplate,
} from "../api/documentTemplates";
import {
  TemplateFormDialog,
  type TemplateFormSubmitValues,
} from "../components/templates/TemplateFormDialog";
import {
  ConfirmDialog,
} from "../components/ui/ConfirmDialog";
import { useAuth } from
  "../features/auth/useAuth";
import type {
  DocumentTemplate,
  DocumentTemplateType,
} from "../types/documentTemplate";
import { saveDownload } from
  "../utils/download";
import { formatDateTime } from
  "../utils/formatters";
import "../styles/records.css";
import "../styles/contracts.css";
import "../styles/templates.css";

const PAGE_SIZE = 20;

const templateTypeLabels: Record<
  DocumentTemplateType,
  string
> = {
  contract: "Договор",
  technical_specification: "Техническое задание",
};

interface LifecycleTarget {
  template: DocumentTemplate;
  action: "archive" | "restore";
}

function readNonNegativeInteger(
  value: string | null,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : 0;
}

function readTemplateType(
  value: string | null,
): DocumentTemplateType | undefined {
  return value === "contract" ||
    value === "technical_specification"
    ? value
    : undefined;
}

export function TemplatesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const search = searchParams.get("search") ?? "";
  const templateType = readTemplateType(
    searchParams.get("type"),
  );
  const includeArchived =
    isAdmin && searchParams.get("archived") === "true";
  const offset = readNonNegativeInteger(
    searchParams.get("offset"),
  );
  const [searchInput, setSearchInput] =
    useState(search);
  const [isCreateOpen, setIsCreateOpen] =
    useState(false);
  const [editTarget, setEditTarget] =
    useState<DocumentTemplate | null>(null);
  const [lifecycleTarget, setLifecycleTarget] =
    useState<LifecycleTarget | null>(null);
  const [isLifecyclePending, setIsLifecyclePending] =
    useState(false);
  const [downloadingId, setDownloadingId] =
    useState<number | null>(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);
  const [actionError, setActionError] =
    useState<string | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const templatesQuery = useQuery({
    queryKey: [
      "document-templates",
      {
        search,
        templateType,
        includeArchived,
        limit: PAGE_SIZE,
        offset,
      },
    ],
    queryFn: () =>
      getDocumentTemplates({
        search,
        templateType,
        includeArchived,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    const total = templatesQuery.data?.total;

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
    templatesQuery.data?.total,
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

  async function saveTemplate(
    values: TemplateFormSubmitValues,
  ) {
    setActionError(null);

    if (editTarget) {
      const updated = await updateDocumentTemplate(
        editTarget.id,
        {
          name: values.name,
          description: values.description,
          is_active: values.isActive,
        },
      );

      setEditTarget(null);
      setSuccessMessage(
        `Шаблон «${updated.name}» обновлён`,
      );
    } else {
      if (!values.file) {
        throw new Error(
          "Не выбран файл шаблона",
        );
      }

      const created = await createDocumentTemplate({
        name: values.name,
        template_type: values.templateType,
        description: values.description,
        required_variables:
          values.requiredVariables,
        file: values.file,
      });

      setIsCreateOpen(false);
      setSuccessMessage(
        `Шаблон «${created.name}» создан`,
      );
    }

    await queryClient.invalidateQueries({
      queryKey: ["document-templates"],
    });
  }

  async function downloadTemplate(
    template: DocumentTemplate,
  ) {
    setActionError(null);
    setDownloadingId(template.id);

    try {
      const download =
        await downloadDocumentTemplate(template.id);
      saveDownload(download, template.file_name);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Не удалось скачать шаблон",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  async function changeLifecycle() {
    if (!lifecycleTarget) {
      return;
    }

    setActionError(null);
    setIsLifecyclePending(true);

    try {
      const updated =
        lifecycleTarget.action === "archive"
          ? await archiveDocumentTemplate(
              lifecycleTarget.template.id,
            )
          : await restoreDocumentTemplate(
              lifecycleTarget.template.id,
            );

      setSuccessMessage(
        lifecycleTarget.action === "archive"
          ? `Шаблон «${updated.name}» перемещён в архив`
          : `Шаблон «${updated.name}» восстановлен`,
      );
      setLifecycleTarget(null);
      await queryClient.invalidateQueries({
        queryKey: ["document-templates"],
      });
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Не удалось изменить состояние шаблона",
      );
      setLifecycleTarget(null);
    } finally {
      setIsLifecyclePending(false);
    }
  }

  const page = templatesQuery.data;
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
    search || templateType || includeArchived,
  );

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Документы
          </span>
          <h1>Шаблоны</h1>
          <p>
            Корпоративные DOCX-шаблоны договоров и
            технических заданий.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              setSuccessMessage(null);
              setActionError(null);
              setIsCreateOpen(true);
            }}
          >
            <Plus size={18} aria-hidden="true" />
            Загрузить шаблон
          </button>
        )}
      </div>

      <div className="templates-role-notice">
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <strong>
            {isAdmin
              ? "Полный жизненный цикл"
              : "Рабочие шаблоны"}
          </strong>
          <span>
            {isAdmin
              ? "Администратор может создавать, редактировать, архивировать и восстанавливать шаблоны."
              : "Менеджеру доступны только активные шаблоны и скачивание исходных DOCX."}
          </span>
        </div>
      </div>

      {successMessage && (
        <div className="record-success" role="status">
          {successMessage}
        </div>
      )}

      {actionError && (
        <div className="form-alert" role="alert">
          {actionError}
        </div>
      )}

      <section
        className="records-panel"
        aria-labelledby="templates-table-title"
      >
        <div className="records-toolbar contracts-toolbar">
          <div>
            <h2 id="templates-table-title">
              Реестр шаблонов
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
                placeholder="Название или имя файла"
                aria-label="Поиск шаблонов"
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
          className="contracts-filters templates-filters"
          aria-label="Фильтры шаблонов"
        >
          <label>
            <span>Тип документа</span>
            <select
              value={templateType ?? ""}
              onChange={(event) =>
                updateFilters({
                  type:
                    event.target.value || null,
                  offset: null,
                })
              }
            >
              <option value="">Все типы</option>
              <option value="contract">
                Договоры
              </option>
              <option value="technical_specification">
                Технические задания
              </option>
            </select>
          </label>

          {isAdmin && (
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
              Показывать архив
            </label>
          )}

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

        {templatesQuery.isLoading && (
          <div className="records-state" role="status">
            <span className="loading-spinner" />
            <strong>Загружаем шаблоны</strong>
            <span>
              Получаем актуальные DOCX-шаблоны…
            </span>
          </div>
        )}

        {templatesQuery.isError && (
          <div className="records-state records-state--error">
            <FileStack size={28} aria-hidden="true" />
            <strong>
              Не удалось загрузить шаблоны
            </strong>
            <span>
              {templatesQuery.error instanceof Error
                ? templatesQuery.error.message
                : "Повторите запрос"}
            </span>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                void templatesQuery.refetch();
              }}
            >
              Повторить
            </button>
          </div>
        )}

        {page &&
          !templatesQuery.isError &&
          page.items.length === 0 && (
            <div className="records-state">
              <FileStack size={28} aria-hidden="true" />
              <strong>
                {hasFilters
                  ? "Шаблоны не найдены"
                  : "Шаблонов пока нет"}
              </strong>
              <span>
                {hasFilters
                  ? "Измените запрос или сбросьте фильтры."
                  : isAdmin
                    ? "Загрузите первый корпоративный DOCX-шаблон."
                    : "Администратор ещё не добавил активные шаблоны."}
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
                isAdmin && (
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    <Plus
                      size={18}
                      aria-hidden="true"
                    />
                    Загрузить шаблон
                  </button>
                )
              )}
            </div>
          )}

        {page && page.items.length > 0 && (
          <>
            <div className="records-table-wrap">
              <table className="records-table templates-table">
                <thead>
                  <tr>
                    <th scope="col">Шаблон</th>
                    <th scope="col">Тип</th>
                    <th scope="col">Файл</th>
                    <th scope="col">Переменные</th>
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
                  {page.items.map((template) => (
                    <tr key={template.id}>
                      <td>
                        <span className="records-table__primary">
                          {template.name}
                        </span>
                        <span className="records-table__secondary">
                          {template.description ||
                            "Без описания"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`template-type template-type--${template.template_type}`}
                        >
                          {
                            templateTypeLabels[
                              template.template_type
                            ]
                          }
                        </span>
                      </td>
                      <td>
                        <span className="templates-table__file">
                          {template.file_name}
                        </span>
                        <span className="records-table__secondary">
                          Версия {template.version}
                        </span>
                      </td>
                      <td>
                        {template.required_variables
                          .length > 0 ? (
                          <span
                            className="template-variable-count"
                            title={template.required_variables.join(
                              ", ",
                            )}
                          >
                            {
                              template.required_variables
                                .length
                            }{" "}
                            перем.
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span
                          className={
                            template.is_archived
                              ? "status-badge template-status--archived"
                              : template.is_active
                                ? "status-badge status-badge--active"
                                : "status-badge status-badge--muted"
                          }
                        >
                          {template.is_archived
                            ? "В архиве"
                            : template.is_active
                              ? "Активен"
                              : "Отключён"}
                        </span>
                      </td>
                      <td>
                        {formatDateTime(
                          template.updated_at,
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => {
                              void downloadTemplate(
                                template,
                              );
                            }}
                            disabled={
                              downloadingId === template.id
                            }
                            aria-label={`Скачать шаблон ${template.name}`}
                            title="Скачать DOCX"
                          >
                            <Download
                              size={17}
                              aria-hidden="true"
                            />
                          </button>

                          {isAdmin &&
                            !template.is_archived && (
                              <>
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={() => {
                                    setSuccessMessage(
                                      null,
                                    );
                                    setActionError(null);
                                    setEditTarget(
                                      template,
                                    );
                                  }}
                                  aria-label={`Редактировать шаблон ${template.name}`}
                                  title="Редактировать"
                                >
                                  <Pencil
                                    size={17}
                                    aria-hidden="true"
                                  />
                                </button>
                                <button
                                  type="button"
                                  className="icon-button icon-button--danger"
                                  onClick={() =>
                                    setLifecycleTarget({
                                      template,
                                      action: "archive",
                                    })
                                  }
                                  aria-label={`Архивировать шаблон ${template.name}`}
                                  title="Архивировать"
                                >
                                  <Archive
                                    size={17}
                                    aria-hidden="true"
                                  />
                                </button>
                              </>
                            )}

                          {isAdmin &&
                            template.is_archived && (
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() =>
                                  setLifecycleTarget({
                                    template,
                                    action: "restore",
                                  })
                                }
                                aria-label={`Восстановить шаблон ${template.name}`}
                                title="Восстановить"
                              >
                                <RotateCcw
                                  size={17}
                                  aria-hidden="true"
                                />
                              </button>
                            )}
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

        {templatesQuery.isFetching &&
          !templatesQuery.isLoading && (
            <span
              className="records-refreshing"
              role="status"
            >
              Обновляем…
            </span>
          )}
      </section>

      <TemplateFormDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={saveTemplate}
      />

      <TemplateFormDialog
        isOpen={editTarget !== null}
        template={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={saveTemplate}
      />

      <ConfirmDialog
        isOpen={lifecycleTarget !== null}
        title={
          lifecycleTarget?.action === "restore"
            ? "Восстановить шаблон?"
            : "Архивировать шаблон?"
        }
        description={
          lifecycleTarget?.action === "restore"
            ? "Шаблон снова станет активным и доступным для новых документов."
            : "Архивный шаблон нельзя будет выбирать для новых документов."
        }
        confirmLabel={
          lifecycleTarget?.action === "restore"
            ? "Восстановить"
            : "Архивировать"
        }
        tone={
          lifecycleTarget?.action === "restore"
            ? "primary"
            : "danger"
        }
        isPending={isLifecyclePending}
        onCancel={() => setLifecycleTarget(null)}
        onConfirm={() => {
          void changeLifecycle();
        }}
      />
    </section>
  );
}
