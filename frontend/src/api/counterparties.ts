import { apiRequest } from "./client";

import type {
  Counterparty,
} from "../types/counterparty";
import type { Page } from "../types/pagination";

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

export interface UpdateCounterpartyPayload {
  name?: string;
  short_name?: string | null;
  legal_address?: string | null;
}

function buildCounterpartiesQuery(
  query: CounterpartiesQuery,
): string {
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
  return queryString ? `?${queryString}` : "";
}

export function getCounterparties(
  query: CounterpartiesQuery = {},
): Promise<Page<Counterparty>> {
  return apiRequest<Page<Counterparty>>(
    `/counterparties${buildCounterpartiesQuery(query)}`,
  );
}

export function getCounterparty(
  counterpartyId: number,
): Promise<Counterparty> {
  return apiRequest<Counterparty>(
    `/counterparties/${counterpartyId}`,
  );
}

export function getCounterpartyByUnp(
  unp: string,
): Promise<Counterparty> {
  return apiRequest<Counterparty>(
    `/counterparties/by-unp/${encodeURIComponent(unp)}`,
  );
}

export function createCounterparty(
  payload: CreateCounterpartyPayload,
): Promise<Counterparty> {
  return apiRequest<Counterparty>("/counterparties", {
    method: "POST",
    json: payload,
  });
}

export function updateCounterparty(
  counterpartyId: number,
  payload: UpdateCounterpartyPayload,
): Promise<Counterparty> {
  return apiRequest<Counterparty>(
    `/counterparties/${counterpartyId}`,
    {
      method: "PATCH",
      json: payload,
    },
  );
}

export function archiveCounterparty(
  counterpartyId: number,
): Promise<Counterparty> {
  return apiRequest<Counterparty>(
    `/counterparties/${counterpartyId}/archive`,
    { method: "POST" },
  );
}

export function restoreCounterparty(
  counterpartyId: number,
): Promise<Counterparty> {
  return apiRequest<Counterparty>(
    `/counterparties/${counterpartyId}/restore`,
    { method: "POST" },
  );
}
