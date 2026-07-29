import { apiRequest } from "../../api/client";
import type {
  CurrentUser,
  LoginPayload,
  TokenPair,
} from "./auth.types";

export function login(
  payload: LoginPayload,
): Promise<TokenPair> {
  return apiRequest<TokenPair>("/auth/login", {
    method: "POST",
    json: payload,
    skipAuth: true,
    retryOnUnauthorized: false,
  });
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>("/auth/me");
}

export function logout(
  refreshToken: string,
): Promise<void> {
  return apiRequest<void>("/auth/logout", {
    method: "POST",
    json: {
      refresh_token: refreshToken,
    },
    responseType: "void",
    retryOnUnauthorized: false,
  });
}
