import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardList,
  Download,
  Eye,
  FileOutput,
  FileText,
  Info,
  Link2,
  Pencil,
  RotateCcw,
} from "lucide-react";
import {
  Link,
  useParams,
} from "react-router-dom";
import { useState } from "react";

import {
  archiveTechnicalSpecification,
  downloadTechnicalSpecification,
  generateTechnicalSpecification,
  getTechnicalSpecification,
  restoreTechnicalSpecification,
} from "../api/technicalSpecifications";
import {
  ConfirmDialog,
} from "../components/ui/ConfirmDialog";
import {
  DocxPreviewModal,
} from "../components/documents/DocxPreviewModal";
import {
  technicalSpecificationStatusLabels,
} from "../constants/technicalSpecifications";
import {
  flattenFormData,
} from "../utils/contractFormData";
import { saveDownload } from "../utils/download";
import {
  formatDate,
  formatDateTime,
} from "../utils/formatters";
import "../styles/records.css";
import "../styles/contracts.css";
import "../styles/technicalSpecifications.css";

function readPositiveInteger(
  value: string | undefined,
): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : undefined;
}

type FileAction = "generate" | "download";

export function TechnicalSpecificationPage() {
  const { id } = useParams();
  const technicalSpecificationId =
    readPositiveInteger(id);
  const queryClient = useQueryClient();
  const [confirmArchive, setConfirmArchive] =
    useState(false);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] =
    useState(false);

  const technicalSpecificationQuery = useQuery({
    queryKey: [
      "technical-specification",
      technicalSpecificationId,
    ],
    queryFn: () =>
      getTechnicalSpecification(
        technicalSpecificationId!,
      ),
    enabled: Boolean(technicalSpecificationId),
  });

  const archiveMutation = useMutation({
    mutationFn: () => {
      const technicalSpecification =
        technicalSpecificationQuery.data!;

      return technicalSpecification.is_archived
        ? restoreTechnicalSpecification(
            technicalSpecification.id,
          )
        : archiveTechnicalSpecification(
            technicalSpecification.id,
          );
    },
    onSuccess: async (updated) => {
      setConfirmArchive(false);
      setSuccessMessage(
        updated.is_archived
          ? "Техническое задание архивировано"
          : "Техническое задание восстановлено",
      );
      queryClient.setQueryData(
        ["technical-specification", updated.id],
        updated,
      );
      await queryClient.invalidateQueries({
        queryKey: ["technical-specifications"],
      });
    },
  });

  const fileMutation = useMutation({
    mutationFn: (action: FileAction) => {
      if (action === "generate") {
        return generateTechnicalSpecification(
          technicalSpecificationId!,
        );
      }

      return downloadTechnicalSpecification(
        technicalSpecificationId!,
      );
    },
    onSuccess: async (download, action) => {
      const fallbackFileName =
        technicalSpecificationQuery.data
          ?.generated_file_name ??
        `Техническое задание ${technicalSpecificationId}.docx`;
      saveDownload(download, fallbackFileName);
      setSuccessMessage(
        action === "generate"
          ? "DOCX сформирован и скачан"
          : "DOCX скачан",
      );

      if (action === "generate") {
        await Promise.all([
          technicalSpecificationQuery.refetch(),
          queryClient.invalidateQueries({
            queryKey: ["technical-specifications"],
          }),
        ]);
      }
    },
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      downloadTechnicalSpecification(
        technicalSpecificationId!,
      ),
  });

  if (!technicalSpecificationId) {
    return (
      <section className="page">
        <div className="records-state records-state--error records-state--card">
          <ClipboardList
            size={30}
            aria-hidden="true"
          />
          <strong>Некорректный идентификатор</strong>
          <span>
            Проверьте адрес страницы технического
            задания.
          </span>
          <Link
            to="/technical-specifications"
            className="button button--secondary"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            В реестр
          </Link>
        </div>
      </section>
    );
  }

  if (technicalSpecificationQuery.isLoading) {
    return (
      <section className="page">
        <div
          className="records-state records-state--card"
          role="status"
        >
          <span className="loading-spinner" />
          <strong>Загружаем карточку ТЗ</strong>
          <span>
            Получаем сведения, связи и состояние
            документа…
          </span>
        </div>
      </section>
    );
  }

  if (
    technicalSpecificationQuery.isError ||
    !technicalSpecificationQuery.data
  ) {
    return (
      <section className="page">
        <div className="records-state records-state--error records-state--card">
          <ClipboardList
            size={30}
            aria-hidden="true"
          />
          <strong>
            Не удалось открыть техническое задание
          </strong>
          <span>
            {technicalSpecificationQuery.error instanceof
            Error
              ? technicalSpecificationQuery.error
                  .message
              : "Техническое задание не найдено"}
          </span>
          <div className="records-state__actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                void technicalSpecificationQuery.refetch();
              }}
            >
              Повторить
            </button>
            <Link
              to="/technical-specifications"
              className="button button--secondary"
            >
              В реестр
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const technicalSpecification =
    technicalSpecificationQuery.data;
  const dynamicValues = flattenFormData(
    technicalSpecification.form_data,
  );
  const isGenerating =
    fileMutation.isPending &&
    fileMutation.variables === "generate";
  const isDownloading =
    fileMutation.isPending &&
    fileMutation.variables === "download";

  return (
    <section className="page">
      <div className="detail-breadcrumb">
        <Link to="/technical-specifications">
          <ArrowLeft size={16} aria-hidden="true" />
          Технические задания
        </Link>
      </div>

      <div className="detail-heading">
        <div className="detail-heading__identity">
          <span className="detail-heading__icon">
            <ClipboardList
              size={26}
              aria-hidden="true"
            />
          </span>
          <div>
            <span className="page-eyebrow">
              Техническое задание #
              {technicalSpecification.id}
            </span>
            <h1>{technicalSpecification.title}</h1>
            <p>
              Обновлено{" "}
              {formatDateTime(
                technicalSpecification.updated_at,
              )}
            </p>
          </div>
        </div>

        <div className="detail-heading__actions">
          {!technicalSpecification.is_archived && (
            <Link
              to={`/technical-specifications/${technicalSpecification.id}/edit`}
              className="button button--secondary"
            >
              <Pencil size={17} aria-hidden="true" />
              Редактировать
            </Link>
          )}
          <button
            type="button"
            className={
              technicalSpecification.is_archived
                ? "button button--secondary"
                : "button button--danger"
            }
            onClick={() => setConfirmArchive(true)}
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
            {technicalSpecification.is_archived
              ? "Восстановить"
              : "Архивировать"}
          </button>
        </div>
      </div>

      {technicalSpecification.is_archived && (
        <div className="record-notice" role="status">
          <Info size={19} aria-hidden="true" />
          <div>
            <strong>
              Техническое задание находится в архиве
            </strong>
            <span>
              Редактирование и новая генерация
              заблокированы. Готовый DOCX остаётся
              доступен для скачивания.
            </span>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="record-success" role="status">
          {successMessage}
        </div>
      )}

      <div className="technical-specification-layout">
        <div className="technical-specification-main">
          <section className="detail-card">
            <div className="detail-card__heading">
              <h2>Содержание закупки</h2>
            </div>
            <dl className="description-list">
              <div className="description-list__wide">
                <dt>Предмет закупки</dt>
                <dd>
                  {
                    technicalSpecification.procurement_subject
                  }
                </dd>
              </div>
              <div>
                <dt>Процедура</dt>
                <dd>
                  {
                    technicalSpecification.procurement_procedure
                  }
                </dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>
                  <span
                    className={`status-badge technical-specification-status--${technicalSpecification.status}`}
                  >
                    {
                      technicalSpecificationStatusLabels[
                        technicalSpecification.status
                      ]
                    }
                  </span>
                </dd>
              </div>
              <div className="description-list__wide">
                <dt>Правовое основание</dt>
                <dd>
                  {technicalSpecification.legal_basis}
                </dd>
              </div>
              <div className="description-list__wide">
                <dt>Внутренний регламент</dt>
                <dd>
                  {
                    technicalSpecification.internal_regulation_document
                  }
                </dd>
              </div>
            </dl>
          </section>

          <section className="detail-card">
            <div className="detail-card__heading">
              <h2>Сроки</h2>
            </div>
            <dl className="description-list">
              <div>
                <dt>Дата утверждения</dt>
                <dd>
                  {formatDate(
                    technicalSpecification.approval_date,
                  )}
                </dd>
              </div>
              <div>
                <dt>Начало работ</dt>
                <dd>
                  {formatDate(
                    technicalSpecification.work_start_date,
                  )}
                </dd>
              </div>
              <div>
                <dt>Окончание работ</dt>
                <dd>
                  {formatDate(
                    technicalSpecification.work_end_date,
                  )}
                </dd>
              </div>
              <div>
                <dt>Создано</dt>
                <dd>
                  {formatDateTime(
                    technicalSpecification.created_at,
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="detail-card">
            <div className="detail-card__heading">
              <h2>Данные шаблона</h2>
            </div>
            {dynamicValues.length > 0 ? (
              <dl className="description-list">
                {dynamicValues.map(([name, value]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="related-state">
                Дополнительные переменные не
                требовались.
              </div>
            )}
          </section>
        </div>

        <aside className="technical-specification-sidebar">
          <section className="detail-card">
            <div className="detail-card__heading">
              <h2>Связи</h2>
            </div>
            <div className="technical-specification-links">
              <Link
                to={`/counterparties/${technicalSpecification.counterparty_id}`}
                className="record-action"
              >
                <Building2
                  size={18}
                  aria-hidden="true"
                />
                <span>
                  <strong>Контрагент</strong>
                  <small>
                    {
                      technicalSpecification.counterparty_name
                    }
                  </small>
                </span>
                <Link2 size={16} aria-hidden="true" />
              </Link>

              {technicalSpecification.contract_id ? (
                <Link
                  to={`/contracts/${technicalSpecification.contract_id}`}
                  className="record-action"
                >
                  <FileText
                    size={18}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Договор</strong>
                    <small>
                      №{" "}
                      {
                        technicalSpecification.contract_number
                      }
                    </small>
                  </span>
                  <Link2 size={16} aria-hidden="true" />
                </Link>
              ) : (
                <div className="record-action record-action--disabled">
                  <FileText
                    size={18}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Договор</strong>
                    <small>Не связан</small>
                  </span>
                </div>
              )}

              <div className="record-action record-action--disabled">
                <FileOutput
                  size={18}
                  aria-hidden="true"
                />
                <span>
                  <strong>Шаблон</strong>
                  <small>
                    {technicalSpecification.template_name}
                  </small>
                </span>
              </div>
            </div>
          </section>

          <section className="detail-card">
            <div className="detail-card__heading">
              <h2>DOCX-документ</h2>
            </div>

            <div className="technical-specification-file">
              <span>
                <FileText
                  size={22}
                  aria-hidden="true"
                />
              </span>
              <div>
                <strong>
                  {technicalSpecification.generated_file_name ??
                    "Файл ещё не сформирован"}
                </strong>
                <small>
                  Хранится только последняя
                  сгенерированная версия.
                </small>
              </div>
            </div>

            <div className="technical-specification-file-actions">
              {!technicalSpecification.is_archived && (
                <button
                  type="button"
                  className="button button--primary"
                  disabled={fileMutation.isPending}
                  onClick={() =>
                    fileMutation.mutate("generate")
                  }
                >
                  {isGenerating ? (
                    <span
                      className="button-spinner"
                      aria-hidden="true"
                    />
                  ) : (
                    <FileOutput
                      size={17}
                      aria-hidden="true"
                    />
                  )}
                  {isGenerating
                    ? "Формируем…"
                    : technicalSpecification.generated_file_name
                      ? "Сформировать заново"
                      : "Сформировать DOCX"}
                </button>
              )}

              {technicalSpecification.generated_file_name && (
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={
                    fileMutation.isPending ||
                    previewMutation.isPending
                  }
                  onClick={() => {
                    setIsPreviewOpen(true);
                    previewMutation.reset();
                    previewMutation.mutate();
                  }}
                >
                  {previewMutation.isPending ? (
                    <span
                      className="button-spinner"
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye
                      size={17}
                      aria-hidden="true"
                    />
                  )}
                  {previewMutation.isPending
                    ? "Загружаем…"
                    : "Предпросмотр"}
                </button>
              )}

              {technicalSpecification.generated_file_name && (
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={
                    fileMutation.isPending ||
                    previewMutation.isPending
                  }
                  onClick={() =>
                    fileMutation.mutate("download")
                  }
                >
                  {isDownloading ? (
                    <span
                      className="button-spinner"
                      aria-hidden="true"
                    />
                  ) : (
                    <Download
                      size={17}
                      aria-hidden="true"
                    />
                  )}
                  {isDownloading
                    ? "Скачиваем…"
                    : "Скачать DOCX"}
                </button>
              )}
            </div>
          </section>

          <section className="detail-card technical-specification-status-card">
            <CalendarDays
              size={20}
              aria-hidden="true"
            />
            <div>
              <strong>Статус только для чтения</strong>
              <span>
                Backend пока не предоставляет
                переходы статуса ТЗ.
              </span>
            </div>
          </section>
        </aside>
      </div>

      <DocxPreviewModal
        isOpen={isPreviewOpen}
        title="Предпросмотр технического задания"
        fallbackFileName={
          technicalSpecification.generated_file_name ??
          `Техническое задание ${technicalSpecification.id}.docx`
        }
        download={previewMutation.data ?? null}
        isLoading={previewMutation.isPending}
        error={previewMutation.error}
        onClose={() => {
          setIsPreviewOpen(false);
          previewMutation.reset();
        }}
        onRetry={() => {
          previewMutation.mutate();
        }}
      />

      <ConfirmDialog
        isOpen={confirmArchive}
        title={
          technicalSpecification.is_archived
            ? "Восстановить техническое задание?"
            : "Архивировать техническое задание?"
        }
        description={
          technicalSpecification.is_archived
            ? "После восстановления снова будут доступны редактирование и генерация DOCX."
            : "ТЗ станет доступно только для чтения. Готовый DOCX останется доступен."
        }
        confirmLabel={
          technicalSpecification.is_archived
            ? "Восстановить"
            : "Архивировать"
        }
        tone={
          technicalSpecification.is_archived
            ? "primary"
            : "danger"
        }
        isPending={archiveMutation.isPending}
        onCancel={() => {
          if (!archiveMutation.isPending) {
            setConfirmArchive(false);
          }
        }}
        onConfirm={() => archiveMutation.mutate()}
      />

      {(archiveMutation.isError ||
        fileMutation.isError) && (
        <div className="toast toast--error" role="alert">
          {archiveMutation.error instanceof Error
            ? archiveMutation.error.message
            : fileMutation.error instanceof Error
              ? fileMutation.error.message
              : "Не удалось выполнить действие"}
        </div>
      )}
    </section>
  );
}
