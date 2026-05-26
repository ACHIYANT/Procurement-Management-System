import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download, Eye, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import FileAttachmentField from "@/components/FileAttachmentField";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FieldError from "@/components/FieldError";
import { Input } from "@/components/ui/input";
import { postProcurement, procurementRequest, uploadProcurementFile } from "@/lib/procurement-api";
import { toProcurementFileDownloadUrl, toProcurementFileViewUrl } from "@/lib/procurement-files";
import { buildRequiredErrors, hasErrors, invalidControlClass } from "@/lib/form-validation";

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const initialExtensionForm = {
  extended_upto: "",
  approval_reference: "",
  approval_date: "",
  approval_document_path: "",
  remarks: "",
};

function Field({ label, children, error }) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

export default function EmpanelmentDetail() {
  const { id } = useParams();
  const [empanelment, setEmpanelment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingExtension, setSavingExtension] = useState(false);
  const [extensionForm, setExtensionForm] = useState(initialExtensionForm);
  const [extensionErrors, setExtensionErrors] = useState({});
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  const loadEmpanelment = useCallback(async () => {
    try {
      setLoading(true);
      setEmpanelment(await procurementRequest(`/empanelments/${id}`));
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to fetch empanelment." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => loadEmpanelment(), 0);
    return () => clearTimeout(timer);
  }, [loadEmpanelment]);

  const uploadExtensionDocument = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadProcurementFile("/files/upload/empanelment_extension_approval", formData);
  };

  const updateExtension = (field) => (event) => {
    setExtensionForm((current) => ({ ...current, [field]: event.target.value }));
    setExtensionErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submitExtension = async (event) => {
    event.preventDefault();
    const validationErrors = buildRequiredErrors(extensionForm, [
      { name: "extended_upto", label: "Extended upto" },
    ]);
    setExtensionErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSavingExtension(true);
    try {
      const data = await postProcurement(`/empanelments/${id}/extensions`, extensionForm);
      setEmpanelment(data);
      setExtensionForm(initialExtensionForm);
      setPopup({ open: true, type: "success", message: "Empanelment extension recorded successfully." });
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to record extension." });
    } finally {
      setSavingExtension(false);
    }
  };

  if (loading && !empanelment) {
    return (
      <div className="grid min-h-full place-items-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-700" />
      </div>
    );
  }

  const categories = Array.isArray(empanelment?.item_categories) ? empanelment.item_categories : [];
  const extensions = Array.isArray(empanelment?.extensions) ? empanelment.extensions : [];

  return (
    <>
      <div className="min-h-full bg-[#f5f5f7] px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-4">
            <Link to="/empanelments" className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to empanelments
            </Link>
            </div>
            <div className="px-6 py-6 md:px-8 md:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">Empanelment Detail</p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">{empanelment?.empanelment_no}</h1>
            <p className="mt-2 text-sm leading-6 text-white/70 md:text-[15px]">
              {empanelment?.firm?.firm_name} ({empanelment?.firm?.firm_code || "NA"})
            </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-0 shadow-lg"><CardContent><p className="text-sm text-slate-500">Status</p><p className="mt-2 text-2xl font-semibold">{label(empanelment?.effective_status)}</p></CardContent></Card>
            <Card className="border-0 shadow-lg"><CardContent><p className="text-sm text-slate-500">Valid From</p><p className="mt-2 text-2xl font-semibold">{empanelment?.valid_from || "NA"}</p></CardContent></Card>
            <Card className="border-0 shadow-lg"><CardContent><p className="text-sm text-slate-500">Current Valid Upto</p><p className="mt-2 text-2xl font-semibold">{empanelment?.current_valid_upto || "NA"}</p></CardContent></Card>
            <Card className="border-0 shadow-lg"><CardContent><p className="text-sm text-slate-500">Category / OEM</p><p className="mt-2 text-2xl font-semibold">{empanelment?.category_count || 0} / {empanelment?.oem_count || 0}</p></CardContent></Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-0 shadow-xl">
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Item Categories and OEMs</h2>
                    <p className="text-sm text-slate-500">Category-wise OEM coverage under this empanelment.</p>
                  </div>
                  {empanelment?.document_path ? (
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={toProcurementFileViewUrl(empanelment.document_path)} target="_blank" rel="noreferrer">
                          <Eye className="h-4 w-4" />
                          View Document
                        </a>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a href={toProcurementFileDownloadUrl(empanelment.document_path)}>
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  {categories.length ? categories.map((category) => (
                    <div key={category.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">{category.category_name}</h3>
                          <p className="text-sm text-slate-500">{category.remarks || "No category remarks"}</p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {(category.oems || []).length} OEMs
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {(category.oems || []).length ? category.oems.map((oem) => (
                          <div key={oem.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <p className="text-sm font-medium text-slate-800">{oem.oem_name}</p>
                            <p className="text-xs text-slate-500">{oem.remarks || "No OEM remarks"}</p>
                          </div>
                        )) : (
                          <p className="text-sm text-slate-400">No OEM mapped for this category.</p>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                      No categories found for this empanelment.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-0 shadow-xl">
                <CardContent className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Add Extension</h2>
                    <p className="text-sm text-slate-500">Record competent authority approval when validity is extended.</p>
                  </div>
                  <form className="grid gap-4" onSubmit={submitExtension} noValidate>
                    <Field label="Extended Upto" error={extensionErrors.extended_upto}>
                      <Input type="date" value={extensionForm.extended_upto} onChange={updateExtension("extended_upto")} className={invalidControlClass(extensionErrors.extended_upto)} />
                    </Field>
                    <Field label="Approval Reference">
                      <Input value={extensionForm.approval_reference} onChange={updateExtension("approval_reference")} />
                    </Field>
                    <Field label="Approval Date">
                      <Input type="date" value={extensionForm.approval_date} onChange={updateExtension("approval_date")} />
                    </Field>
                    <FileAttachmentField
                      label="Approval Document"
                      storedPath={extensionForm.approval_document_path}
                      onChange={(value) => setExtensionForm((current) => ({ ...current, approval_document_path: value }))}
                      onUpload={uploadExtensionDocument}
                      helperText="Upload competent authority approval document for the extension."
                    />
                    <Field label="Remarks">
                      <Input value={extensionForm.remarks} onChange={updateExtension("remarks")} />
                    </Field>
                    <Button type="submit" className="bg-blue-700 text-white hover:bg-blue-800" disabled={savingExtension}>
                      {savingExtension ? "Saving..." : "Save Extension"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl">
                <CardContent className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Extension History</h2>
                    <p className="text-sm text-slate-500">Chronological record of empanelment validity extensions.</p>
                  </div>
                  <div className="space-y-3">
                    {extensions.length ? extensions.map((extension) => (
                      <div key={extension.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {extension.previous_valid_upto || "NA"} to {extension.extended_upto || "NA"}
                          </p>
                          {extension.approval_document_path ? (
                            <div className="flex gap-2">
                              <Button asChild variant="outline" size="sm">
                                <a href={toProcurementFileViewUrl(extension.approval_document_path)} target="_blank" rel="noreferrer">
                                  <Eye className="h-4 w-4" />
                                  View
                                </a>
                              </Button>
                              <Button asChild variant="outline" size="sm">
                                <a href={toProcurementFileDownloadUrl(extension.approval_document_path)}>
                                  <Download className="h-4 w-4" />
                                  Download
                                </a>
                              </Button>
                            </div>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          Approval Ref: {extension.approval_reference || "NA"} | Approval Date: {extension.approval_date || "NA"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">{extension.remarks || "No remarks"}</p>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                        No extension history recorded yet.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ open: false, type: "info", message: "" })}
      />
    </>
  );
}
