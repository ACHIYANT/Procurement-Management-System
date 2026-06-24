import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Network,
  Pencil,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";

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

const COMMON_GROUPS = [
  "Department",
  "Authority",
  "Board",
  "Corporation",
  "Commission",
  "University",
  "Medical College",
  "Society",
  "Court",
  "Central PSU",
  "Organization",
];

const blankForm = () => ({
  id: null,
  organization_name: "",
  organization_code: "",
  organization_group: "Department",
  parent_code: "",
  sort_order: "100",
  is_active: true,
});

const toCode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

const fieldLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42";
const inputClass =
  "h-11 rounded-2xl border-slate-200 bg-white shadow-[0_14px_30px_-26px_rgba(15,23,42,0.65)]";
const primaryButtonClass =
  "rounded-full bg-[#0071e3] text-white shadow-[0_18px_36px_-24px_rgba(0,113,227,0.9)] hover:bg-[#0066cc]";
const secondaryButtonClass =
  "rounded-full border-black/10 bg-white text-[#1d1d1f] shadow-sm hover:bg-[#f5f5f7]";

function OrganizationTree({ nodes = [], onEdit, level = 0 }) {
  if (!Array.isArray(nodes) || !nodes.length) return null;

  return (
    <div className={level ? "ml-4 border-l border-black/8 pl-4" : "space-y-3"}>
      {nodes.map((node) => (
        <div key={node.organization_code} className="space-y-3">
          <div className="rounded-[22px] border border-black/8 bg-white/88 p-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.75)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-semibold tracking-[-0.02em] text-[#1d1d1f]">
                      {node.organization_name}
                    </h3>
                    <p className="text-xs text-black/46">
                      {node.organization_code}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-semibold text-black/62 ring-1 ring-black/8">
                    {node.organization_group}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                      node.is_active
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                        : "bg-slate-100 text-slate-500 ring-slate-200"
                    }`}
                  >
                    {node.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className={secondaryButtonClass}
                onClick={() => onEdit(node)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </div>
          </div>
          <OrganizationTree nodes={node.children} onEdit={onEdit} level={level + 1} />
        </div>
      ))}
    </div>
  );
}

export default function GovernmentOrganizationMaster() {
  const [roles] = useState(() => getCurrentUserRoles());
  const [form, setForm] = useState(blankForm);
  const [master, setMaster] = useState({ rows: [], tree: [], options: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  const loadOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await procurementRequest("/government-organizations");
      setMaster({
        rows: Array.isArray(data?.rows) ? data.rows : [],
        tree: Array.isArray(data?.tree) ? data.tree : [],
        options: Array.isArray(data?.options) ? data.options : [],
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to load organization master.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadOrganizations(), 0);
    return () => clearTimeout(timer);
  }, [loadOrganizations]);

  const groupOptions = useMemo(() => {
    const existing = master.rows.map((row) => row.organization_group).filter(Boolean);
    return Array.from(new Set([...COMMON_GROUPS, ...existing])).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [master.rows]);

  const filteredTree = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return master.tree;

    const filterNode = (node) => {
      const children = (node.children || []).map(filterNode).filter(Boolean);
      const matches = [
        node.organization_name,
        node.organization_code,
        node.organization_group,
      ].some((value) => String(value || "").toLowerCase().includes(term));
      if (matches || children.length) return { ...node, children };
      return null;
    };

    return master.tree.map(filterNode).filter(Boolean);
  }, [master.tree, search]);

  const updateField = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "organization_name" && !current.id) {
        next.organization_code = toCode(value);
      }
      return next;
    });
  };

  const editOrganization = (organization) => {
    setForm({
      id: organization.id,
      organization_name: organization.organization_name || "",
      organization_code: organization.organization_code || "",
      organization_group: organization.organization_group || "Department",
      parent_code: organization.parent_code || "",
      sort_order: String(organization.sort_order ?? "100"),
      is_active: organization.is_active !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => setForm(blankForm());

  const submit = async (event) => {
    event.preventDefault();
    if (!String(form.organization_name || "").trim()) {
      setPopup({ open: true, type: "warning", message: "Organization name is required." });
      return;
    }
    if (!String(form.organization_group || "").trim()) {
      setPopup({ open: true, type: "warning", message: "Organization type/group is required." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        parent_code: form.parent_code || null,
        actor_roles: roles,
      };

      if (form.id) {
        await patchProcurement(`/government-organizations/${form.id}`, payload);
      } else {
        await postProcurement("/government-organizations", payload);
      }

      setPopup({
        open: true,
        type: "success",
        message: form.id ? "Organization updated." : "Organization added.",
      });
      resetForm();
      await loadOrganizations();
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to save organization.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="px-6 py-6 md:px-8 md:py-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
                Admin Master
              </p>
              <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">
                Government Organizations
              </h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70 md:text-[15px]">
                Maintain departments, universities, boards, corporations, societies, courts, and other indenting organizations with parent hierarchy.
              </p>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
            <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[1.35rem] font-semibold tracking-[-0.03em]">
                      {form.id ? "Edit Organization" : "Add Organization"}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-black/56">
                      Select a parent only when this office belongs under another department or body.
                    </p>
                  </div>
                  {form.id ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={secondaryButtonClass}
                      onClick={resetForm}
                    >
                      <X className="mr-2 h-4 w-4" />
                      New
                    </Button>
                  ) : null}
                </div>

                <form className="space-y-4" onSubmit={submit}>
                  <label className="space-y-1.5">
                    <span className={fieldLabelClass}>Organization Name</span>
                    <Input
                      value={form.organization_name}
                      onChange={updateField("organization_name")}
                      className={inputClass}
                      placeholder="e.g. Haryana State Board"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className={fieldLabelClass}>Organization Code</span>
                      <Input
                        value={form.organization_code}
                        onChange={updateField("organization_code")}
                        className={inputClass}
                        readOnly={Boolean(form.id)}
                        disabled={Boolean(form.id)}
                        placeholder="auto_generated_code"
                      />
                      {form.id ? (
                        <p className="text-xs text-black/42">
                          Code is fixed so child links remain stable.
                        </p>
                      ) : null}
                    </label>

                    <label className="space-y-1.5">
                      <span className={fieldLabelClass}>Group / Type</span>
                      <Input
                        list="government-organization-groups"
                        value={form.organization_group}
                        onChange={updateField("organization_group")}
                        className={inputClass}
                        placeholder="Department, University, Board..."
                      />
                      <datalist id="government-organization-groups">
                        {groupOptions.map((group) => (
                          <option key={group} value={group} />
                        ))}
                      </datalist>
                    </label>
                  </div>

                  <label className="space-y-1.5">
                    <span className={fieldLabelClass}>Parent Organization</span>
                    <select
                      value={form.parent_code}
                      onChange={updateField("parent_code")}
                      className={`${inputClass} w-full px-3 text-sm outline-none`}
                    >
                      <option value="">No parent / root organization</option>
                      {master.options
                        .filter((option) => String(option.id) !== String(form.id))
                        .map((option) => (
                          <option key={option.rawValue} value={option.rawValue}>
                            {option.label} ({option.group})
                          </option>
                        ))}
                    </select>
                  </label>

                  <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                    <label className="space-y-1.5">
                      <span className={fieldLabelClass}>Sort Order</span>
                      <Input
                        type="number"
                        value={form.sort_order}
                        onChange={updateField("sort_order")}
                        className={inputClass}
                      />
                    </label>
                    <label className="flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-[#f7fbff] px-4 text-sm font-semibold text-black/72">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={updateField("is_active")}
                        className="h-4 w-4 accent-[#0071e3]"
                      />
                      Active
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className={`${primaryButtonClass} w-full sm:w-auto`}
                    disabled={saving}
                  >
                    {form.id ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                    {saving ? "Saving..." : form.id ? "Save Changes" : "Add Organization"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <CardContent className="space-y-5 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[1.35rem] font-semibold tracking-[-0.03em]">
                      Organization Directory
                    </h2>
                    <p className="mt-1 text-sm text-black/56">
                      {master.rows.length} records available for indent and finance dropdowns.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    <CheckCircle2 className="h-4 w-4" />
                    Live master
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    placeholder="Search department, university, board, code..."
                  />
                </div>

                {loading ? (
                  <div className="rounded-[24px] border border-dashed border-black/12 bg-[#f5f5f7] p-8 text-center text-sm text-black/56">
                    Loading organizations...
                  </div>
                ) : filteredTree.length ? (
                  <div className="max-h-[68vh] overflow-y-auto pr-1">
                    <OrganizationTree nodes={filteredTree} onEdit={editOrganization} />
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-black/12 bg-[#f5f5f7] p-8 text-center text-sm text-black/56">
                    <Network className="mx-auto mb-3 h-8 w-8 text-black/32" />
                    No organization matched your search.
                  </div>
                )}
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
