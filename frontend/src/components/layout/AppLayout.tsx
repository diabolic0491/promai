import {
  useState,
  type ReactNode,
} from "react";

import type { AppPage } from "../../types/navigation";

import "./AppLayout.css";


interface AppLayoutProps {
  currentPage: AppPage;
  onPageChange: (page: AppPage) => void;
  children: ReactNode;
}


interface NavigationItem {
  id: AppPage;
  label: string;
  icon: string;
}


const navigationItems: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Главная",
    icon: "⌂",
  },
  {
    id: "organization",
    label: "Наша компания",
    icon: "▣",
  },
  {
    id: "counterparties",
    label: "Контрагенты",
    icon: "▦",
  },
  {
    id: "contracts",
    label: "Договоры",
    icon: "▤",
  },
];


const pageTitles: Record<AppPage, string> = {
  dashboard: "Главная",
  organization: "Наша компания",
  counterparties: "Контрагенты",
  contracts: "Договоры",
};


export function AppLayout({
  currentPage,
  onPageChange,
  children,
}: AppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] =
    useState(false);

  function toggleSidebar() {
    setIsSidebarCollapsed((current) => !current);
  }

  return (
    <div
      className={
        isSidebarCollapsed
          ? "appShell appShellCollapsed"
          : "appShell"
      }
    >
      <aside
        className={
          isSidebarCollapsed
            ? "sidebar sidebarCollapsed"
            : "sidebar"
        }
      >
        <div className="sidebarGlow" />

        <div className="brand">
          {!isSidebarCollapsed && (
            <>
              <img
                className="brandLogo"
                src="/branding/promai-logo.svg"
                alt="PromAI"
              />

              <span className="brandSubtitle">
                Корпоративная CRM-система
              </span>
            </>
          )}

          {isSidebarCollapsed && (
            <div
              className="collapsedBrand"
              title="PromAI"
              aria-label="PromAI"
            >
              AI
            </div>
          )}
        </div>

        <button
          type="button"
          className="sidebarToggle"
          onClick={toggleSidebar}
          aria-label={
            isSidebarCollapsed
              ? "Развернуть боковую панель"
              : "Свернуть боковую панель"
          }
          title={
            isSidebarCollapsed
              ? "Развернуть меню"
              : "Свернуть меню"
          }
        >
          {isSidebarCollapsed ? "›" : "‹"}
        </button>

        <nav
          className="nav"
          aria-label="Основная навигация"
        >
          {!isSidebarCollapsed && (
            <span className="navLabel">
              Навигация
            </span>
          )}

          {navigationItems.map((item) => {
            const isActive =
              currentPage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className={
                  isActive
                    ? "navItem navItemActive"
                    : "navItem"
                }
                onClick={() => onPageChange(item.id)}
                aria-current={
                  isActive ? "page" : undefined
                }
                title={
                  isSidebarCollapsed
                    ? item.label
                    : undefined
                }
              >
                <span
                  className="navIcon"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>

                {!isSidebarCollapsed && (
                  <span className="navItemText">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {!isSidebarCollapsed && (
          <div className="sidebarFooter">
            <span className="sidebarFooterLabel">
              Рабочая область
            </span>

            <strong>
              ООО «Промас Инжиниринг»
            </strong>

            <span className="sidebarStatus">
              <span
                className="sidebarStatusDot"
                aria-hidden="true"
              />

              Система активна
            </span>
          </div>
        )}
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbarPage">
            <button
              type="button"
              className="mobileSidebarToggle"
              onClick={toggleSidebar}
              aria-label="Открыть или закрыть меню"
            >
              ☰
            </button>

            <div>
              <span className="topbarLabel">
                PromAI
              </span>

              <strong className="topbarTitle">
                {pageTitles[currentPage]}
              </strong>
            </div>
          </div>

          <div className="topbarRight">
            <span className="pilotBadge">
              Пилотная версия
            </span>

            <div
              className="userAvatar"
              title="ООО «Промас Инжиниринг»"
              aria-label="ООО «Промас Инжиниринг»"
            >
              ПИ
            </div>
          </div>
        </header>

        <main className="mainContent">
          {children}
        </main>
      </div>
    </div>
  );
}