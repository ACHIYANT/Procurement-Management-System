import { toProcurementApiUrl } from "@/lib/api-config";

const normalizeStoredPath = (value = "") => String(value || "").trim();

export const getStoredFileName = (storedPath = "") => {
  const normalized = normalizeStoredPath(storedPath);
  if (!normalized) return "";
  const fileName = normalized.split("/").pop() || "";
  const decodedName = decodeURIComponent(fileName.replace(/\.enc$/i, ""));
  return decodedName.replace(/^\d+_[^_]+_/, "");
};

export const toProcurementFileViewUrl = (storedPath = "") => {
  const normalized = normalizeStoredPath(storedPath);
  if (!normalized) return "";
  return toProcurementApiUrl(`/files/view?path=${encodeURIComponent(normalized)}`);
};

export const toProcurementFileDownloadUrl = (storedPath = "") => {
  const normalized = normalizeStoredPath(storedPath);
  if (!normalized) return "";
  return toProcurementApiUrl(`/files/download?path=${encodeURIComponent(normalized)}`);
};

export const canInlinePreviewFile = (storedPath = "") => {
  const name = getStoredFileName(storedPath).toLowerCase();
  return [".jpeg", ".jpg", ".pdf", ".png", ".webp"].some((ext) => name.endsWith(ext));
};
