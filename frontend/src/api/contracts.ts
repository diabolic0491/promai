import { apiRequest } from "./client";

import type {
  Contract,
  ContractEvent,
  ContractStatus,
  ContractStatusHistoryEntry,
  CreateContractPayload,
  UpdateContractPayload,
} from "../types/contract";
import type { Page } from "../types/pagination";

export interface ContractsQuery {
  counterpartyId?: number;
  status?: ContractStatus;
  search?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export function buildContractsQuery(
  query: ContractsQuery,
): string {
  const parameters = new URLSearchParams();

  if (query.counterpartyId !== undefined) {
    parameters.set(
      "counterparty_id",
      String(query.counterpartyId),
    );
  }

  if (query.status) {
    parameters.set("status", query.status);
  }

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

export function getContracts(
  query: ContractsQuery = {},
): Promise<Page<Contract>> {
  return apiRequest<Page<Contract>>(
    `/contracts${buildContractsQuery(query)}`,
  );
}

export function getContract(
  contractId: number,
): Promise<Contract> {
  return apiRequest<Contract>(
    `/contracts/${contractId}`,
  );
}

export function createContract(
  payload: CreateContractPayload,
): Promise<Contract> {
  return apiRequest<Contract>("/contracts", {
    method: "POST",
    json: payload,
  });
}

export function updateContract(
  contractId: number,
  payload: UpdateContractPayload,
): Promise<Contract> {
  return apiRequest<Contract>(
    `/contracts/${contractId}`,
    {
      method: "PATCH",
      json: payload,
    },
  );
}

export function updateContractStatus(
  contractId: number,
  status: ContractStatus,
): Promise<Contract> {
  return apiRequest<Contract>(
    `/contracts/${contractId}/status`,
    {
      method: "PATCH",
      json: { status },
    },
  );
}

export function archiveContract(
  contractId: number,
): Promise<Contract> {
  return apiRequest<Contract>(
    `/contracts/${contractId}/archive`,
    { method: "POST" },
  );
}

export function restoreContract(
  contractId: number,
): Promise<Contract> {
  return apiRequest<Contract>(
    `/contracts/${contractId}/restore`,
    { method: "POST" },
  );
}

export function getContractStatusHistory(
  contractId: number,
): Promise<ContractStatusHistoryEntry[]> {
  return apiRequest<ContractStatusHistoryEntry[]>(
    `/contracts/${contractId}/status-history`,
  );
}

export function getContractEvents(
  contractId: number,
): Promise<ContractEvent[]> {
  return apiRequest<ContractEvent[]>(
    `/contracts/${contractId}/events`,
  );
}
