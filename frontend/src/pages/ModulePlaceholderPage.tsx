import { Construction, LayoutDashboard } from
  "lucide-react";
import { Link } from "react-router-dom";

interface ModulePlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function ModulePlaceholderPage({
  eyebrow,
  title,
  description,
}: ModulePlaceholderPageProps) {
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            {eyebrow}
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>

      <div className="module-placeholder">
        <span className="module-placeholder__icon">
          <Construction size={28} aria-hidden="true" />
        </span>
        <span className="module-placeholder__step">
          Маршрут уже защищён и готов к подключению API
        </span>
        <h2>Модуль будет реализован по чек-листу</h2>
        <p>
          Фундамент приложения уже учитывает
          авторизацию, роли, общие состояния, файлы и
          единый контракт ошибок. Бизнес-функции
          подключаются отдельным проверяемым этапом.
        </p>
        <Link
          to="/dashboard"
          className="button button--secondary"
        >
          <LayoutDashboard
            size={18}
            aria-hidden="true"
          />
          На обзор
        </Link>
      </div>
    </section>
  );
}
