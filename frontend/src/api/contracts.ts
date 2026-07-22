import { apiRequest } from "./client";

import type {
  Contract,
  CreateContractPayload,
  UpdateContractPayload,
} from "../types/contract";

export interface ContractsQuery {
  counterpartyId?: number;
  includeArchived?: boolean;
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

export async function updateContract(
  contractId: number,
  payload: UpdateContractPayload,
): Promise<Contract> {
  return apiRequest<Contract>(
    `/contracts/${contractId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function archiveContract(
  contractId: number,
): Promise<Contract> {
  return apiRequest<Contract>(
    `/contracts/${contractId}/archive`,
    {
      method: "POST",
    },
  );
}

export async function restoreContract(
  contractId: number,
): Promise<Contract> {
  return apiRequest<Contract>(
    `/contracts/${contractId}/restore`,
    {
      method: "POST",
    },
  );
}