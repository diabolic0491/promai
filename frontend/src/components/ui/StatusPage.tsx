import {
  ArrowLeft,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

import { BrandMark } from "./BrandMark";

interface StatusPageProps {
  code: string;
  title: string;
  description: string;
  icon: LucideIcon;
  authenticated?: boolean;
}

export function StatusPage({
  code,
  title,
  description,
  icon: Icon,
  authenticated = false,
}: StatusPageProps) {
  return (
    <div
      className={
        authenticated
          ? "status-page status-page--embedded"
          : "status-page"
      }
    >
      {!authenticated && <BrandMark />}

      <div className="status-page__card">
        <span className="status-page__icon">
          <Icon size={26} aria-hidden="true" />
        </span>
        <span className="status-page__code">
          Ошибка {code}
        </span>
        <h1>{title}</h1>
        <p>{description}</p>

        <Link
          to="/dashboard"
          className="button button--primary"
        >
          {authenticated ? (
            <ArrowLeft size={18} aria-hidden="true" />
          ) : (
            <LayoutDashboard
              size={18}
              aria-hidden="true"
            />
          )}
          Вернуться на обзор
        </Link>
      </div>
    </div>
  );
}
