import {
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import {
  Bot,
  Download,
  FileClock,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  downloadContractDocumentVersion,
  getContractDocumentVersions,
} from "../../api/contractDocuments";
import type {
  Contract,
} from "../../types/contract";
import type {
  ContractDocumentVersion,
} from "../../types/contractDocument";
import { saveDownload } from "../../utils/download";
import {
  formatDateTime,
  formatFileSize,
} from "../../utils/formatters";

function authorLabel(
  userId: number | null,
): string {
  return userId
    ? `Пользователь #${userId}`
    : "Система";
}

function sourceLabel(
  version: ContractDocumentVersion,
): string {
  return version.source === "generated"
    ? "Сгенерирована"
    : "Загружена";
}

interface ContractVersionsTabProps {
  contract: Contract;
}

export function ContractVersionsTab({
  contract,
}: ContractVersionsTabProps) {
  const versionsQuery = useQuery({
    queryKey: [
      "contract",
      contract.id,
      "versions",
    ],
    queryFn: () =>
      getContractDocumentVersions(contract.id),
  });

  const downloadMutation = useMutation({
    mutationFn: (
      version: ContractDocumentVersion,
    ) =>
      downloadContractDocumentVersion(
        contract.id,
        version.version_number,
      ).then((download) => ({
        download,
        version,
      })),
    onSuccess: ({ download, version }) => {
      saveDownload(download, version.file_name);
    },
  });

  if (versionsQuery.isLoading) {
    return (
      <section className="detail-card contract-tab-panel">
        <div
          className="contract-tab-loading"
          role="status"
        >
          <span className="loading-spinner" />
          Загружаем версии…
        </div>
      </section>
    );
  }

  if (versionsQuery.isError) {
    return (
      <section className="detail-card contract-tab-panel">
        <div className="contract-tab-error">
          <strong>Не удалось загрузить версии</strong>
          <span>
            {versionsQuery.error instanceof Error
              ? versionsQuery.error.message
              : "Повторите запрос"}
          </span>
          <button
            type="button"
            onClick={() => {
              void versionsQuery.refetch();
            }}
          >
            Повторить
          </button>
        </div>
      </section>
    );
  }

  const versions = versionsQuery.data?.items ?? [];

  if (versions.length === 0) {
    return (
      <section className="detail-card contract-tab-panel">
        <div className="contract-tab-empty">
          <FileClock size={30} aria-hidden="true" />
          <strong>Версий пока нет</strong>
          <span>
            Сгенерируйте документ по шаблону или
            загрузите готовый DOCX.
          </span>
          <Link
            to={`/contracts/${contract.id}?tab=document`}
            className="button button--primary"
          >
            <Upload size={17} aria-hidden="true" />
            Перейти к документу
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="records-panel contract-versions-panel">
      <div className="records-toolbar">
        <div>
          <h2>Версии документа</h2>
          <span>
            Неизменяемая история:{" "}
            {versionsQuery.data?.total ?? versions.length}
          </span>
        </div>
        <Link
          to={`/contracts/${contract.id}?tab=document`}
          className="button button--secondary"
        >
          <Upload size={17} aria-hidden="true" />
          Добавить версию
        </Link>
      </div>

      <div className="records-table-wrap">
        <table className="records-table contract-versions-table">
          <thead>
            <tr>
              <th>Версия</th>
              <th>Файл</th>
              <th>Источник</th>
              <th>Шаблон</th>
              <th>Размер</th>
              <th>Автор и дата</th>
              <th aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {versions.map((version) => (
              <tr key={version.id}>
                <td>
                  <strong className="contract-version-number">
                    v{version.version_number}
                  </strong>
                </td>
                <td>
                  <span className="records-table__primary">
                    {version.file_name}
                  </span>
                </td>
                <td>
                  <span
                    className={
                      version.source === "generated"
                        ? "status-badge status-badge--active"
                        : "status-badge contract-version-source--uploaded"
                    }
                  >
                    {sourceLabel(version)}
                  </span>
                </td>
                <td>
                  {version.template_name ? (
                    <>
                      <span className="records-table__primary">
                        {version.template_name}
                      </span>
                      <small className="records-table__secondary">
                        Версия шаблона{" "}
                        {version.template_version}
                      </small>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {formatFileSize(
                    version.file_size_bytes,
                  )}
                </td>
                <td>
                  <span className="records-table__primary">
                    {authorLabel(
                      version.created_by_user_id,
                    )}
                  </span>
                  <small className="records-table__secondary">
                    {formatDateTime(version.created_at)}
                  </small>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="icon-button"
                      title={`Скачать версию ${version.version_number}`}
                      aria-label={`Скачать версию ${version.version_number}`}
                      disabled={
                        downloadMutation.isPending &&
                        downloadMutation.variables?.id ===
                          version.id
                      }
                      onClick={() =>
                        downloadMutation.mutate(
                          version,
                        )
                      }
                    >
                      <Download
                        size={17}
                        aria-hidden="true"
                      />
                    </button>
                    <Link
                      to={`/contracts/${contract.id}?tab=analysis&version=${version.version_number}`}
                      className="icon-button"
                      title={`Анализировать версию ${version.version_number}`}
                      aria-label={`Анализировать версию ${version.version_number}`}
                    >
                      <Bot
                        size={17}
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {downloadMutation.isError && (
        <div
          className="contract-inline-message contract-inline-message--error"
          role="alert"
        >
          {downloadMutation.error instanceof Error
            ? downloadMutation.error.message
            : "Не удалось скачать версию"}
        </div>
      )}
    </section>
  );
}
