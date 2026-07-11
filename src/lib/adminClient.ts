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
  const [payload] = token.split(".");
  const expires = parseInt(payload, 10);
  if (Number.isNaN(expires)) return false;
  return Date.now() < expires;
}

export async function adminFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
