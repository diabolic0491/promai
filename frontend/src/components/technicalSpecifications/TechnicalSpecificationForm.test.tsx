import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  RouterProvider,
} from "react-router-dom";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  TechnicalSpecificationForm,
} from "./TechnicalSpecificationForm";

const counterparty = {
  id: 7,
  unp: "190000007",
  name: "ООО «Контрагент»",
  short_name: "Контрагент",
  legal_address: "г. Минск",
  status: "active" as const,
  created_at: "2026-07-29T08:00:00Z",
  updated_at: "2026-07-29T08:00:00Z",
};

const template = {
  id: 11,
  name: "Техническое задание",
  template_type:
    "technical_specification" as const,
  description: null,
  file_name: "specification.docx",
  version: 2,
  required_variables: [
    "tz.title",
    "counterparty.name",
    "tz.delivery_address",
  ],
  is_active: true,
  archived_at: null,
  is_archived: false,
  created_at: "2026-07-29T08:00:00Z",
  updated_at: "2026-07-29T08:00:00Z",
};

function renderForm(
  onSubmit = vi.fn().mockResolvedValue(undefined),
) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <TechnicalSpecificationForm
            mode="create"
            initialCounterpartyId={counterparty.id}
            counterparties={[counterparty]}
            contracts={[]}
            templates={[template]}
            onCancel={vi.fn()}
            onSubmit={onSubmit}
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );

  render(<RouterProvider router={router} />);
  return onSubmit;
}

afterEach(() => {
  cleanup();
});

describe("TechnicalSpecificationForm", () => {
  it("передаёт обязательную переменную шаблона как вложенный form_data", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: /Шаблон DOCX/,
      }),
      String(template.id),
    );
    await user.type(
      screen.getByRole("textbox", {
        name: /Название ТЗ/,
      }),
      "Закупка серверов",
    );
    await user.type(
      screen.getByRole("textbox", {
        name: /Предмет закупки/,
      }),
      "Серверное оборудование",
    );
    await user.type(
      screen.getByRole("textbox", {
        name: /Правовое основание/,
      }),
      "Закон о государственных закупках",
    );
    await user.type(
      screen.getByRole("textbox", {
        name: /Внутренний документ-регламент/,
      }),
      "Положение о закупках",
    );
    await user.type(
      await screen.findByRole("textbox", {
        name: /Адрес поставки/,
      }),
      "г. Минск",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Создать ТЗ",
      }),
    );

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        counterpartyId: 7,
        templateId: 11,
        title: "Закупка серверов",
        procurementSubject:
          "Серверное оборудование",
        formData: {
          tz: {
            delivery_address: "г. Минск",
          },
        },
      }),
    );
  });

  it("не принимает окончание работ раньше начала", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: /Шаблон DOCX/,
      }),
      String(template.id),
    );
    await user.type(
      screen.getByRole("textbox", {
        name: /Название ТЗ/,
      }),
      "Некорректные сроки",
    );
    await user.type(
      screen.getByRole("textbox", {
        name: /Предмет закупки/,
      }),
      "Оборудование",
    );
    await user.type(
      screen.getByRole("textbox", {
        name: /Правовое основание/,
      }),
      "Основание",
    );
    await user.type(
      screen.getByRole("textbox", {
        name: /Внутренний документ-регламент/,
      }),
      "Регламент",
    );
    await user.type(
      screen.getByLabelText("Начало работ"),
      "2026-08-10",
    );
    await user.type(
      screen.getByLabelText("Окончание работ"),
      "2026-08-01",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Создать ТЗ",
      }),
    );

    expect(
      await screen.findByText(
        "Дата окончания не может быть раньше даты начала",
      ),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
