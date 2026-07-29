import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Download,
  FileCheck2,
  FilePlus2,
  FileText,
  RefreshCw,
  Upload,
} from "lucide-react";
import {
  useRef,
  useState,
} from "react";

import {
  downloadLatestContractDocument,
  generateContractDocument,
  getContractDocumentVersions,
  uploadContractDocumentVersion,
} from "../../api/contractDocuments";
import {
  getTemplateVariableLabel,
} from "../../constants/contracts";
import type {
  Contract,
} from "../../types/contract";
import {
  getMissingTemplateVariables,
} from "../../utils/apiErrors";
import {
  validateContractDocumentFile,
} from "../../utils/contractDocumentValidation";
import { saveDownload } from "../../utils/download";
import {
  formatDateTime,
  formatFileSize,
} from "../../utils/formatters";

interface ContractDocumentTabProps {
  contract: Contract;
}

export function ContractDocumentTab({
  contract,
}: ContractDocumentTabProps) {
  const queryClient = useQueryClient();
  const fileInputRef =
    useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [fileError, setFileError] =
    useState<string | null>(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const versionsQuery = useQuery({
    queryKey: [
      "contract",
      contract.id,
      "versions",
    ],
    queryFn: () =>
      getContractDocumentVersions(contract.id),
  });

  async function refreshDocumentData() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [
          "contract",
          contract.id,
          "versions",
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: ["contract", contract.id],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "contract",
          contract.id,
          "events",
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: ["contracts"],
      }),
    ]);
  }

  const generateMutation = useMutation({
    mutationFn: () =>
      generateContractDocument(contract.id),
    onSuccess: async (download) => {
      saveDownload(
        download,
        contract.generated_file_name ??
          `Договор № ${contract.number}.docx`,
      );
      setSuccessMessage(
        "Новая версия сформирована и скачана",
      );
      await refreshDocumentData();
    },
  });

  const downloadMutation = useMutation({
    mutationFn: () =>
      downloadLatestContractDocument(contract.id),
    onSuccess: (download) => {
      saveDownload(
        download,
        latestVersion?.file_name ??
          contract.generated_file_name ??
          `Договор № ${contract.number}.docx`,
      );
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadContractDocumentVersion(
        contract.id,
        file,
      ),
    onSuccess: async (version) => {
      setSelectedFile(null);
      setFileError(null);
      setSuccessMessage(
        `Версия ${version.version_number} загружена`,
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await refreshDocumentData();
    },
  });

  const latestVersion =
    versionsQuery.data?.items[0];
  const missingVariables =
    getMissingTemplateVariables(
      generateMutation.error,
    );
  const mutationError =
    generateMutation.error ??
    downloadMutation.error ??
    uploadMutation.error;

  function selectFile(
    file: File | undefined,
  ) {
    setSuccessMessage(null);
    uploadMutation.reset();

    if (!file) {
      setSelectedFile(null);
      setFileError(null);
      return;
    }

    const validationError =
      validateContractDocumentFile(file);
    setFileError(validationError);
    setSelectedFile(
      validationError ? null : file,
    );
  }

  return (
    <div className="contract-document-layout">
      <section className="detail-card contract-document-card">
        <div className="detail-card__heading">
          <div>
            <span className="section-kicker">
              Рабочий DOCX
            </span>
            <h2>Документ договора</h2>
          </div>
          {latestVersion && (
            <span className="status-badge status-badge--active">
              Версия {latestVersion.version_number}
            </span>
          )}
        </div>

        <div className="contract-document-summary">
          <span className="contract-document-summary__icon">
            <FileText size={30} aria-hidden="true" />
          </span>
          <div>
            <small>Последняя версия</small>
            <strong>
              {latestVersion?.file_name ??
                "Документ ещё не создан"}
            </strong>
            <span>
              {latestVersion
                ? `${formatFileSize(
                    latestVersion.file_size_bytes,
                  )} · ${formatDateTime(
                    latestVersion.created_at,
                  )}`
                : "Сгенерируйте DOCX по шаблону или загрузите готовый файл"}
            </span>
          </div>
        </div>

        <dl className="contract-document-meta">
          <div>
            <dt>Шаблон</dt>
            <dd>
              {contract.template_name || "Не выбран"}
            </dd>
          </div>
          <div>
            <dt>Источник последней версии</dt>
            <dd>
              {latestVersion?.source === "generated"
                ? "Сгенерирована PromAI"
                : latestVersion?.source === "uploaded"
                  ? "Загружена пользователем"
                  : "—"}
            </dd>
          </div>
        </dl>

        <div className="contract-document-actions">
          <button
            type="button"
            className="button button--primary"
            disabled={
              contract.is_archived ||
              !contract.template_id ||
              generateMutation.isPending
            }
            title={
              contract.is_archived
                ? "Сначала восстановите договор"
                : !contract.template_id
                  ? "Сначала выберите шаблон в сведениях договора"
                  : undefined
            }
            onClick={() => {
              setSuccessMessage(null);
              generateMutation.mutate();
            }}
          >
            {generateMutation.isPending ? (
              <span
                className="button-spinner"
                aria-hidden="true"
              />
            ) : latestVersion ? (
              <RefreshCw
                size={17}
                aria-hidden="true"
              />
            ) : (
              <FilePlus2
                size={17}
                aria-hidden="true"
              />
            )}
            {generateMutation.isPending
              ? "Формируем…"
              : latestVersion
                ? "Сгенерировать новую версию"
                : "Сгенерировать DOCX"}
          </button>

          <button
            type="button"
            className="button button--secondary"
            disabled={
              !latestVersion ||
              downloadMutation.isPending
            }
            onClick={() =>
              downloadMutation.mutate()
            }
          >
            {downloadMutation.isPending ? (
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
            Скачать последнюю версию
          </button>
        </div>

        {!contract.template_id && (
          <div className="contract-document-note">
            Для генерации выберите активный шаблон и
            заполните его переменные в сведениях
            договора. Загрузка готового DOCX доступна
            без шаблона.
          </div>
        )}
      </section>

      <section className="detail-card contract-upload-card">
        <div className="detail-card__heading">
          <div>
            <span className="section-kicker">
              Новая неизменяемая версия
            </span>
            <h2>Загрузить свой DOCX</h2>
          </div>
          <Upload size={21} aria-hidden="true" />
        </div>

        <label
          className={
            fileError
              ? "contract-file-picker contract-file-picker--error"
              : "contract-file-picker"
          }
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={
              contract.is_archived ||
              uploadMutation.isPending
            }
            onChange={(event) =>
              selectFile(event.target.files?.[0])
            }
          />
          <span>
            <Upload size={22} aria-hidden="true" />
          </span>
          <div>
            <strong>
              {selectedFile?.name ??
                "Выберите документ"}
            </strong>
            <small>
              Только DOCX, размер не более 10 МБ
            </small>
          </div>
        </label>

        {selectedFile && (
          <div className="contract-selected-file">
            <FileCheck2
              size={18}
              aria-hidden="true"
            />
            <span>
              {selectedFile.name} ·{" "}
              {formatFileSize(selectedFile.size)}
            </span>
          </div>
        )}

        {fileError && (
          <div className="form-alert" role="alert">
            {fileError}
          </div>
        )}

        <button
          type="button"
          className="button button--secondary"
          disabled={
            !selectedFile ||
            Boolean(fileError) ||
            contract.is_archived ||
            uploadMutation.isPending
          }
          onClick={() => {
            if (selectedFile) {
              setSuccessMessage(null);
              uploadMutation.mutate(selectedFile);
            }
          }}
        >
          {uploadMutation.isPending && (
            <span
              className="button-spinner"
              aria-hidden="true"
            />
          )}
          {uploadMutation.isPending
            ? "Загружаем…"
            : "Добавить версию"}
        </button>
      </section>

      {versionsQuery.isError && (
        <div className="contract-inline-message contract-inline-message--error">
          <span>
            {versionsQuery.error instanceof Error
              ? versionsQuery.error.message
              : "Не удалось загрузить версии"}
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
      )}

      {mutationError && (
        <div
          className="contract-inline-message contract-inline-message--error"
          role="alert"
        >
          <strong>
            {mutationError instanceof Error
              ? mutationError.message
              : "Не удалось выполнить действие"}
          </strong>
          {missingVariables.length > 0 && (
            <ul>
              {missingVariables.map((variable) => (
                <li key={variable}>
                  {getTemplateVariableLabel(variable)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {successMessage && (
        <div
          className="contract-inline-message contract-inline-message--success"
          role="status"
        >
          <FileCheck2
            size={18}
            aria-hidden="true"
          />
          {successMessage}
        </div>
      )}
    </div>
  );
}
