const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || "";
};

export function buildDisplayMessage(detailOrMessage, fallbackMessage = "Request failed.") {
  if (typeof detailOrMessage === "string") {
    return normalizeText(detailOrMessage) || fallbackMessage;
  }

  const message =
    normalizeText(detailOrMessage?.message || detailOrMessage?.err?.message) ||
    fallbackMessage;
  const hint = normalizeText(detailOrMessage?.hint);
  const requestId = normalizeText(detailOrMessage?.requestId);

  const lines = [message];
  if (hint) lines.push(hint);
  if (requestId) lines.push(`Reference ID: ${requestId}`);
  return lines.join("\n\n");
}

export function buildDiagnosticPresentation(detailOrMessage, fallbackMessage = "Request failed.") {
  const detail =
    typeof detailOrMessage === "string"
      ? { message: detailOrMessage }
      : detailOrMessage || {};

  const rows = [];
  if (detail?.code) rows.push({ label: "Code", value: String(detail.code) });
  if (detail?.status) rows.push({ label: "Status", value: String(detail.status) });
  if (detail?.requestId) rows.push({ label: "Request ID", value: String(detail.requestId) });

  return {
    message: buildDisplayMessage(detail, fallbackMessage),
    diagnostic: rows.length ? { title: "Diagnostics", rows } : null,
  };
}
