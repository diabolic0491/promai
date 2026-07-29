import type {
  CurrentUser,
  UserRole,
} from "../features/auth/auth.types";

export type User = CurrentUser;

export interface CreateUserPayload {
  username: string;
  full_name?: string | null;
  password: string;
  role: UserRole;
  is_active: boolean;
}

export interface UpdateUserPayload {
  full_name?: string | null;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
}
