export const isPdfFile = (file) =>
  file?.type === "application/pdf" ||
  String(file?.name || "").toLowerCase().endsWith(".pdf");
