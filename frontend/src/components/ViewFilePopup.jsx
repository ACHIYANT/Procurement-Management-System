import { Download, ExternalLink, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  canInlinePreviewFile,
  getStoredFileName,
  toProcurementFileDownloadUrl,
  toProcurementFileViewUrl,
} from "@/lib/procurement-files";

export default function ViewFilePopup({ storedPath, onClose }) {
  if (!storedPath) return null;

  const fileName = getStoredFileName(storedPath);
  const viewUrl = toProcurementFileViewUrl(storedPath);
  const downloadUrl = toProcurementFileDownloadUrl(storedPath);
  const lowerName = fileName.toLowerCase();
  const isPdf = lowerName.endsWith(".pdf");
  const isImage = [".jpeg", ".jpg", ".png", ".webp"].some((ext) => lowerName.endsWith(ext));
  const canPreview = canInlinePreviewFile(storedPath);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">File Preview</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{fileName || "Uploaded file"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={viewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={downloadUrl}>
                <Download className="h-4 w-4" />
                Download
              </a>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="max-h-[78vh] overflow-auto bg-slate-100 p-4">
          {canPreview ? (
            isPdf ? (
              <iframe title={fileName} src={viewUrl} className="h-[72vh] w-full rounded-2xl border border-slate-200 bg-white" />
            ) : isImage ? (
              <img src={viewUrl} alt={fileName} className="mx-auto max-h-[72vh] rounded-2xl border border-slate-200 bg-white object-contain" />
            ) : null
          ) : (
            <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
              <div className="space-y-3">
                <p className="text-sm text-slate-600">This file type is not shown inline.</p>
                <div className="flex items-center justify-center gap-3">
                  <Button asChild variant="outline" size="sm">
                    <a href={viewUrl} target="_blank" rel="noreferrer">Open File</a>
                  </Button>
                  <Button asChild size="sm">
                    <a href={downloadUrl}>Download File</a>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
