import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AUTH_EXPIRED_EVENT,
} from "../../api/client";
import { queryClient } from "../../app/queryClient";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
} from "./auth.api";
import type {
  LoginPayload,
} from "./auth.types";
import type { CurrentUser } from "./auth.types";
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from "./authContext";
import {
  clearTokens,
  getTokens,
  hasStoredSession,
  setTokens,
} from "./tokenStore";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<CurrentUser | null>(null);
  const [status, setStatus] =
    useState<AuthStatus>("restoring");

  const endSession = useCallback(() => {
    clearTokens();
    queryClient.clear();
    setUser(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      if (!hasStoredSession()) {
        if (isActive) {
          setStatus("anonymous");
        }
        return;
      }

      try {
        const currentUser = await getCurrentUser();

        if (isActive) {
          setUser(currentUser);
          setStatus("authenticated");
        }
      } catch {
        if (isActive) {
          endSession();
        }
      }
    }

    void restoreSession();

    return () => {
      isActive = false;
    };
  }, [endSession]);

  useEffect(() => {
    function handleExpiredSession() {
      endSession();
    }

    window.addEventListener(
      AUTH_EXPIRED_EVENT,
      handleExpiredSession,
    );

    return () => {
      window.removeEventListener(
        AUTH_EXPIRED_EVENT,
        handleExpiredSession,
      );
    };
  }, [endSession]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const tokenPair = await loginRequest(payload);
      setTokens(tokenPair);

      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        setStatus("authenticated");
      } catch (error) {
        endSession();
        throw error;
      }
    },
    [endSession],
  );

  const logout = useCallback(async () => {
    const { refreshToken } = getTokens();

    try {
      if (refreshToken) {
        await logoutRequest(refreshToken);
      }
    } finally {
      endSession();
    }
  }, [endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login,
      logout,
    }),
    [login, logout, status, user],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
