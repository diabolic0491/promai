import {
  clearTokens,
  getTokens,
  setTokens,
} from "../features/auth/tokenStore";
import type {
  TokenPair,
} from "../features/auth/auth.types";

export const AUTH_EXPIRED_EVENT =
  "promai:auth-expired";

const API_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:8000"
).replace(/\/+$/, "");

type ResponseType =
  | "json"
  | "blob"
  | "download"
  | "text"
  | "void";

export interface ApiDownload {
  blob: Blob;
  fileName: string | null;
}

export interface ApiRequestOptions
  extends Omit<RequestInit, "body"> {
  body?: BodyInit | null;
  json?: unknown;
  responseType?: ResponseType;
  skipAuth?: boolean;
  retryOnUnauthorized?: boolean;
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(
    message: string,
    status: number,
    detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

let refreshRequest: Promise<boolean> | null = null;

function dispatchAuthExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(AUTH_EXPIRED_EVENT),
    );
  }
}

function buildHeaders(
  options: ApiRequestOptions,
): Headers {
  const headers = new Headers(options.headers);
  const { accessToken } = getTokens();

  if (!options.skipAuth && accessToken) {
    headers.set(
      "Authorization",
      `Bearer ${accessToken}`,
    );
  }

  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("Accept")) {
    headers.set(
      "Accept",
      options.responseType === "blob" ||
        options.responseType === "download"
        ? "application/octet-stream"
        : "application/json",
    );
  }

  return headers;
}

async function parseError(
  response: Response,
): Promise<ApiError> {
  let detail: unknown;

  try {
    detail = await response.json();
  } catch {
    try {
      detail = await response.text();
    } catch {
      detail = undefined;
    }
  }

  let message = `Ошибка API: ${response.status}`;

  if (
    detail &&
    typeof detail === "object" &&
    "detail" in detail
  ) {
    const serverDetail = (
      detail as { detail?: unknown }
    ).detail;

    if (typeof serverDetail === "string") {
      message = serverDetail;
    } else if (
      serverDetail &&
      typeof serverDetail === "object" &&
      "message" in serverDetail &&
      typeof (
        serverDetail as { message?: unknown }
      ).message === "string"
    ) {
      message = (
        serverDetail as { message: string }
      ).message;
    } else if (Array.isArray(serverDetail)) {
      message = "Проверьте заполнение полей формы";
    }
  } else if (typeof detail === "string" && detail) {
    message = detail;
  }

  return new ApiError(
    message,
    response.status,
    detail,
  );
}

async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken } = getTokens();

  if (!refreshToken) {
    return false;
  }

  if (!refreshRequest) {
    refreshRequest = (async () => {
      try {
        const response = await fetch(
          `${API_URL}/auth/refresh`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              refresh_token: refreshToken,
            }),
          },
        );

        if (!response.ok) {
          clearTokens();
          return false;
        }

        const tokenPair =
          (await response.json()) as TokenPair;

        setTokens(tokenPair);
        return true;
      } catch {
        clearTokens();
        return false;
      }
    })().finally(() => {
      refreshRequest = null;
    });
  }

  return refreshRequest;
}

async function parseSuccess<T>(
  response: Response,
  responseType: ResponseType,
): Promise<T> {
  if (
    response.status === 204 ||
    responseType === "void"
  ) {
    return undefined as T;
  }

  if (responseType === "blob") {
    return (await response.blob()) as T;
  }

  if (responseType === "download") {
    return {
      blob: await response.blob(),
      fileName: getDownloadFileName(response),
    } as T;
  }

  if (responseType === "text") {
    return (await response.text()) as T;
  }

  const contentType =
    response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return (await response.text()) as T;
  }

  return (await response.json()) as T;
}

function decodeFileName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getDownloadFileName(
  response: Response,
): string | null {
  const disposition = response.headers.get(
    "content-disposition",
  );

  if (!disposition) {
    return null;
  }

  const encodedMatch = disposition.match(
    /filename\*\s*=\s*UTF-8''([^;]+)/i,
  );

  if (encodedMatch?.[1]) {
    return decodeFileName(
      encodedMatch[1].trim().replace(/^"|"$/g, ""),
    );
  }

  const plainMatch = disposition.match(
    /filename\s*=\s*("([^"]+)"|([^;]+))/i,
  );

  return (
    plainMatch?.[2]?.trim() ??
    plainMatch?.[3]?.trim() ??
    null
  );
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    responseType = "json",
    retryOnUnauthorized = true,
    json,
    body,
    ...requestOptions
  } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    headers: buildHeaders(options),
    body:
      json === undefined
        ? body
        : JSON.stringify(json),
  });

  if (
    response.status === 401 &&
    retryOnUnauthorized &&
    !options.skipAuth
  ) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      return apiRequest<T>(path, {
        ...options,
        retryOnUnauthorized: false,
      });
    }

    clearTokens();
    dispatchAuthExpired();
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  return parseSuccess<T>(response, responseType);
}

export function getApiBaseUrl(): string {
  return API_URL;
}
