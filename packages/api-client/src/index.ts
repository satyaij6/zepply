// Typed client for /api/v1, used by both web and mobile so they call the API
// the same way (spec §5.7). Endpoints are added as ticket T-09 lands.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => Promise<string | null> | string | null;
}

export function createApiClient({ baseUrl, getToken }: ApiClientOptions) {
  async function request<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const token = getToken ? await getToken() : null;
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(res.status, err.code ?? "unknown_error", err.message ?? res.statusText);
    }
    return (await res.json()) as T;
  }

  return {
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body?: unknown, idempotencyKey?: string) => request<T>("POST", path, body, idempotencyKey),
    patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
    delete: <T>(path: string) => request<T>("DELETE", path),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
