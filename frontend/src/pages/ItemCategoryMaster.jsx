import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { postProcurement, procurementRequest } from "@/lib/procurement-api";

const blankSubcategory = () => ({ subcategory_name: "" });

export default function ItemCategoryMaster() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    category_name: "",
    subcategories: [blankSubcategory()],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await procurementRequest("/item-categories");
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to load item categories.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadCategories(), 0);
    return () => clearTimeout(timer);
  }, [loadCategories]);

  const updateSubcategory = (index, value) => {
    setForm((current) => ({
      ...current,
      subcategories: current.subcategories.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, subcategory_name: value } : entry,
      ),
    }));
  };

  const addSubcategory = () => {
    setForm((current) => ({
      ...current,
      subcategories: [...current.subcategories, blankSubcategory()],
    }));
  };

  const removeSubcategory = (index) => {
    setForm((current) => ({
      ...current,
      subcategories:
        current.subcategories.length === 1
          ? [blankSubcategory()]
          : current.subcategories.filter((_, entryIndex) => entryIndex !== index),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!String(form.category_name || "").trim()) {
      setPopup({ open: true, type: "warning", message: "Category name is required." });
      return;
    }

    setSaving(true);
    try {
      await postProcurement("/item-categories", {
        category_name: form.category_name,
        subcategories: form.subcategories.filter((entry) =>
          String(entry.subcategory_name || "").trim(),
        ),
      });
      setForm({ category_name: "", subcategories: [blankSubcategory()] });
      setPopup({ open: true, type: "success", message: "Item category saved." });
      await loadCategories();
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to save item category.",
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
                Masters
              </p>
              <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">
                Item Categories
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70 md:text-[15px]">
                Maintain procurement item categories and subcategories for indent item classification.
              </p>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <CardContent className="space-y-5">
                <div>
                  <h2 className="text-[1.35rem] font-semibold tracking-[-0.03em]">
                    Add Category
                  </h2>
                  <p className="mt-1 text-sm text-black/56">
                    Add one category and its subcategories together.
                  </p>
                </div>

                <form className="space-y-4" onSubmit={submit}>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-black/70">Category Name</span>
                    <Input
                      value={form.category_name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category_name: event.target.value,
                        }))
                      }
                      placeholder="IT Hardware"
                    />
                  </label>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-black/70">
                        Subcategories
                      </span>
                      <Button type="button" variant="outline" size="sm" onClick={addSubcategory}>
                        <Plus className="h-4 w-4" />
                        Add
                      </Button>
                    </div>
                    {form.subcategories.map((entry, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={entry.subcategory_name}
                          onChange={(event) =>
                            updateSubcategory(index, event.target.value)
                          }
                          placeholder="Laptop"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeSubcategory(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button className="w-full rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]" disabled={saving}>
                    {saving ? "Saving..." : "Save Category"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <CardContent className="space-y-4">
                <div>
                  <h2 className="text-[1.35rem] font-semibold tracking-[-0.03em]">
                    Existing Categories
                  </h2>
                  <p className="mt-1 text-sm text-black/56">
                    Categories shown here are available in the indent item form.
                  </p>
                </div>

                <div className="space-y-3">
                  {loading ? (
                    <div className="rounded-2xl border border-dashed border-black/12 bg-[#f5f5f7] px-4 py-8 text-sm text-black/56">
                      Loading item categories...
                    </div>
                  ) : categories.length ? (
                    categories.map((category) => (
                      <div key={category.id} className="rounded-2xl bg-[#f5f5f7] p-4 ring-1 ring-black/6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-[#1d1d1f]">
                              {category.category_name}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-black/42">
                              {category.is_active ? "Active" : "Inactive"}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black/58 ring-1 ring-black/8">
                            {(category.subcategories || []).length} subcategories
                          </span>
                        </div>
                        {(category.subcategories || []).length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {category.subcategories.map((subcategory) => (
                              <span
                                key={subcategory.id}
                                className="rounded-full bg-white px-3 py-1 text-xs text-black/62 ring-1 ring-black/8"
                              >
                                {subcategory.subcategory_name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-black/12 bg-[#f5f5f7] px-4 py-8 text-sm text-black/56">
                      No item categories created yet.
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
