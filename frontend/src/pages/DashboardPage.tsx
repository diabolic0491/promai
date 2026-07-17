import { useEffect, useState } from "react";

import { getCounterparties } from "../api/counterparties";

export function DashboardPage() {
  const [counterpartiesCount, setCounterpartiesCount] =
    useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      setIsLoading(true);
      setError(false);

      try {
        const counterparties = await getCounterparties({
          includeArchived: false,
          limit: 100,
        });

        if (isMounted) {
          setCounterpartiesCount(counterparties.length);
        }
      } catch {
        if (isMounted) {
          setError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  function renderCounterpartiesCount() {
    if (isLoading) {
      return "…";
    }

    if (error || counterpartiesCount === null) {
      return "—";
    }

    return counterpartiesCount;
  }

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <p className="pageEyebrow">Рабочая область</p>
          <h1>Главная</h1>
          <p>
            Управление контрагентами, договорами и документами
            предприятия.
          </p>
        </div>

        <button type="button" className="primaryButton">
          + Создать договор
        </button>
      </div>

      <div className="statisticsGrid">
        <article className="statisticCard">
          <span>Активные контрагенты</span>

          <strong>{renderCounterpartiesCount()}</strong>

          <small>
            {error
              ? "Не удалось получить данные"
              : "Компании и организации в работе"}
          </small>
        </article>

        <article className="statisticCard">
          <span>Договоры</span>
          <strong>—</strong>
          <small>Активные договоры и черновики</small>
        </article>

        <article className="statisticCard">
          <span>На проверке</span>
          <strong>—</strong>
          <small>Будущий модуль ИИ-анализа</small>
        </article>
      </div>

      <div className="welcomePanel">
        <div>
          <span className="welcomeLabel">PromAI</span>

          <h2>Корпоративная CRM нового поколения</h2>

          <p>
            База контрагентов и договоров подключена.
            Показатели на главной странице постепенно
            переводятся на реальные данные.
          </p>
        </div>

        <div className="welcomeDecoration">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}