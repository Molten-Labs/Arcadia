const TOKEN_KEY = "arcadia_jwt";

export function getStoredToken(): string | null {
  return typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function subscribeToStorageChanges(event: string, onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(event, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(event, onChange);
  };
}
