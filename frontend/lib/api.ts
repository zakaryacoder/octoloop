// OCTOLOOP API client — V2 contract.
// Base URL from NEXT_PUBLIC_API_URL (default http://localhost:8000/api/v1).
// Attaches Bearer JWT from localStorage("octoloop_token").
// V2: refresh-token auto-retry (per V2_CONTRACT §1): on 401, attempt one
// POST /auth/refresh with stored refresh_token; on success retry the original
// request once; on refresh failure clear session and redirect to /login.
export const TOKEN_KEY = "octoloop_token";
export const REFRESH_TOKEN_KEY = "octoloop_refresh_token";
export const USER_KEY = "octoloop_user";

export const API_BASE: string =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000/api/v1";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}
export function setRefreshToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}
export function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail || `Request failed (${status})`);
    this.status = status;
    this.detail = detail;
    this.name = "ApiError";
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  clearAuth();
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// Shared refresh lock so concurrent 401s trigger exactly one refresh request.
let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const rt = getRefreshToken();
    if (!rt) throw new ApiError(401, "No refresh token stored.");
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) {
        throw new ApiError(res.status, "Refresh failed.");
      }
      const data = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      setToken(data.access_token);
      if (data.refresh_token) setRefreshToken(data.refresh_token);
      return data.access_token;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  params?: Record<string, unknown>;
  /** Set true to allow 401 to surface instead of refreshing/redirecting (used by login). */
  allowUnauth?: boolean;
  /** Internal: marks that this request has already been retried once. */
  _retried?: boolean;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function detailFrom(data: unknown, status: number): string {
  return (
    (data && typeof data === "object" && "detail" in data
      ? String((data as { detail: unknown }).detail)
      : null) ||
    (typeof data === "string" ? data : null) ||
    `Request failed with status ${status}`
  );
}

export async function request<T>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, params, allowUnauth, _retried } = opts;
  const url = `${API_BASE}${path}${buildQuery(params)}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Network error — could not reach OCTOLOOP API.");
  }

  // V2 refresh-token auto-retry: one attempt, then fail.
  if (res.status === 401 && !allowUnauth && !_retried) {
    try {
      await doRefresh();
      return request<T>(path, { ...opts, _retried: true });
    } catch {
      redirectToLogin();
      throw new ApiError(401, "Session expired — please log in again.");
    }
  }

  if (res.status === 401 && !allowUnauth) {
    redirectToLogin();
    throw new ApiError(401, "Session expired — please log in again.");
  }

  const data = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, detailFrom(data, res.status));
  }
  return data as T;
}

/** Trigger a browser file download (e.g. CSV export) with auth header. */
export async function downloadFile(
  path: string,
  params?: Record<string, unknown>,
  filename = "export.csv"
): Promise<void> {
  const url = `${API_BASE}${path}${buildQuery(params)}`;
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch {
    throw new ApiError(0, "Network error — could not reach OCTOLOOP API.");
  }
  if (res.status === 401) {
    try {
      await doRefresh();
      const t = getToken();
      res = await fetch(url, {
        headers: { Authorization: t ? `Bearer ${t}` : "" },
      });
    } catch {
      redirectToLogin();
      throw new ApiError(401, "Session expired — please log in again.");
    }
  }
  if (!res.ok) {
    const data = await parseBody(res);
    throw new ApiError(res.status, detailFrom(data, res.status));
  }
  // Honour Content-Disposition filename when present.
  const cd = res.headers.get("Content-Disposition");
  const m = cd && cd.match(/filename\*?=(?:UTF-8'')?("?)([^";]+)\1/i);
  const finalName = m ? decodeURIComponent(m[2].trim()) : filename;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>) =>
    request<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown, allowUnauth = false) =>
    request<T>(path, { method: "POST", body, allowUnauth }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  download: (path: string, params?: Record<string, unknown>, filename?: string) =>
    downloadFile(path, params, filename),
};
