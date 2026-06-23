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

const primaryButtonClass =
  "rounded-full bg-[#0071e3] text-white shadow-[0_16px_34px_-24px_rgba(0,113,227,0.9)] hover:bg-[#0066cc]";
const lightButtonClass =
  "rounded-full border-black/10 bg-white text-[#1d1d1f] shadow-sm hover:bg-[#f5f5f7]";
const fieldLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.2em] text-black/42";
const inputClass =
  "h-11 rounded-2xl border-slate-200 bg-white shadow-[0_12px_28px_-24px_rgba(15,23,42,0.55)]";
const textareaClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.55)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const formSectionClass =
  "rounded-[28px] border border-black/8 bg-white/78 p-4 shadow-[0_18px_55px_-48px_rgba(15,23,42,0.8)]";

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

  const activeTemplateCount = templates.filter(
    (template) => template.is_active !== false,
  ).length;
  const totalGroupCount = templates.reduce(
    (sum, template) =>
      sum +
      ((template.groups_json || template.groups || []).length || 0),
    0,
  );
  const totalCheckCount = templates.reduce(
    (sum, template) =>
      sum +
      ((template.required_details_json || template.required_details || [])
        .length || 0),
    0,
  );

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
            <Card className="overflow-hidden rounded-[34px] border-0 bg-white py-0 shadow-[0_26px_80px_-56px_rgba(15,23,42,0.65)] ring-1 ring-black/8">
              <CardContent className="p-0">
                <div className="relative overflow-hidden border-b border-black/6 bg-[radial-gradient(circle_at_top_left,#dff3ff,transparent_36%),linear-gradient(135deg,#fbfdff,#ffffff_48%,#f5f8ff)] px-5 py-5 md:px-6">
                  <div className="absolute right-[-5rem] top-[-7rem] h-56 w-56 rounded-full bg-[#0071e3]/10 blur-3xl" />
                  <div className="relative flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-2xl">
                      <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-700 ring-1 ring-blue-100">
                        Template Designer
                      </span>
                      <h2 className="mt-3 text-[1.55rem] font-semibold tracking-[-0.045em] text-[#1d1d1f]">
                        {form.id ? "Edit Smart Template" : "Create Smart Template"}
                      </h2>
                      <p className="mt-1.5 text-sm leading-6 text-slate-600">
                        Build the hints Smart Fill uses to detect item type,
                        suggest specification blocks, and warn for missing
                        details.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                          form.is_active
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                            : "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {form.is_active ? "Active" : "Inactive"}
                      </span>
                      {form.id ? (
                        <Button
                          type="button"
                          variant="outline"
                          className={lightButtonClass}
                          onClick={resetForm}
                        >
                          <Plus className="h-4 w-4" />
                          New
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <form className="space-y-5 p-5 md:p-6" onSubmit={submit}>
                  <section className={formSectionClass}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className={fieldLabelClass}>Identity</p>
                        <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                          Name and availability
                        </h3>
                      </div>
                      <label className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-[#f5f5f7] px-4 py-2">
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={updateField("is_active")}
                          className="h-4 w-4 rounded border-slate-300 accent-[#0071e3]"
                        />
                        <span className="text-sm font-semibold text-slate-700">
                          Active in Smart Fill
                        </span>
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-1.5">
                        <span className={fieldLabelClass}>Template Name</span>
                        <Input
                          value={form.template_name}
                          onChange={updateField("template_name")}
                          placeholder="Windows All-in-One Desktop"
                          className={inputClass}
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className={fieldLabelClass}>Default Item Name</span>
                        <Input
                          value={form.item_name}
                          onChange={updateField("item_name")}
                          placeholder="Windows All-in-One Desktop"
                          className={inputClass}
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className={fieldLabelClass}>Sort Order</span>
                        <Input
                          type="number"
                          min="0"
                          value={form.sort_order}
                          onChange={updateField("sort_order")}
                          className={inputClass}
                        />
                      </label>
                    </div>
                  </section>

                  <section className={formSectionClass}>
                    <div className="mb-4">
                      <p className={fieldLabelClass}>Matching Signals</p>
                      <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                        Help PMS recognize the item
                      </h3>
                      <p className="mt-1 text-sm text-black/52">
                        Keep each value on a new line for cleaner matching.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="space-y-1.5">
                        <span className={fieldLabelClass}>Keywords</span>
                        <textarea
                          rows={5}
                          value={form.keywords_text}
                          onChange={updateField("keywords_text")}
                          placeholder="computer&#10;desktop&#10;aio"
                          className={textareaClass}
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className={fieldLabelClass}>Category Hints</span>
                        <textarea
                          rows={5}
                          value={form.category_hints_text}
                          onChange={updateField("category_hints_text")}
                          placeholder="computer&#10;it hardware"
                          className={textareaClass}
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className={fieldLabelClass}>Subcategory Hints</span>
                        <textarea
                          rows={5}
                          value={form.subcategory_hints_text}
                          onChange={updateField("subcategory_hints_text")}
                          placeholder="all-in-one&#10;desktop"
                          className={textareaClass}
                        />
                      </label>
                    </div>
                  </section>

                  <section className="rounded-[28px] border border-blue-100 bg-[linear-gradient(135deg,#f7fbff,#ffffff)] p-4 shadow-[0_18px_55px_-48px_rgba(0,113,227,0.9)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">
                          Suggestion Groups
                        </p>
                        <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                          Specification building blocks
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Example groups: Processor, Memory, Storage, OS,
                          Display.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className={lightButtonClass}
                        onClick={addGroup}
                      >
                        <Plus className="h-4 w-4" />
                        Add Group
                      </Button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {form.groups.map((group, index) => (
                        <div
                          key={index}
                          className="rounded-[24px] border border-black/6 bg-white/88 p-3 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.7)]"
                        >
                          <div className="grid gap-3 md:grid-cols-[0.42fr_1fr_auto]">
                            <Input
                              value={group.label}
                              onChange={(event) =>
                                updateGroup(index, "label", event.target.value)
                              }
                              placeholder="Memory"
                              className={inputClass}
                            />
                            <textarea
                              rows={3}
                              value={group.suggestions_text}
                              onChange={(event) =>
                                updateGroup(
                                  index,
                                  "suggestions_text",
                                  event.target.value,
                                )
                              }
                              placeholder="8GB RAM&#10;16GB RAM&#10;32GB RAM"
                              className={textareaClass}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="rounded-full"
                              onClick={() => removeGroup(index)}
                              aria-label="Remove group"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,#fff8e8,#ffffff)] p-4 shadow-[0_18px_55px_-48px_rgba(245,158,11,0.9)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-800">
                          Missing Detail Checks
                        </p>
                        <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                          Quality guardrails
                        </h3>
                        <p className="mt-1 text-sm text-amber-900/70">
                          Show helpful hints when key specification parts are
                          missing.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className={lightButtonClass}
                        onClick={addRequiredDetail}
                      >
                        <Plus className="h-4 w-4" />
                        Add Check
                      </Button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {form.required_details.map((detail, index) => (
                        <div
                          key={index}
                          className="rounded-[24px] border border-amber-100 bg-white/88 p-3 shadow-[0_18px_40px_-34px_rgba(245,158,11,0.6)]"
                        >
                          <div className="grid gap-3 md:grid-cols-[0.42fr_1fr_auto]">
                            <Input
                              value={detail.label}
                              onChange={(event) =>
                                updateRequiredDetail(
                                  index,
                                  "label",
                                  event.target.value,
                                )
                              }
                              placeholder="RAM"
                              className={inputClass}
                            />
                            <textarea
                              rows={3}
                              value={detail.patterns_text}
                              onChange={(event) =>
                                updateRequiredDetail(
                                  index,
                                  "patterns_text",
                                  event.target.value,
                                )
                              }
                              placeholder="ram&#10;memory&#10;gb"
                              className={textareaClass}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="rounded-full"
                              onClick={() => removeRequiredDetail(index)}
                              aria-label="Remove check"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <Button className={`${primaryButtonClass} h-11 w-full`} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving
                      ? "Saving..."
                      : form.id
                        ? "Update Template"
                        : "Save Template"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-[34px] border-0 bg-white py-0 shadow-[0_26px_80px_-56px_rgba(15,23,42,0.65)] ring-1 ring-black/8">
              <CardContent className="p-0">
                <div className="relative overflow-hidden border-b border-black/6 bg-[radial-gradient(circle_at_top_right,#e8fff5,transparent_34%),linear-gradient(135deg,#ffffff,#f8fbff)] px-5 py-5 md:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-2xl">
                      <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-700 ring-1 ring-emerald-100">
                        Template Library
                      </span>
                      <h2 className="mt-3 text-[1.55rem] font-semibold tracking-[-0.045em]">
                        Active Smart Templates
                      </h2>
                      <p className="mt-1.5 text-sm leading-6 text-slate-600">
                        Templates used by Smart Fill in the indent item form.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["Active", activeTemplateCount],
                        ["Groups", totalGroupCount],
                        ["Checks", totalCheckCount],
                      ].map(([labelText, value]) => (
                        <div
                          key={labelText}
                          className="rounded-[18px] bg-white px-3 py-2 text-center shadow-sm ring-1 ring-black/6"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/38">
                            {labelText}
                          </p>
                          <p className="mt-1 text-lg font-semibold tracking-[-0.04em]">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 bg-[#fbfcff] p-5 md:p-6">
                  {loading ? (
                    <div className="rounded-[28px] border border-dashed border-black/12 bg-white px-5 py-10 text-center text-sm text-black/56">
                      Loading specification templates...
                    </div>
                  ) : templates.length ? (
                    templates.map((template) => {
                      const groups = template.groups_json || template.groups || [];
                      const requiredDetails =
                        template.required_details_json ||
                        template.required_details ||
                        [];
                      const keywordCount = (template.keywords_json || [])
                        .length;

                      return (
                        <div
                          key={template.id}
                          className="group overflow-hidden rounded-[30px] border border-black/8 bg-white shadow-[0_22px_62px_-52px_rgba(15,23,42,0.8)] transition hover:-translate-y-0.5 hover:shadow-[0_32px_80px_-56px_rgba(0,113,227,0.45)]"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/6 bg-[linear-gradient(135deg,#ffffff,#f6f9ff)] px-4 py-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-[#0071e3] ring-1 ring-blue-100">
                                  <Sparkles className="h-4 w-4" />
                                </span>
                                <div>
                                  <p className="text-lg font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                                    {template.template_name}
                                  </p>
                                  <p className="text-sm text-black/52">
                                    Default item: {template.item_name || "Not set"}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    template.is_active
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-200 text-slate-600"
                                  }`}
                                >
                                  {template.is_active ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {[
                                  `Sort ${template.sort_order ?? 100}`,
                                  `${keywordCount} keyword${keywordCount === 1 ? "" : "s"}`,
                                  `${groups.length} group${groups.length === 1 ? "" : "s"}`,
                                  `${requiredDetails.length} check${requiredDetails.length === 1 ? "" : "s"}`,
                                ].map((item) => (
                                  <span
                                    key={item}
                                    className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-black/8"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className={lightButtonClass}
                              onClick={() => setForm(mapTemplateToForm(template))}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                          </div>

                          {groups.length ? (
                            <div className="grid gap-2 bg-[#f5f5f7] p-4 sm:grid-cols-2">
                              {groups.map((group) => {
                                const suggestions = group.suggestions || [];
                                return (
                                  <div
                                    key={group.label}
                                    className="rounded-[20px] bg-white px-3.5 py-3 ring-1 ring-black/6"
                                  >
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/42">
                                      {group.label}
                                    </p>
                                    <p className="mt-1.5 text-sm leading-6 text-black/64">
                                      {suggestions.slice(0, 4).join(", ")}
                                      {suggestions.length > 4 ? "..." : ""}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="bg-[#f5f5f7] p-4 text-sm text-black/52">
                              No suggestion groups configured.
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-black/12 bg-white px-5 py-10 text-center text-sm text-black/56">
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
