import type { TokenPair } from "./auth.types";

const ACCESS_TOKEN_KEY = "promai.accessToken";
const REFRESH_TOKEN_KEY = "promai.refreshToken";

interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

function getStorage(): Storage | null {
  if (
    typeof window === "undefined" ||
    !window.sessionStorage
  ) {
    return null;
  }

  return window.sessionStorage;
}

export function getTokens(): StoredTokens {
  const storage = getStorage();

  return {
    accessToken:
      storage?.getItem(ACCESS_TOKEN_KEY) ?? null,
    refreshToken:
      storage?.getItem(REFRESH_TOKEN_KEY) ?? null,
  };
}

export function setTokens(tokenPair: TokenPair) {
  const storage = getStorage();

  storage?.setItem(
    ACCESS_TOKEN_KEY,
    tokenPair.access_token,
  );
  storage?.setItem(
    REFRESH_TOKEN_KEY,
    tokenPair.refresh_token,
  );
}

export function clearTokens() {
  const storage = getStorage();

  storage?.removeItem(ACCESS_TOKEN_KEY);
  storage?.removeItem(REFRESH_TOKEN_KEY);
}

export function hasStoredSession(): boolean {
  const { accessToken, refreshToken } = getTokens();

  return Boolean(accessToken && refreshToken);
}
