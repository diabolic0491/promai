import { renderAsync } from "docx-preview";
import {
  AlertCircle,
  Download,
  FileText,
  RefreshCw,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import type {
  ApiDownload,
} from "../../api/client";
import { saveDownload } from
  "../../utils/download";
import "../../styles/docx-preview.css";

type RenderStatus =
  | "idle"
  | "rendering"
  | "ready"
  | "error";

export interface DocxPreviewModalProps {
  isOpen: boolean;
  title: string;
  fallbackFileName: string;
  download: ApiDownload | null;
  isLoading: boolean;
  error: unknown;
  onClose: () => void;
  onRetry: () => void;
}

function getErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  return error instanceof Error
    ? error.message
    : "Не удалось загрузить документ";
}

export function DocxPreviewModal({
  isOpen,
  title,
  fallbackFileName,
  download,
  isLoading,
  error,
  onClose,
  onRetry,
}: DocxPreviewModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef =
    useRef<HTMLButtonElement>(null);
  const previewHostRef =
    useRef<HTMLDivElement>(null);
  const [renderStatus, setRenderStatus] =
    useState<RenderStatus>("idle");
  const [renderError, setRenderError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;
    const previousActiveElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
      previousActiveElement?.focus();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || download) {
      return;
    }

    previewHostRef.current?.replaceChildren();
    setRenderStatus("idle");
    setRenderError(null);
  }, [download, isLoading, isOpen]);

  useEffect(() => {
    if (!isOpen || !download) {
      return;
    }

    const previewHost = previewHostRef.current;

    if (!previewHost) {
      return;
    }

    let isCurrent = true;
    const renderRoot = document.createElement("div");
    renderRoot.className =
      "docx-preview-modal__document";
    previewHost.replaceChildren(renderRoot);
    setRenderStatus("rendering");
    setRenderError(null);

    void (async () => {
      try {
        await renderAsync(
          download.blob,
          renderRoot,
          undefined,
          {
            breakPages: true,
            ignoreLastRenderedPageBreak: false,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            renderEndnotes: true,
            useBase64URL: true,
          },
        );

        if (isCurrent) {
          setRenderStatus("ready");
        }
      } catch {
        if (isCurrent) {
          previewHost.replaceChildren();
          setRenderStatus("error");
          setRenderError(
            "Не удалось отобразить DOCX. Файл можно скачать и открыть в Word.",
          );
        }
      }
    })();

    return () => {
      isCurrent = false;

      if (previewHost.contains(renderRoot)) {
        previewHost.replaceChildren();
      }
    };
  }, [download, isOpen]);

  if (!isOpen) {
    return null;
  }

  const loadError = getErrorMessage(error);
  const activeError = loadError ?? renderError;
  const isBusy =
    !activeError &&
    (isLoading ||
      !download ||
      renderStatus !== "ready");
  const displayedFileName =
    download?.fileName || fallbackFileName;

  return (
    <div
      className="docx-preview-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="docx-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="docx-preview-modal__header">
          <span className="docx-preview-modal__icon">
            <FileText size={23} aria-hidden="true" />
          </span>
          <div className="docx-preview-modal__heading">
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>
              {displayedFileName}
            </p>
          </div>
          <div className="docx-preview-modal__actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={!download}
              onClick={() => {
                if (download) {
                  saveDownload(
                    download,
                    fallbackFileName,
                  );
                }
              }}
            >
              <Download size={17} aria-hidden="true" />
              Скачать DOCX
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              className="docx-preview-modal__close"
              onClick={onClose}
              aria-label="Закрыть предпросмотр"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div
          className="docx-preview-modal__body"
          aria-busy={isBusy}
        >
          <div
            ref={previewHostRef}
            className="docx-preview-modal__host"
          />

          {isBusy && (
            <div
              className="docx-preview-modal__state"
              role="status"
            >
              <span
                className="loading-spinner"
                aria-hidden="true"
              />
              <strong>Загружаем документ…</strong>
              <span>
                Подготавливаем страницы для просмотра.
              </span>
            </div>
          )}

          {activeError && (
            <div
              className="docx-preview-modal__state docx-preview-modal__state--error"
              role="alert"
            >
              <AlertCircle size={30} aria-hidden="true" />
              <strong>Предпросмотр недоступен</strong>
              <span>{activeError}</span>
              {loadError && (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={onRetry}
                >
                  <RefreshCw
                    size={17}
                    aria-hidden="true"
                  />
                  Повторить
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
