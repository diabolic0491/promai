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
  ContractForm,
} from "./ContractForm";

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
  name: "Договор поставки",
  template_type: "contract" as const,
  description: null,
  file_name: "contract.docx",
  version: 2,
  required_variables: [
    "contract.number",
    "counterparty.name",
    "contract.subject",
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
          <ContractForm
            mode="create"
            initialCounterpartyId={counterparty.id}
            counterparties={[counterparty]}
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

describe("ContractForm", () => {
  it("автоматически подбирает парную роль контрагента", async () => {
    const user = userEvent.setup();
    renderForm();
    const selects = screen.getAllByRole("combobox");
    const ownerRole = selects[0];
    const counterpartyRole = selects[2];

    await user.selectOptions(ownerRole, "landlord");

    expect(counterpartyRole).toHaveValue("tenant");
  });

  it("передаёт обязательные переменные выбранного шаблона как вложенный form_data", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(
      screen.getByRole("textbox", {
        name: /Номер договора/,
      }),
      "Д-TEST-003",
    );
    await user.type(
      screen.getByRole("textbox", {
        name: /^Название/,
      }),
      "Тестовый договор",
    );
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: /Шаблон DOCX/,
      }),
      String(template.id),
    );
    await user.type(
      await screen.findByRole("textbox", {
        name: /Предмет договора/,
      }),
      "Поставка оборудования",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Создать договор",
      }),
    );

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        counterpartyId: 7,
        templateId: 11,
        number: "Д-TEST-003",
        title: "Тестовый договор",
        formData: {
          contract: {
            subject: "Поставка оборудования",
          },
        },
      }),
    );
  });

  it("не принимает период с окончанием раньше начала", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(
      screen.getByRole("textbox", {
        name: /Номер договора/,
      }),
      "Д-TEST-004",
    );
    await user.type(
      screen.getByRole("textbox", {
        name: /^Название/,
      }),
      "Некорректный период",
    );
    await user.type(
      screen.getByLabelText("Начало действия"),
      "2026-08-10",
    );
    await user.type(
      screen.getByLabelText("Окончание действия"),
      "2026-08-01",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Создать договор",
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
