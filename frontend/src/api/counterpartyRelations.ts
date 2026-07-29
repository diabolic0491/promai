import { apiRequest } from "./client";

import type {
  RelatedContract,
  RelatedTechnicalSpecification,
} from "../types/counterpartyRelations";
import type { Page } from "../types/pagination";

export function getCounterpartyContracts(
  counterpartyId: number,
  limit = 5,
): Promise<Page<RelatedContract>> {
  const parameters = new URLSearchParams({
    counterparty_id: String(counterpartyId),
    limit: String(limit),
    offset: "0",
  });

  return apiRequest<Page<RelatedContract>>(
    `/contracts?${parameters.toString()}`,
  );
}

export function getCounterpartyTechnicalSpecifications(
  counterpartyId: number,
  limit = 5,
): Promise<Page<RelatedTechnicalSpecification>> {
  const parameters = new URLSearchParams({
    counterparty_id: String(counterpartyId),
    limit: String(limit),
    offset: "0",
  });

  return apiRequest<
    Page<RelatedTechnicalSpecification>
  >(
    `/technical-specifications?${parameters.toString()}`,
  );
}
