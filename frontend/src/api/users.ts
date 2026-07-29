import { apiRequest } from "./client";

import type { UserRole } from
  "../features/auth/auth.types";
import type { Page } from "../types/pagination";
import type {
  CreateUserPayload,
  UpdateUserPayload,
  User,
} from "../types/user";

export interface UsersQuery {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export function buildUsersQuery(
  query: UsersQuery,
): string {
  const parameters = new URLSearchParams();

  if (query.role) {
    parameters.set("role", query.role);
  }

  if (query.isActive !== undefined) {
    parameters.set(
      "is_active",
      String(query.isActive),
    );
  }

  if (query.search?.trim()) {
    parameters.set("search", query.search.trim());
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

export function getUsers(
  query: UsersQuery = {},
): Promise<Page<User>> {
  return apiRequest<Page<User>>(
    `/users${buildUsersQuery(query)}`,
  );
}

export function getUser(userId: number): Promise<User> {
  return apiRequest<User>(`/users/${userId}`);
}

export function createUser(
  payload: CreateUserPayload,
): Promise<User> {
  return apiRequest<User>("/users", {
    method: "POST",
    json: payload,
  });
}

export function updateUser(
  userId: number,
  payload: UpdateUserPayload,
): Promise<User> {
  return apiRequest<User>(`/users/${userId}`, {
    method: "PATCH",
    json: payload,
  });
}
