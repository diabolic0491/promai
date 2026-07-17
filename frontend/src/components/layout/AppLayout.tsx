import { useState, type ReactNode } from "react";
import "./AppLayout.css";

type Section = "dashboard" | "counterparties" | "contracts";

type AppLayoutProps = {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  children: ReactNode;
};

const navigationItems: Array<{
  id: Section;
  label: string;
  icon: string;
}> = [
  {
    id: "dashboard",
    label: "Главная",
    icon: "⌂",
  },
  {
    id: "counterparties",
    label: "Контрагенты",
    icon: "◫",
  },
  {
    id: "contracts",
    label: "Договоры",
    icon: "▤",
  },
];

export function AppLayout({
  activeSection,
  onSectionChange,
  children,
}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function selectSection(section: Section) {
    onSectionChange(section);
    setSidebarOpen(false);
  }

  return (
    <div className="appShell">
      <aside
        className={`sidebar ${sidebarOpen ? "sidebarOpen" : ""}`}
      >
        <div className="brand">
          <img
            className="brandLogo"
            src="/branding/promai-logo.svg"
            alt="PromAI"
          />

          <span className="brandSubtitle">
            Корпоративная CRM
          </span>
        </div>

        <nav
          className="navigation"
          aria-label="Основная навигация"
        >
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`navigationItem ${
                activeSection === item.id
                  ? "navigationItemActive"
                  : ""
              }`}
              onClick={() => selectSection(item.id)}
            >
              <span
                className="navigationIcon"
                aria-hidden="true"
              >
                {item.icon}
              </span>

              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebarFooter">
          <div className="systemStatus">
            <span className="systemStatusDot" />
            Система работает
          </div>

          <span className="version">PromAI MVP · 0.1.0</span>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="sidebarBackdrop"
          aria-label="Закрыть меню"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="mainArea">
        <header className="topbar">
          <button
            type="button"
            className="menuButton"
            aria-label="Открыть меню"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <div>
            <span className="topbarCaption">
              ООО «Промас Инжиниринг»
            </span>
          </div>

          <div className="userBadge">
            <span className="userAvatar">П</span>

            <div>
              <strong>Пользователь</strong>
              <span>Администратор</span>
            </div>
          </div>
        </header>

        <main className="pageContent">{children}</main>
      </div>
    </div>
  );
}