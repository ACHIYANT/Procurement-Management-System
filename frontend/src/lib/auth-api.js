import { toAuthApiUrl } from "@/lib/api-config";

export async function authRequest(path, options = {}) {
  const response = await fetch(toAuthApiUrl(path), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.message || "Request failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload?.data;
}
