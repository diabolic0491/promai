import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { getContracts } from "../api/contracts";
import { getCounterparties } from
  "../api/counterparties";
import { getOrganizationProfile } from
  "../api/organizationProfile";

import { CreateContractModal } from
  "../components/contracts/CreateContractModal";
import { ContractDetailsDrawer } from
  "../components/contracts/ContractDetailsDrawer";

import { getContractRoleLabel } from
  "../constants/contractRoles";

import type { Contract } from "../types/contract";
import type { Counterparty } from
  "../types/counterparty";
import type { OrganizationProfile } from
  "../types/organizationProfile";


export function ContractsPage() {
  const [contracts, setContracts] =
    useState<Contract[]>([]);

  const [counterparties, setCounterparties] =
    useState<Counterparty[]>([]);

  const [organization, setOrganization] =
    useState<OrganizationProfile | null>(null);

  const [selectedContract, setSelectedContract] =
    useState<Contract | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [
        loadedContracts,
        loadedCounterparties,
        loadedOrganization,
      ] = await Promise.all([
        getContracts({
          limit: 100,
        }),

        getCounterparties({
          includeArchived: true,
          limit: 100,
        }),

        getOrganizationProfile(),
      ]);

      setContracts(loadedContracts);
      setCounterparties(loadedCounterparties);
      setOrganization(loadedOrganization);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить договоры",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function getCounterparty(
    counterpartyId: number,
  ): Counterparty | undefined {
    return counterparties.find(
      (counterparty) =>
        counterparty.id === counterpartyId,
    );
  }

  function formatContractAmount(
    contract: Contract,
  ): string {
    if (!contract.amount) {
      return "—";
    }

    return `${Number(
      contract.amount,
    ).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${contract.currency}`;
  }

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <p className="pageEyebrow">
            Договорная работа
          </p>

          <h1>Договоры</h1>

          <p>
            Договоры ООО «Промас Инжиниринг» с
            контрагентами предприятия.
          </p>
        </div>

        <button
          type="button"
          className="primaryButton"
          onClick={() =>
            setIsCreateModalOpen(true)
          }
        >
          + Новый договор
        </button>
      </div>

      <div className="tablePanel">
        {isLoading && (
          <div className="tableState">
            <span className="loader" />
            Загружаем договоры…
          </div>
        )}

        {!isLoading && error && (
          <div className="errorState">
            <div>
              <strong>
                Не удалось получить договоры
              </strong>

              <span>{error}</span>
            </div>

            <button
              type="button"
              className="secondaryButton"
              onClick={() => void loadData()}
            >
              Повторить
            </button>
          </div>
        )}

        {!isLoading &&
          !error &&
          contracts.length === 0 && (
            <div className="tableState">
              <strong>Договоров пока нет</strong>

              <span>
                Создайте первый договор с
                контрагентом.
              </span>
            </div>
          )}

        {!isLoading &&
          !error &&
          contracts.length > 0 && (
            <>
              <div className="tableSummary">
                Всего договоров:{" "}
                <strong>
                  {contracts.length}
                </strong>
              </div>

              <div className="tableContainer">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>Договор</th>
                      <th>Контрагент</th>
                      <th>Стороны</th>
                      <th>Дата</th>
                      <th>Сумма</th>
                      <th>Статус</th>
                    </tr>
                  </thead>

                  <tbody>
                    {contracts.map((contract) => {
                      const counterparty =
                        getCounterparty(
                          contract.counterparty_id,
                        );

                      return (
                        <tr
                          key={contract.id}
                          className="clickableTableRow"
                          tabIndex={0}
                          onClick={() =>
                            setSelectedContract(
                              contract,
                            )
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key === "Enter" ||
                              event.key === " "
                            ) {
                              event.preventDefault();

                              setSelectedContract(
                                contract,
                              );
                            }
                          }}
                        >
                          <td>
                            <div className="contractNameCell">
                              <strong>
                                № {contract.number}
                              </strong>

                              <span>
                                {contract.title}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="contractNameCell">
                              <strong>
                                {counterparty?.short_name ||
                                  counterparty?.name ||
                                  `Контрагент #${contract.counterparty_id}`}
                              </strong>

                              {counterparty && (
                                <span>
                                  УНП{" "}
                                  {counterparty.unp}
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="contractRolesCell">
                              <span>
                                Мы:{" "}
                                <strong>
                                  {getContractRoleLabel(
                                    contract.owner_role,
                                  )}
                                </strong>
                              </span>

                              <span>
                                Контрагент:{" "}
                                <strong>
                                  {getContractRoleLabel(
                                    contract.counterparty_role,
                                  )}
                                </strong>
                              </span>
                            </div>
                          </td>

                          <td>
                            {new Date(
                              contract.contract_date,
                            ).toLocaleDateString(
                              "ru-RU",
                            )}
                          </td>

                          <td>
                            {formatContractAmount(
                              contract,
                            )}
                          </td>

                          <td>
                            <span className="statusBadge statusBadgeDraft">
                              {contract.status ===
                              "draft"
                                ? "Черновик"
                                : contract.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
      </div>

      <CreateContractModal
        isOpen={isCreateModalOpen}
        onClose={() =>
          setIsCreateModalOpen(false)
        }
        onCreated={() => {
          void loadData();
        }}
      />

      <ContractDetailsDrawer
        contract={selectedContract}
        organization={organization}
        counterparty={
          selectedContract
            ? getCounterparty(
                selectedContract.counterparty_id,
              ) ?? null
            : null
        }
        onClose={() =>
          setSelectedContract(null)
        }
        onChanged={(changedContract) => {
          setSelectedContract(
            changedContract,
          );

          setContracts((current) =>
            current.map((item) =>
              item.id === changedContract.id
                ? changedContract
                : item,
            ),
          );
        }}
      />
    </section>
  );
}