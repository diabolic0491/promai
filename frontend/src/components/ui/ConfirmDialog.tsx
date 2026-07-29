import { AlertTriangle, X } from "lucide-react";
import {
  useEffect,
  useRef,
} from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isPending?: boolean;
  tone?: "danger" | "primary";
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  isPending = false,
  tone = "danger",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelButtonRef =
    useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [isOpen, isPending, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isPending
        ) {
          onCancel();
        }
      }}
    >
      <section
        className="dialog-card dialog-card--compact"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <div className="dialog-card__heading">
          <span className="dialog-card__warning">
            <AlertTriangle
              size={22}
              aria-hidden="true"
            />
          </span>
          <div>
            <h2 id="confirm-dialog-title">{title}</h2>
            <p id="confirm-dialog-description">
              {description}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onCancel}
            disabled={isPending}
            aria-label="Закрыть диалог"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <div className="dialog-card__actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={isPending}
          >
            Отмена
          </button>
          <button
            type="button"
            className={
              tone === "danger"
                ? "button button--danger"
                : "button button--primary"
            }
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending && (
              <span
                className="button-spinner"
                aria-hidden="true"
              />
            )}
            {isPending ? "Выполняем…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
