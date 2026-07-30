import userEvent from "@testing-library/user-event";
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderAsync } from "docx-preview";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  ApiDownload,
} from "../../api/client";
import { saveDownload } from
  "../../utils/download";
import {
  DocxPreviewModal,
  type DocxPreviewModalProps,
} from "./DocxPreviewModal";

vi.mock("docx-preview", () => ({
  renderAsync: vi.fn(),
}));

vi.mock("../../utils/download", () => ({
  saveDownload: vi.fn(),
}));

const renderAsyncMock = vi.mocked(renderAsync);
const saveDownloadMock = vi.mocked(saveDownload);

const defaultProps: DocxPreviewModalProps = {
  isOpen: true,
  title: "Предпросмотр договора",
  fallbackFileName: "contract.docx",
  download: null,
  isLoading: false,
  error: null,
  onClose: vi.fn(),
  onRetry: vi.fn(),
};

function createDownload(
  fileName: string,
): ApiDownload {
  return {
    blob: new Blob([fileName]),
    fileName,
  };
}

function renderModal(
  overrides: Partial<DocxPreviewModalProps> = {},
) {
  return render(
    <DocxPreviewModal
      {...defaultProps}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("DocxPreviewModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderAsyncMock.mockResolvedValue(undefined);
  });

  it("ничего не показывает в закрытом состоянии", () => {
    renderModal({ isOpen: false });

    expect(
      screen.queryByRole("dialog"),
    ).not.toBeInTheDocument();
    expect(renderAsyncMock).not.toHaveBeenCalled();
  });

  it("показывает загрузку до получения DOCX", () => {
    renderModal({ isLoading: true });

    expect(
      screen.getByRole("status"),
    ).toHaveTextContent("Загружаем документ…");
    expect(
      screen.getByRole("button", {
        name: "Скачать DOCX",
      }),
    ).toBeDisabled();
  });

  it("рендерит DOCX и заменяет его при смене файла", async () => {
    const firstDownload =
      createDownload("first.docx");
    const secondDownload =
      createDownload("second.docx");

    renderAsyncMock.mockImplementation(
      async (blob, container) => {
        container.textContent =
          blob === firstDownload.blob
            ? "Первый документ"
            : "Второй документ";
      },
    );

    const { rerender } = renderModal({
      download: firstDownload,
    });

    expect(
      await screen.findByText("Первый документ"),
    ).toBeInTheDocument();
    expect(renderAsyncMock).toHaveBeenCalledWith(
      firstDownload.blob,
      expect.any(HTMLElement),
      undefined,
      expect.objectContaining({
        breakPages: true,
        ignoreLastRenderedPageBreak: false,
        renderHeaders: true,
        renderFooters: true,
        useBase64URL: true,
      }),
    );

    rerender(
      <DocxPreviewModal
        {...defaultProps}
        download={secondDownload}
      />,
    );

    expect(
      await screen.findByText("Второй документ"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByText("Первый документ"),
      ).not.toBeInTheDocument();
    });
  });

  it("показывает ошибку загрузки и повторяет запрос", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    renderModal({
      error: new Error("Нет доступа к документу"),
      onRetry,
    });

    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent("Нет доступа к документу");

    await user.click(
      screen.getByRole("button", {
        name: "Повторить",
      }),
    );

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("показывает понятную ошибку рендера", async () => {
    renderAsyncMock.mockRejectedValue(
      new Error("Invalid DOCX"),
    );

    renderModal({
      download: createDownload("broken.docx"),
    });

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "Не удалось отобразить DOCX. Файл можно скачать и открыть в Word.",
    );
  });

  it("скачивает уже загруженный файл", async () => {
    const user = userEvent.setup();
    const download = createDownload("");

    renderModal({
      download,
      fallbackFileName: "fallback.docx",
    });

    await waitFor(() => {
      expect(renderAsyncMock).toHaveBeenCalled();
    });
    await user.click(
      screen.getByRole("button", {
        name: "Скачать DOCX",
      }),
    );

    expect(saveDownloadMock).toHaveBeenCalledWith(
      download,
      "fallback.docx",
    );
  });

  it("закрывается кнопкой и клавишей Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderModal({ onClose });

    await user.click(
      screen.getByRole("button", {
        name: "Закрыть предпросмотр",
      }),
    );
    expect(onClose).toHaveBeenCalledOnce();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
