import { apiRequest } from "./client";
import type { Counterparty } from "../types/counterparty";

export interface CounterpartiesQuery {
  search?: string;
  includeArchived?: boolean;
}

export async function getCounterparties(
  query: CounterpartiesQuery = {},
): Promise<Counterparty[]> {
  const parameters = new URLSearchParams();

  if (query.search?.trim()) {
    parameters.set("search", query.search.trim());
  }

  if (query.includeArchived) {
    parameters.set("include_archived", "true");
  }

  const queryString = parameters.toString();

  return apiRequest<Counterparty[]>(
    `/counterparties${queryString ? `?${queryString}` : ""}`,
  );
}