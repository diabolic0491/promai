import type {
  Contract,
} from "../types/contract";

export const DASHBOARD_UPCOMING_DAYS = 30;

export function getDaysUntil(
  value: string,
  now = new Date(),
): number | null {
  const target = new Date(`${value}T00:00:00`);

  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  return Math.ceil(
    (target.getTime() - today.getTime()) / 86_400_000,
  );
}

export interface DashboardAttentionItem {
  contract: Contract;
  reason: string;
  daysUntilEnd: number | null;
}

export function buildDashboardAttentionItems(
  pendingContracts: Contract[],
  activeContracts: Contract[],
  now = new Date(),
): DashboardAttentionItem[] {
  const pendingItems = pendingContracts.map(
    (contract) => ({
      contract,
      reason: "Ожидает согласования",
      daysUntilEnd: contract.end_date
        ? getDaysUntil(contract.end_date, now)
        : null,
    }),
  );
  const expiringItems = activeContracts
    .map((contract) => ({
      contract,
      reason: "Срок действия скоро завершится",
      daysUntilEnd: contract.end_date
        ? getDaysUntil(contract.end_date, now)
        : null,
    }))
    .filter(
      (
        item,
      ): item is DashboardAttentionItem & {
        daysUntilEnd: number;
      } =>
        item.daysUntilEnd !== null &&
        item.daysUntilEnd >= 0 &&
        item.daysUntilEnd <=
          DASHBOARD_UPCOMING_DAYS,
    )
    .sort(
      (left, right) =>
        left.daysUntilEnd - right.daysUntilEnd,
    );

  return [...pendingItems, ...expiringItems].slice(
    0,
    8,
  );
}
