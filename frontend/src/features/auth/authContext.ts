import { createContext } from "react";

import type {
  CurrentUser,
  LoginPayload,
} from "./auth.types";

export type AuthStatus =
  | "restoring"
  | "authenticated"
  | "anonymous";

export interface AuthContextValue {
  user: CurrentUser | null;
  status: AuthStatus;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext =
  createContext<AuthContextValue | null>(null);
