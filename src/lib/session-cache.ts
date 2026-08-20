export type CachedSessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};

const CACHE_KEY = "ballot_user_session";

export function getCachedSessionUser(): CachedSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCachedSessionUser(user: CachedSessionUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch {}
}
