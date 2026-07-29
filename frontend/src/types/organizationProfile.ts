export interface OrganizationProfile {
  id: number;
  name: string;
  short_name: string;
  unp: string | null;
  legal_address: string | null;
  email: string | null;
  phone: string | null;
  director_name: string | null;
  director_position: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_code: string | null;
  created_at: string;
  updated_at: string;
}
