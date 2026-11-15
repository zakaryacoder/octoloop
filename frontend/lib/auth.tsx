"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  clearAuth,
  getToken,
  setRefreshToken,
  setToken,
  USER_KEY,
} from "./api";
import type { LoginResponseV2, User } from "./types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount; verify with /auth/me when token present.
  useEffect(() => {
    let cancelled = false;
    const t = getToken();
    if (!t) {
      if (!cancelled) setLoading(false);
      return;
    }
    setTokenState(t);
    setUser(readStoredUser());
    api
      .get<User>("/auth/me")
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        window.localStorage.setItem(USER_KEY, JSON.stringify(me));
      })
      .catch(() => {
        if (cancelled) return;
        clearAuth();
        setTokenState(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<LoginResponseV2>(
      "/auth/login",
      { username, password },
      true
    );
    setToken(res.access_token);
    setTokenState(res.access_token);
    if (res.refresh_token) setRefreshToken(res.refresh_token);
    setUser(res.user);
    window.localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      const rt =
        typeof window !== "undefined"
          ? window.localStorage.getItem("octoloop_refresh_token")
          : null;
      await api.post("/auth/logout", rt ? { refresh_token: rt } : {});
    } catch {
      /* ignore — still clear locally */
    }
    clearAuth();
    setTokenState(null);
    setUser(null);
    if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
      window.localStorage.setItem(USER_KEY, JSON.stringify(me));
    } catch {
      /* keep existing */
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, login, logout, refreshMe }),
    [user, token, loading, login, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
