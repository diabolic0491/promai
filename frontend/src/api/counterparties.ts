import { apiRequest } from "./client";
import type { Counterparty } from "../types/counterparty";

export interface CounterpartiesQuery {
  search?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreateCounterpartyPayload {
  unp: string;
  name: string;
  short_name?: string | null;
  legal_address?: string | null;
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

  if (query.limit !== undefined) {
    parameters.set("limit", String(query.limit));
  }

  if (query.offset !== undefined) {
    parameters.set("offset", String(query.offset));
  }

  const queryString = parameters.toString();

  return apiRequest<Counterparty[]>(
    `/counterparties${queryString ? `?${queryString}` : ""}`,
  );
}

export async function createCounterparty(
  payload: CreateCounterpartyPayload,
): Promise<Counterparty> {
  return apiRequest<Counterparty>("/counterparties", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}