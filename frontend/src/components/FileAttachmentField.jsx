import { Eye, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import FieldError from "@/components/FieldError";
import ViewFilePopup from "@/components/ViewFilePopup";
import { Button } from "@/components/ui/button";
import { getStoredFileName, toProcurementFileDownloadUrl } from "@/lib/procurement-files";

function helperTextForUpload(uploading, fileName, helperText) {
  if (uploading) return "Uploading file securely...";
  if (fileName) return helperText || "View or download available.";
  return helperText || "Allowed: PDF, image, Word, Excel, CSV, TXT";
}

export default function FileAttachmentField({
  label,
  storedPath,
  onChange,
  onUpload,
  error,
  helperText,
  accept = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt",
  readOnly = false,
  allowReplace = true,
  allowClear = true,
  emptyLabel = "No file uploaded yet",
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const fileName = getStoredFileName(storedPath);

  const triggerPicker = () => fileInputRef.current?.click();

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (typeof onUpload !== "function") {
      setUploadError("File upload is not configured.");
      event.target.value = "";
      return;
    }

    try {
      setUploading(true);
      setUploadError("");
      const uploaded = await onUpload(file);
      onChange(uploaded?.path || "");
    } catch (error) {
      setUploadError(error?.message || "File upload failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <>
      <div className="space-y-2 text-sm font-medium text-slate-700">
        <span className="block">{label}</span>
        <div className={`rounded-2xl border border-dashed bg-slate-50 p-3 ${error ? "border-rose-400" : "border-slate-300"}`}>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="space-y-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="shrink-0 rounded-2xl bg-white p-2 text-slate-500 shadow-sm">
                <Paperclip className="h-4 w-4" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="break-all text-sm font-medium leading-6 text-slate-800">
                  {fileName || emptyLabel}
                </p>
                <p className="text-xs leading-5 text-slate-500">
                  {helperTextForUpload(uploading, fileName, helperText)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-[2.75rem]">
              {!readOnly ? (
                <Button type="button" variant="outline" size="sm" onClick={triggerPicker} disabled={uploading || (fileName && !allowReplace)}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {fileName ? (allowReplace ? "Replace" : "Uploaded") : "Upload"}
                </Button>
              ) : null}
              {storedPath ? (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a href={toProcurementFileDownloadUrl(storedPath)}>
                      Download
                    </a>
                  </Button>
                  {!readOnly && allowClear ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
                      <Trash2 className="h-4 w-4" />
                      Clear
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
        <FieldError message={error || uploadError} />
      </div>
      {previewOpen ? (
        <ViewFilePopup
          storedPath={storedPath}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
