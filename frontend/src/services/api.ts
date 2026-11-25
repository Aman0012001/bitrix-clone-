export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiRequestInit = RequestInit & {
  retryOnUnauthorized?: boolean;
};

function messageFromBody(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return "The request could not be completed.";
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestInit = {},
): Promise<T> {
  const { retryOnUnauthorized = true, ...init } = options;
  let response = await send(path, init);

  if (
    response.status === 401 &&
    retryOnUnauthorized &&
    path !== "/auth/refresh" &&
    path !== "/auth/login" &&
    path !== "/auth/register"
  ) {
    const refresh = await send("/auth/refresh", { method: "POST" });
    if (refresh.ok) {
      response = await send(path, init);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new ApiError(messageFromBody(body), response.status);
  }

  return body as T;
}
