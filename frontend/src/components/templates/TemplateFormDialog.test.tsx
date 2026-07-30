import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ApiError } from "../../api/client";
import {
  TemplateFormDialog,
} from "./TemplateFormDialog";

afterEach(() => {
  cleanup();
});

describe("TemplateFormDialog", () => {
  it("показывает серверную ошибку DOCX рядом с файлом", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(
        "DOCX содержит некорректные имена переменных",
        422,
        {
          detail: {
            message:
              "DOCX содержит некорректные имена переменных",
            invalid_variables: ["bad value"],
          },
        },
      ),
    );

    render(
      <TemplateFormDialog
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(
      screen.getByRole("textbox", {
        name: /Название/,
      }),
      "Тестовый шаблон",
    );
    await user.upload(
      screen.getByLabelText(/Файл DOCX/),
      new File(["docx"], "template.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Создать шаблон",
      }),
    );

    expect(
      await screen.findByText(
        "DOCX содержит некорректные имена переменных: bad value",
      ),
    ).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("не отправляет файл другого формата", async () => {
    const user = userEvent.setup({
      applyAccept: false,
    });
    const onSubmit = vi.fn();

    render(
      <TemplateFormDialog
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(
      screen.getByRole("textbox", {
        name: /Название/,
      }),
      "Тестовый шаблон",
    );
    await user.upload(
      screen.getByLabelText(/Файл DOCX/),
      new File(["pdf"], "template.pdf", {
        type: "application/pdf",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Создать шаблон",
      }),
    );

    expect(
      screen.getByText(
        "Выберите корректный DOCX-файл",
      ),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
