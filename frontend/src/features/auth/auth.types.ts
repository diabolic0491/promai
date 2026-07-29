export type UserRole = "admin" | "manager";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  access_expires_in: number;
}

export interface CurrentUser {
  id: number;
  username: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}
