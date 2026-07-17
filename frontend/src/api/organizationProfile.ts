import { apiRequest } from "./client";

import type { OrganizationProfile } from
  "../types/organizationProfile";

export async function getOrganizationProfile():
  Promise<OrganizationProfile> {
  return apiRequest<OrganizationProfile>(
    "/organization-profile",
  );
}