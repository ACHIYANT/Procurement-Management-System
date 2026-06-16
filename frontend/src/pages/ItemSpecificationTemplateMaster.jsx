import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, Save, Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";

import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  patchProcurement,
  postProcurement,
  procurementRequest,
} from "@/lib/procurement-api";
import { getCurrentUserRoles } from "@/lib/roles";

const blankGroup = () => ({ label: "", suggestions_text: "" });
const blankRequiredDetail = () => ({ label: "", patterns_text: "" });

const blankForm = () => ({
  id: null,
  template_name: "",
  item_name: "",
  keywords_text: "",
  category_hints_text: "",
  subcategory_hints_text: "",
  groups: [blankGroup()],
  required_details: [blankRequiredDetail()],
  sort_order: "100",
  is_active: true,
});

const splitText = (value) =>
  String(value || "")
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const joinText = (value) => (Array.isArray(value) ? value.join("\n") : "");

const mapTemplateToForm = (template = {}) => ({
  id: template.id || null,
  template_name: template.template_name || "",
  item_name: template.item_name || "",
  keywords_text: joinText(template.keywords_json || template.keywords),
  category_hints_text: joinText(template.category_hints_json || template.category_hints),
  subcategory_hints_text: joinText(template.subcategory_hints_json || template.subcategory_hints),
  groups: (template.groups_json || template.groups || []).length
    ? (template.groups_json || template.groups).map((group) => ({
        label: group.label || "",
        suggestions_text: joinText(group.suggestions),
      }))
    : [blankGroup()],
  required_details: (template.required_details_json || template.required_details || []).length
    ? (template.required_details_json || template.required_details).map((detail) => ({
        label: detail.label || "",
        patterns_text: joinText(detail.patterns),
      }))
    : [blankRequiredDetail()],
  sort_order: String(template.sort_order ?? "100"),
  is_active: template.is_active !== false,
});

const buildPayload = (form, roles) => ({
  template_name: form.template_name,
  item_name: form.item_name,
  keywords: splitText(form.keywords_text),
  category_hints: splitText(form.category_hints_text),
  subcategory_hints: splitText(form.subcategory_hints_text),
  groups: form.groups
    .map((group) => ({
      label: group.label,
      suggestions: splitText(group.suggestions_text),
    }))
    .filter((group) => String(group.label || "").trim() && group.suggestions.length),
  required_details: form.required_details
    .map((detail) => ({
      label: detail.label,
      patterns: splitText(detail.patterns_text),
    }))
    .filter((detail) => String(detail.label || "").trim() && detail.patterns.length),
  sort_order: form.sort_order,
  is_active: form.is_active,
  actor_roles: roles,
});

