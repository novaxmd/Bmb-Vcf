// Client-side helpers for storing/reading the admin session token.
// The token itself is opaque to the browser; validity is enforced server-side
// by /api/admin/* routes via verifyAdminToken().

const STORAGE_KEY = "bmb_admin_token";

export function saveAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function clearAdminToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

// Best-effort local check (does not verify signature/expiry cryptographically —
// that always happens server-side). Used only to decide UI state like the
// profile dot color before the user actually opens a protected route.
export function isAdminSession(): boolean {
  const token = getAdminToken();
  if (!token || !token.includes(".")) return false;
  const parts = token.split(".");
  const expires = parseInt(parts[0], 10);
  if (Number.isNaN(expires)) return false;
  return Date.now() < expires;
}

// Reads the role ("owner" | "admin") embedded in the current token, without
// verifying its signature (that always happens server-side on each request).
// Used only to decide which UI sections to show.
export function getSessionRole(): "owner" | "admin" | null {
  const token = getAdminToken();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const role = parts[2];
  if (role !== "owner" && role !== "admin") return null;
  return role;
}

export async function adminFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
