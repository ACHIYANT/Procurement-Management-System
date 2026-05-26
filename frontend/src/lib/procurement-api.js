import { toProcurementApiUrl } from "@/lib/api-config";

export async function procurementRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(toProcurementApiUrl(path), {
    credentials: "include",
    headers: isFormData
      ? { ...(options.headers || {}) }
      : {
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

export const postProcurement = (path, body) =>
  procurementRequest(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const patchProcurement = (path, body) =>
  procurementRequest(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deleteProcurement = (path) =>
  procurementRequest(path, {
    method: "DELETE",
  });

export const uploadProcurementFile = (path, formData) =>
  procurementRequest(path, {
    method: "POST",
    body: formData,
  });
