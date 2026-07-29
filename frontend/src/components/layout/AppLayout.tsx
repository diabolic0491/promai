import {
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileStack,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserCog,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
} from "react-router-dom";

import { useAuth } from
  "../../features/auth/useAuth";
import { BrandMark } from "../ui/BrandMark";
import "./AppLayout.css";

interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const navigationItems: NavigationItem[] = [
  {
    label: "Обзор",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Контрагенты",
    path: "/counterparties",
    icon: Building2,
  },
  {
    label: "Договоры",
    path: "/contracts",
    icon: FileText,
  },
  {
    label: "Технические задания",
    path: "/technical-specifications",
    icon: ClipboardList,
  },
  {
    label: "Шаблоны",
    path: "/templates",
    icon: FileStack,
  },
  {
    label: "Организация",
    path: "/organization",
    icon: Building2,
  },
];

function getPageTitle(pathname: string): string {
  if (pathname === "/dashboard") {
    return "Обзор";
  }

  if (pathname.startsWith("/counterparties")) {
    return pathname === "/counterparties"
      ? "Контрагенты"
      : "Карточка контрагента";
  }

  if (pathname.startsWith("/contracts")) {
    if (pathname === "/contracts/new") {
      return "Создание договора";
    }
    if (pathname.endsWith("/edit")) {
      return "Редактирование договора";
    }
    return pathname === "/contracts"
      ? "Договоры"
      : "Карточка договора";
  }

  if (
    pathname.startsWith("/technical-specifications")
  ) {
    if (
      pathname === "/technical-specifications/new"
    ) {
      return "Создание ТЗ";
    }
    if (pathname.endsWith("/edit")) {
      return "Редактирование ТЗ";
    }
    return pathname === "/technical-specifications"
      ? "Технические задания"
      : "Карточка ТЗ";
  }

  if (pathname === "/templates") {
    return "Шаблоны";
  }

  if (pathname === "/organization") {
    return "Организация";
  }

  if (pathname === "/administration/users") {
    return "Пользователи";
  }

  if (pathname === "/forbidden") {
    return "Нет доступа";
  }

  return "PromAI";
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const profileRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] =
    useState(false);
  const [isMobileOpen, setIsMobileOpen] =
    useState(false);
  const [isProfileOpen, setIsProfileOpen] =
    useState(false);
  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const pageTitle = getPageTitle(location.pathname);
  const displayName =
    user?.full_name || user?.username || "Пользователь";
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    setIsMobileOpen(false);
    setIsProfileOpen(false);
    document.title = `${pageTitle} — PromAI`;
  }, [location.pathname, pageTitle]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsProfileOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
    };
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div
      className={
        isCollapsed
          ? "app-shell app-shell--collapsed"
          : "app-shell"
      }
    >
      <button
        type="button"
        className={
          isMobileOpen
            ? "sidebar-scrim sidebar-scrim--visible"
            : "sidebar-scrim"
        }
        onClick={() => setIsMobileOpen(false)}
        aria-label="Закрыть меню"
      />

      <aside
        className={[
          "sidebar",
          isCollapsed ? "sidebar--collapsed" : "",
          isMobileOpen ? "sidebar--mobile-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="sidebar__brand">
          <BrandMark compact={isCollapsed} />

          <button
            type="button"
            className="sidebar__mobile-close"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Закрыть меню"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav
          className="sidebar__nav"
          aria-label="Основная навигация"
        >
          {navigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/dashboard"}
                className={({ isActive }) =>
                  isActive
                    ? "sidebar__link sidebar__link--active"
                    : "sidebar__link"
                }
                title={
                  isCollapsed ? item.label : undefined
                }
              >
                <span className="sidebar__icon">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="sidebar__label">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <span
            className="sidebar__status-dot"
            aria-hidden="true"
          />
          <span className="sidebar__footer-text">
            Система доступна
          </span>
        </div>

        <button
          type="button"
          className="sidebar__collapse"
          onClick={() =>
            setIsCollapsed((current) => !current)
          }
          aria-label={
            isCollapsed
              ? "Развернуть боковую панель"
              : "Свернуть боковую панель"
          }
        >
          {isCollapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <>
              <PanelLeftClose size={18} />
              <span>Свернуть</span>
            </>
          )}
        </button>
      </aside>

      <div className="app-workspace">
        <header className="topbar">
          <div className="topbar__page">
            <button
              type="button"
              className="topbar__mobile-menu"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Открыть меню"
            >
              <Menu size={22} aria-hidden="true" />
            </button>

            <div>
              <span className="topbar__eyebrow">
                Рабочая область
              </span>
              <strong className="topbar__title">
                {pageTitle}
              </strong>
            </div>
          </div>

          <div
            className="profile-menu"
            ref={profileRef}
          >
            <button
              type="button"
              className="profile-menu__trigger"
              onClick={() =>
                setIsProfileOpen(
                  (current) => !current,
                )
              }
              aria-expanded={isProfileOpen}
              aria-haspopup="menu"
            >
              <span className="profile-menu__avatar">
                {initials || "П"}
              </span>
              <span className="profile-menu__identity">
                <strong>{displayName}</strong>
                <span>
                  {user?.role === "admin"
                    ? "Администратор"
                    : "Менеджер"}
                </span>
              </span>
              <ChevronDown
                size={17}
                aria-hidden="true"
              />
            </button>

            {isProfileOpen && (
              <div
                className="profile-menu__dropdown"
                role="menu"
              >
                <div className="profile-menu__summary">
                  <strong>{displayName}</strong>
                  <span>@{user?.username}</span>
                </div>

                {user?.role === "admin" && (
                  <Link
                    to="/administration/users"
                    className="profile-menu__item"
                    role="menuitem"
                  >
                    <UserCog
                      size={18}
                      aria-hidden="true"
                    />
                    Управление пользователями
                    <ChevronRight
                      size={16}
                      aria-hidden="true"
                    />
                  </Link>
                )}

                <button
                  type="button"
                  className="profile-menu__item profile-menu__item--danger"
                  onClick={() => void handleLogout()}
                  disabled={isLoggingOut}
                  role="menuitem"
                >
                  <LogOut
                    size={18}
                    aria-hidden="true"
                  />
                  {isLoggingOut
                    ? "Выходим…"
                    : "Выйти"}
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
