import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import { getCounterparties } from "../api/counterparties";
import type { Counterparty } from "../types/counterparty";

export function CounterpartiesPage() {
  const [counterparties, setCounterparties] = useState<
    Counterparty[]
  >([]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] =
    useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCounterparties = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getCounterparties({
        search,
        includeArchived,
      });

      setCounterparties(result);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить контрагентов";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [search, includeArchived]);

  useEffect(() => {
    void loadCounterparties();
  }, [loadCounterparties]);

  function handleSearchSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function resetSearch() {
    setSearchInput("");
    setSearch("");
  }

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <p className="pageEyebrow">Справочник</p>
          <h1>Контрагенты</h1>
          <p>
            Компании и организации, с которыми работает
            предприятие.
          </p>
        </div>

        <button type="button" className="primaryButton">
          + Новый контрагент
        </button>
      </div>

      <div className="tablePanel">
        <div className="tableToolbar">
          <form
            className="searchForm"
            onSubmit={handleSearchSubmit}
          >
            <input
              type="search"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
              placeholder="Поиск по названию или УНП"
              aria-label="Поиск контрагентов"
            />

            <button
              type="submit"
              className="secondaryButton"
            >
              Найти
            </button>

            {search && (
              <button
                type="button"
                className="textButton"
                onClick={resetSearch}
              >
                Сбросить
              </button>
            )}
          </form>

          <label className="archiveFilter">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) =>
                setIncludeArchived(event.target.checked)
              }
            />

            <span>Показывать архивные</span>
          </label>
        </div>

        {isLoading && (
          <div className="tableState">
            <span className="loader" />
            Загружаем контрагентов…
          </div>
        )}

        {!isLoading && error && (
          <div className="errorState">
            <div>
              <strong>Не удалось получить данные</strong>
              <span>{error}</span>
            </div>

            <button
              type="button"
              className="secondaryButton"
              onClick={() => void loadCounterparties()}
            >
              Повторить
            </button>
          </div>
        )}

        {!isLoading &&
          !error &&
          counterparties.length === 0 && (
            <div className="tableState">
              <strong>Контрагенты не найдены</strong>
              <span>
                Добавьте первого контрагента или измените
                условия поиска.
              </span>
            </div>
          )}

        {!isLoading &&
          !error &&
          counterparties.length > 0 && (
            <>
              <div className="tableSummary">
                Найдено:{" "}
                <strong>{counterparties.length}</strong>
              </div>

              <div className="tableContainer">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>Контрагент</th>
                      <th>УНП</th>
                      <th>Юридический адрес</th>
                      <th>Статус</th>
                      <th aria-label="Действия" />
                    </tr>
                  </thead>

                  <tbody>
                    {counterparties.map((counterparty) => (
                      <tr key={counterparty.id}>
                        <td>
                          <div className="companyCell">
                            <span className="companyAvatar">
                              {counterparty.name
                                .charAt(0)
                                .toUpperCase()}
                            </span>

                            <div>
                              <strong>
                                {counterparty.short_name ||
                                  counterparty.name}
                              </strong>

                              {counterparty.short_name && (
                                <span>
                                  {counterparty.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="unpCell">
                          {counterparty.unp}
                        </td>

                        <td>
                          {counterparty.legal_address || "—"}
                        </td>

                        <td>
                          <span
                            className={`statusBadge ${
                              counterparty.status === "active"
                                ? "statusBadgeActive"
                                : "statusBadgeArchived"
                            }`}
                          >
                            {counterparty.status === "active"
                              ? "Активен"
                              : "В архиве"}
                          </span>
                        </td>

                        <td className="actionsCell">
                          <button
                            type="button"
                            className="rowAction"
                            aria-label={`Открыть ${counterparty.name}`}
                            title="Открыть карточку"
                          >
                            →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
      </div>
    </section>
  );
}