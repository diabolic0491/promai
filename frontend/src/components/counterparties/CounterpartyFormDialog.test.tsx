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
import { CounterpartyFormDialog } from
  "./CounterpartyFormDialog";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("CounterpartyFormDialog", () => {
  it("показывает конфликт 409 рядом с УНП", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new ApiError(
          "Контрагент с таким УНП уже существует",
          409,
        ),
      );

    render(
      <CounterpartyFormDialog
        mode="create"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /УНП/ }),
      "190000001",
    );
    await user.type(
      screen.getByRole("textbox", {
        name: /Полное наименование/,
      }),
      "ООО Тест",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Создать",
      }),
    );

    expect(
      await screen.findByText(
        "Контрагент с таким УНП уже существует",
      ),
    ).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("не позволяет изменить УНП в режиме edit", () => {
    render(
      <CounterpartyFormDialog
        mode="edit"
        counterparty={{
          id: 3,
          unp: "190000003",
          name: "ООО Три",
          short_name: null,
          legal_address: null,
          status: "active",
          created_at: "2026-07-29T08:00:00Z",
          updated_at: "2026-07-29T08:00:00Z",
        }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("textbox", { name: /УНП/ }),
    ).toHaveAttribute("readonly");
  });
});
