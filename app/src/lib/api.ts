export interface ApiItems<T> {
  items: T[];
}

export function getKilnApiUrl(): string {
  return (import.meta.env.VITE_KILN_API_URL || import.meta.env.VITE_KILN_API_BASE_URL || "").replace(
    /\/$/,
    ""
  );
}

export async function fetchKilnApi<T>(path: string): Promise<T | null> {
  const baseUrl = getKilnApiUrl();
  if (!baseUrl) return null;

  try {
    const response = await fetch(`${baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`Arcadia API request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    // Log the error for debugging but allow graceful fallback
    console.error(`Failed to fetch from Arcadia API at ${baseUrl}${path}:`, error);
    throw error;
  }
}
