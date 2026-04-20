import { setAuthTokenGetter } from "@workspace/api-client-react";

const TOKEN_KEY = "forge_auth_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function initAuthTokenGetter(): void {
  setAuthTokenGetter(getStoredToken);
}

export async function ensureGuestSession(): Promise<void> {
  if (getStoredToken()) return;

  try {
    const res = await fetch("/api/auth/guest", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      storeToken(data.token);
    }
  } catch {
    // silently fail — app still works, data just won't persist to server
  }
}