export default function ItemSpecificationTemplateMaster() {
  const [roles] = useState(() => getCurrentUserRoles());
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await procurementRequest("/item-specification-templates");
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to load specification templates.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadTemplates(), 0);
    return () => clearTimeout(timer);
  }, [loadTemplates]);

  const updateField = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateGroup = (index, field, value) => {
    setForm((current) => ({
      ...current,
      groups: current.groups.map((group, groupIndex) =>
        groupIndex === index ? { ...group, [field]: value } : group,
      ),
    }));
  };

  const addGroup = () => {
    setForm((current) => ({ ...current, groups: [...current.groups, blankGroup()] }));
  };

  const removeGroup = (index) => {
    setForm((current) => ({
      ...current,
      groups:
        current.groups.length === 1
          ? [blankGroup()]
          : current.groups.filter((_, groupIndex) => groupIndex !== index),
    }));
  };

  const updateRequiredDetail = (index, field, value) => {
    setForm((current) => ({
      ...current,
      required_details: current.required_details.map((detail, detailIndex) =>
        detailIndex === index ? { ...detail, [field]: value } : detail,
      ),
    }));
  };

  const addRequiredDetail = () => {
    setForm((current) => ({
      ...current,
      required_details: [...current.required_details, blankRequiredDetail()],
    }));
  };

  const removeRequiredDetail = (index) => {
    setForm((current) => ({
      ...current,
      required_details:
        current.required_details.length === 1
          ? [blankRequiredDetail()]
          : current.required_details.filter((_, detailIndex) => detailIndex !== index),
    }));
  };

  const resetForm = () => setForm(blankForm());

  const submit = async (event) => {
    event.preventDefault();
    if (!String(form.template_name || "").trim()) {
      setPopup({ open: true, type: "warning", message: "Template name is required." });
      return;
    }
    if (!splitText(form.keywords_text).length) {
      setPopup({ open: true, type: "warning", message: "Add at least one keyword." });
      return;
    }
    if (!buildPayload(form, roles).groups.length) {
      setPopup({ open: true, type: "warning", message: "Add at least one suggestion group." });
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(form, roles);
      if (form.id) {
        await patchProcurement(`/item-specification-templates/${form.id}`, payload);
      } else {
        await postProcurement("/item-specification-templates", payload);
      }
      setPopup({
        open: true,
        type: "success",
        message: form.id ? "Specification template updated." : "Specification template created.",
      });
      resetForm();
      await loadTemplates();
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to save specification template.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="min-h-full bg-[#f5f5f7] px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-4">
              <Link
                to="/item-categories"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to item categories
              </Link>
            </div>
            <div className="px-6 py-6 md:px-8 md:py-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
                Admin Master
              </p>
              <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">
                Specification Templates
              </h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70 md:text-[15px]">
                Configure Smart Fill suggestions for indent items. These templates control sections like processor, memory, storage, OS, display, and printer features.
              </p>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
            <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[1.35rem] font-semibold tracking-[-0.03em]">
                      {form.id ? "Edit Template" : "Add Template"}
                    </h2>
                    <p className="mt-1 text-sm text-black/56">
                      Use comma or new line separated values for keywords, hints, suggestions, and required-detail patterns.
                    </p>
                  </div>
                  {form.id ? (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      <Plus className="h-4 w-4" />
                      New
                    </Button>
                  ) : null}
                </div>

                <form className="space-y-5" onSubmit={submit}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-black/70">Template Name</span>
                      <Input value={form.template_name} onChange={updateField("template_name")} placeholder="Windows All-in-One Desktop" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-black/70">Default Item Name</span>
                      <Input value={form.item_name} onChange={updateField("item_name")} placeholder="Windows All-in-One Desktop" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-black/70">Sort Order</span>
                      <Input type="number" min="0" value={form.sort_order} onChange={updateField("sort_order")} />
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={updateField("is_active")}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-sm font-medium text-black/70">Active in indent Smart Fill</span>
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-black/70">Keywords</span>
                      <textarea
                        rows={5}
                        value={form.keywords_text}
                        onChange={updateField("keywords_text")}
                        placeholder="computer&#10;desktop&#10;aio"
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-black/70">Category Hints</span>
                      <textarea
                        rows={5}
                        value={form.category_hints_text}
                        onChange={updateField("category_hints_text")}
                        placeholder="computer&#10;it hardware"
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-black/70">Subcategory Hints</span>
                      <textarea
                        rows={5}
                        value={form.subcategory_hints_text}
                        onChange={updateField("subcategory_hints_text")}
                        placeholder="all-in-one&#10;desktop"
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Suggestion Groups
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Example groups: Processor, Memory, Storage, OS, Display.
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={addGroup}>
                        <Plus className="h-4 w-4" />
                        Add Group
                      </Button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {form.groups.map((group, index) => (
                        <div key={index} className="rounded-2xl bg-white p-3 ring-1 ring-black/6">
                          <div className="grid gap-3 md:grid-cols-[0.4fr_1fr_auto]">
                            <Input
                              value={group.label}
                              onChange={(event) => updateGroup(index, "label", event.target.value)}
                              placeholder="Memory"
                            />
                            <textarea
                              rows={3}
                              value={group.suggestions_text}
                              onChange={(event) => updateGroup(index, "suggestions_text", event.target.value)}
                              placeholder="8GB RAM&#10;16GB RAM&#10;32GB RAM"
                              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => removeGroup(index)}
                              aria-label="Remove group"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-800">
                          Missing Detail Checks
                        </h3>
                        <p className="mt-1 text-xs text-amber-800/70">
                          These show helpful hints if the user has not entered key specification parts.
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={addRequiredDetail}>
                        <Plus className="h-4 w-4" />
                        Add Check
                      </Button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {form.required_details.map((detail, index) => (
                        <div key={index} className="rounded-2xl bg-white p-3 ring-1 ring-amber-200">
                          <div className="grid gap-3 md:grid-cols-[0.4fr_1fr_auto]">
                            <Input
                              value={detail.label}
                              onChange={(event) => updateRequiredDetail(index, "label", event.target.value)}
                              placeholder="RAM"
                            />
                            <textarea
                              rows={3}
                              value={detail.patterns_text}
                              onChange={(event) => updateRequiredDetail(index, "patterns_text", event.target.value)}
                              placeholder="ram&#10;memory&#10;gb"
                              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => removeRequiredDetail(index)}
                              aria-label="Remove check"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button className="w-full rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]" disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : form.id ? "Update Template" : "Save Template"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <CardContent className="space-y-4">
                <div>
                  <h2 className="text-[1.35rem] font-semibold tracking-[-0.03em]">
                    Active Smart Templates
                  </h2>
                  <p className="mt-1 text-sm text-black/56">
                    Templates are used by Smart Fill in the indent item form.
                  </p>
                </div>

                <div className="space-y-3">
                  {loading ? (
                    <div className="rounded-2xl border border-dashed border-black/12 bg-[#f5f5f7] px-4 py-8 text-sm text-black/56">
                      Loading specification templates...
                    </div>
                  ) : templates.length ? (
                    templates.map((template) => {
                      const groups = template.groups_json || template.groups || [];
                      const requiredDetails = template.required_details_json || template.required_details || [];
                      return (
                        <div key={template.id} className="rounded-2xl bg-[#f5f5f7] p-4 ring-1 ring-black/6">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Sparkles className="h-4 w-4 text-[#0071e3]" />
                                <p className="text-base font-semibold text-[#1d1d1f]">
                                  {template.template_name}
                                </p>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  template.is_active
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                                >
                                  {template.is_active ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-black/56">
                                Default item: {template.item_name || "Not set"}
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-black/40">
                                Sort {template.sort_order ?? 100} · {(template.keywords_json || []).length} keywords · {groups.length} groups · {requiredDetails.length} checks
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setForm(mapTemplateToForm(template))}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                          </div>

                          {groups.length ? (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {groups.map((group) => (
                                <div key={group.label} className="rounded-xl bg-white px-3 py-2 ring-1 ring-black/6">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/42">
                                    {group.label}
                                  </p>
                                  <p className="mt-1 text-sm text-black/64">
                                    {(group.suggestions || []).slice(0, 4).join(", ")}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-black/12 bg-[#f5f5f7] px-4 py-8 text-sm text-black/56">
                      No specification templates created yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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
