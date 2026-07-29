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

import type { User } from "../../types/user";
import { UserFormDialog } from "./UserFormDialog";

const currentAdmin: User = {
  id: 1,
  username: "admin",
  full_name: "Павел",
  role: "admin",
  is_active: true,
  last_login_at: "2026-07-29T08:00:00Z",
  created_at: "2026-07-28T08:00:00Z",
  updated_at: "2026-07-29T08:00:00Z",
};

afterEach(() => {
  cleanup();
});

describe("UserFormDialog", () => {
  it("нормализует username и передаёт данные нового пользователя", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockResolvedValue(undefined);

    render(
      <UserFormDialog
        isOpen
        currentUserId={currentAdmin.id}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(
      screen.getByRole("textbox", {
        name: /Имя пользователя/,
      }),
      "NewManager",
    );
    await user.type(
      screen.getByRole("textbox", {
        name: "ФИО",
      }),
      "Новый Менеджер",
    );
    await user.type(
      screen.getByLabelText(/Пароль/),
      "strong-pass-12",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Создать пользователя",
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      username: "newmanager",
      fullName: "Новый Менеджер",
      password: "strong-pass-12",
      role: "manager",
      isActive: true,
    });
  });

  it("не позволяет менять собственную роль и активность, но сохраняет ФИО", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockResolvedValue(undefined);

    render(
      <UserFormDialog
        isOpen
        user={currentAdmin}
        currentUserId={currentAdmin.id}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(
      screen.getByRole("combobox", {
        name: /Роль/,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Разрешить вход",
      }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        /Собственную учётную запись нельзя отключить/,
      ),
    ).toBeInTheDocument();

    const fullName = screen.getByRole("textbox", {
      name: "ФИО",
    });
    await user.clear(fullName);
    await user.type(fullName, "Павел Голышкин");
    await user.click(
      screen.getByRole("button", {
        name: "Сохранить",
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      username: "admin",
      fullName: "Павел Голышкин",
      password: null,
      role: "admin",
      isActive: true,
    });
  });
});
