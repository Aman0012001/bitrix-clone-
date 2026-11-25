import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { ApiError, apiRequest } from "../../services/api";
import type { CurrentUserResponse, PublicOrganization, PublicUser } from "../../types/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export type AuthSnapshot = {
  status: AuthStatus;
  user: PublicUser | null;
  organizations: PublicOrganization[];
  activeOrganization: PublicOrganization | null;
  error: string | null;
};

type Credentials = { email: string; password: string };
type Registration = Credentials & { name: string };

type AuthContextValue = AuthSnapshot & {
  refresh: () => Promise<AuthSnapshot | null>;
  login: (credentials: Credentials) => Promise<AuthSnapshot>;
  register: (registration: Registration) => Promise<AuthSnapshot>;
  logout: () => Promise<void>;
};

const initialSnapshot: AuthSnapshot = {
  status: "loading",
  user: null,
  organizations: [],
  activeOrganization: null,
  error: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  const refresh = useCallback(async () => {
    try {
      const current = await apiRequest<CurrentUserResponse>("/auth/me");
      const next: AuthSnapshot = {
        status: "authenticated",
        user: current.user,
        organizations: current.organizations,
        activeOrganization: current.activeOrganization,
        error: null,
      };
      setSnapshot(next);
      return next;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        const next: AuthSnapshot = {
          ...initialSnapshot,
          status: "unauthenticated",
        };
        setSnapshot(next);
        return next;
      }

      const next: AuthSnapshot = {
        ...initialSnapshot,
        status: "error",
        error: error instanceof Error ? error.message : "Unable to load your session.",
      };
      setSnapshot(next);
      return null;
    }
  }, []);

  const login = useCallback(
    async (credentials: Credentials) => {
      await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
        retryOnUnauthorized: false,
      });
      const current = await refresh();
      if (!current || current.status !== "authenticated") {
        throw new Error("The session could not be loaded after sign-in.");
      }
      return current;
    },
    [refresh],
  );

  const register = useCallback(
    async (registration: Registration) => {
      await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(registration),
        retryOnUnauthorized: false,
      });
      const current = await refresh();
      if (!current || current.status !== "authenticated") {
        throw new Error("The session could not be loaded after registration.");
      }
      return current;
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await apiRequest<void>("/auth/logout", {
      method: "POST",
      retryOnUnauthorized: false,
    });
    setSnapshot({ ...initialSnapshot, status: "unauthenticated" });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...snapshot, refresh, login, register, logout }),
    [snapshot, refresh, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
