const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

interface RequestConfig {
  url: string;
  method: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  data?: unknown;
  signal?: AbortSignal;
}

export async function customFetch<T>(config: RequestConfig): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("cqg_token") : null;

  const headers: Record<string, string> = {
    ...config.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Build URL with query params
  let url = `${BASE_URL}${config.url}`;
  if (config.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(config.params)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) {
      url += `?${qs}`;
    }
  }

  const isFormData = config.data instanceof FormData;

  if (!isFormData && config.data !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method: config.method,
    headers,
    body: isFormData
      ? (config.data as FormData)
      : config.data !== undefined
        ? JSON.stringify(config.data)
        : undefined,
    signal: config.signal,
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { error: response.statusText };
    }

    const error = new Error(
      (errorBody as { error?: string })?.error ?? `Request failed: ${response.status}`,
    );
    (error as Error & { status: number; body: unknown }).status = response.status;
    (error as Error & { status: number; body: unknown }).body = errorBody;
    throw error;
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // Binary responses (attachments)
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.blob()) as T;
  }

  return (await response.json()) as T;
}

export default customFetch;
