import { apiRequest } from "./client";

import type { OrganizationProfile } from
  "../types/organizationProfile";

export interface UpdateOrganizationProfilePayload {
  name?: string;
  short_name?: string;
  unp?: string | null;
  legal_address?: string | null;
  email?: string | null;
  phone?: string | null;
  director_name?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_code?: string | null;
}

export async function getOrganizationProfile():
  Promise<OrganizationProfile> {
  return apiRequest<OrganizationProfile>(
    "/organization-profile",
  );
}

export async function updateOrganizationProfile(
  payload: UpdateOrganizationProfilePayload,
): Promise<OrganizationProfile> {
  return apiRequest<OrganizationProfile>(
    "/organization-profile",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}