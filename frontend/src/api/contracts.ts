import { apiRequest } from "./client";

import type {
  Contract,
  CreateContractPayload,
} from "../types/contract";

export interface ContractsQuery {
  counterpartyId?: number;
  limit?: number;
  offset?: number;
}

export async function getContracts(
  query: ContractsQuery = {},
): Promise<Contract[]> {
  const parameters = new URLSearchParams();

  if (query.counterpartyId !== undefined) {
    parameters.set(
      "counterparty_id",
      String(query.counterpartyId),
    );
  }

  if (query.limit !== undefined) {
    parameters.set("limit", String(query.limit));
  }

  if (query.offset !== undefined) {
    parameters.set("offset", String(query.offset));
  }

  const queryString = parameters.toString();

  return apiRequest<Contract[]>(
    `/contracts${queryString ? `?${queryString}` : ""}`,
  );
}

export async function createContract(
  payload: CreateContractPayload,
): Promise<Contract> {
  return apiRequest<Contract>("/contracts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}