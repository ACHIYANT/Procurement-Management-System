import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import FieldError from "@/components/FieldError";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { postProcurement } from "@/lib/procurement-api";
import {
  buildRequiredErrors,
  clearFieldError,
  hasErrors,
  invalidControlClass,
} from "@/lib/form-validation";

const createBlankAddress = () => ({
  address_type: "office",
  address_line_1: "",
  address_line_2: "",
  district: "",
  city: "",
  state: "",
  country: "India",
  pin_code: "",
  landmark: "",
  is_primary: true,
});

const createBlankContact = () => ({
  contact_person_name: "",
  designation: "",
  contact_type: "mobile",
  contact_value: "",
  is_primary: true,
  remarks: "",
});

const initialForm = {
  firm_name: "",
  vendor_category: "general",
  vendor_type: "",
  gst_no: "",
  pan_no: "",
  msme_no: "",
  msme_state: "",
  is_active: true,
  remarks: "",
  addresses: [createBlankAddress()],
  contacts: [createBlankContact()],
};

const vendorTypeOptions = [
  "manufacturer",
  "authorized_distributor",
  "dealer",
  "service_provider",
  "contractor",
  "msme_vendor",
  "startup_vendor",
  "other",
];

const hasAddressValue = (address = {}) =>
  [
    address.address_line_1,
    address.address_line_2,
    address.district,
    address.city,
    address.state,
    address.country,
    address.pin_code,
    address.landmark,
  ].some((value) => String(value || "").trim());

const hasContactValue = (contact = {}) =>
  [contact.contact_person_name, contact.designation, contact.contact_value, contact.remarks].some((value) =>
    String(value || "").trim(),
  );

const hasNestedErrors = (rows = []) =>
  rows.some((row) => row && typeof row === "object" && Object.keys(row).length > 0);

const getNestedError = (rows, index, field) => rows?.[index]?.[field];
const isMsmeFirmType = (value) => value === "msme_vendor";

function SectionHeading({ title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function Field({ label, children, error }) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

export default function FirmForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  const update = (field) => (event) => {
    const value = field === "is_active" ? event.target.value === "true" : event.target.value;
    setForm((current) => {
      if (field !== "vendor_type") {
        return { ...current, [field]: value };
      }

      const next = { ...current, [field]: value };
      if (!isMsmeFirmType(value)) {
        next.msme_no = "";
        next.msme_state = "";
      }
      return next;
    });
    clearFieldError(setErrors, field);
    if (field === "vendor_type" && !isMsmeFirmType(value)) {
      clearFieldError(setErrors, "msme_no");
      clearFieldError(setErrors, "msme_state");
    }
  };

  const updateAddress = (index, field) => (event) => {
    const value = field === "is_primary" ? event.target.checked : event.target.value;
    setForm((current) => {
      const addresses = current.addresses.map((address, addressIndex) => {
        if (addressIndex !== index) {
          return field === "is_primary" ? { ...address, is_primary: false } : address;
        }
        return { ...address, [field]: value };
      });
      return { ...current, addresses };
    });
    setErrors((current) => {
      const next = { ...current };
      if (Array.isArray(next.addresses) && next.addresses[index]) {
        next.addresses = [...next.addresses];
        next.addresses[index] = { ...next.addresses[index] };
        delete next.addresses[index][field];
      }
      return next;
    });
  };

  const updateContact = (index, field) => (event) => {
    const value = field === "is_primary" ? event.target.checked : event.target.value;
    setForm((current) => {
      const contacts = current.contacts.map((contact, contactIndex) => {
        if (contactIndex !== index) {
          return field === "is_primary" ? { ...contact, is_primary: false } : contact;
        }
        return { ...contact, [field]: value };
      });
      return { ...current, contacts };
    });
    setErrors((current) => {
      const next = { ...current };
      if (Array.isArray(next.contacts) && next.contacts[index]) {
        next.contacts = [...next.contacts];
        next.contacts[index] = { ...next.contacts[index] };
        delete next.contacts[index][field];
      }
      return next;
    });
  };

  const addAddress = () => {
    setForm((current) => ({
      ...current,
      addresses: [...current.addresses, { ...createBlankAddress(), is_primary: current.addresses.length === 0 }],
    }));
  };

  const addContact = () => {
    setForm((current) => ({
      ...current,
      contacts: [...current.contacts, { ...createBlankContact(), is_primary: current.contacts.length === 0 }],
    }));
  };

  const removeAddress = (index) => () => {
    setForm((current) => {
      const addresses = current.addresses.filter((_, addressIndex) => addressIndex !== index);
      if (!addresses.length) return { ...current, addresses: [createBlankAddress()] };
      if (!addresses.some((address) => address.is_primary)) addresses[0].is_primary = true;
      return { ...current, addresses };
    });
  };

  const removeContact = (index) => () => {
    setForm((current) => {
      const contacts = current.contacts.filter((_, contactIndex) => contactIndex !== index);
      if (!contacts.length) return { ...current, contacts: [createBlankContact()] };
      if (!contacts.some((contact) => contact.is_primary)) contacts[0].is_primary = true;
      return { ...current, contacts };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const fieldErrors = buildRequiredErrors(form, [{ name: "firm_name", label: "Firm name" }]);
    const addressErrors = form.addresses.map((address) => {
        if (!hasAddressValue(address)) return {};
        return buildRequiredErrors(address, [
          { name: "address_line_1", label: "Address line 1" },
          { name: "city", label: "City" },
          { name: "state", label: "State" },
        ]);
      });
    const contactErrors = form.contacts.map((contact) => {
        if (!hasContactValue(contact)) return {};
        return buildRequiredErrors(contact, [
          { name: "contact_person_name", label: "Contact person" },
          { name: "contact_value", label: "Contact value" },
        ]);
      });
    const validationErrors = {
      ...fieldErrors,
      addresses: addressErrors,
      contacts: contactErrors,
    };

    setErrors(validationErrors);
    if (hasErrors(fieldErrors) || hasNestedErrors(addressErrors) || hasNestedErrors(contactErrors)) {
      return;
    }

    setSaving(true);
    try {
      await postProcurement("/firms", form);
      navigate("/firms", { replace: true });
    } catch (submitError) {
      setPopup({ open: true, type: "error", message: submitError.message || "Unable to save firm." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="min-h-full bg-[#f5f5f7] px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-4">
            <Link to="/firms" className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to firms
            </Link>
            </div>
            <div className="px-6 py-6 md:px-8 md:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
              Procurement Management System
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">Add Firm</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70 md:text-[15px]">
              Create a reusable firm master with multiple addresses and contact persons. Firm code will be generated automatically.
            </p>
            </div>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="space-y-6">
              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <div className="grid gap-3 lg:grid-cols-4">
                  <Field label="Firm Name" error={errors.firm_name}>
                    <Input
                      value={form.firm_name}
                      onChange={update("firm_name")}
                      placeholder="Firm name"
                      aria-invalid={Boolean(errors.firm_name)}
                      className={invalidControlClass(errors.firm_name)}
                    />
                  </Field>
                  <Field label="Firm Category">
                    <select
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={form.vendor_category}
                      onChange={update("vendor_category")}
                    >
                      <option value="general">General</option>
                      <option value="goods">Goods</option>
                      <option value="services">Services</option>
                      <option value="works">Works</option>
                    </select>
                  </Field>
                  <Field label="Firm Type">
                    <select
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={form.vendor_type}
                      onChange={update("vendor_type")}
                    >
                      <option value="">Select firm type</option>
                      {vendorTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="GST No.">
                    <Input value={form.gst_no} onChange={update("gst_no")} placeholder="GST No." />
                  </Field>
                  <Field label="PAN No.">
                    <Input value={form.pan_no} onChange={update("pan_no")} placeholder="PAN No." />
                  </Field>
                  {isMsmeFirmType(form.vendor_type) ? (
                    <>
                      <Field label="MSME No.">
                        <Input value={form.msme_no} onChange={update("msme_no")} placeholder="MSME No." />
                      </Field>
                      <Field label="MSME State">
                        <Input value={form.msme_state} onChange={update("msme_state")} placeholder="MSME State" />
                      </Field>
                    </>
                  ) : null}
                  <Field label="Remarks">
                    <Input value={form.remarks} onChange={update("remarks")} placeholder="Internal remarks" />
                  </Field>
                  <Field label="Status">
                    <select
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={String(form.is_active)}
                      onChange={update("is_active")}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </Field>
                </div>

                <div className="space-y-4">
                  <SectionHeading
                    title="Addresses"
                    subtitle="Add one or more office, billing, or correspondence addresses for the same firm."
                    action={
                      <Button type="button" variant="outline" className="gap-2" onClick={addAddress}>
                        <Plus className="h-4 w-4" />
                        Add Address
                      </Button>
                    }
                  />
                  <div className="space-y-4">
                    {form.addresses.map((address, index) => (
                      <div key={`address-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">Address {index + 1}</p>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                              <input
                                type="checkbox"
                                checked={Boolean(address.is_primary)}
                                onChange={updateAddress(index, "is_primary")}
                                className="h-4 w-4 rounded border-slate-300 text-blue-700"
                              />
                              Primary
                            </label>
                            <Button type="button" variant="ghost" size="sm" className="gap-2 text-rose-600" onClick={removeAddress(index)}>
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-4">
                          <Field label="Address Type">
                            <select
                              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                              value={address.address_type}
                              onChange={updateAddress(index, "address_type")}
                            >
                              <option value="office">Office</option>
                              <option value="billing">Billing</option>
                              <option value="correspondence">Correspondence</option>
                              <option value="branch">Branch</option>
                            </select>
                          </Field>
                          <Field label="Address Line 1" error={getNestedError(errors.addresses, index, "address_line_1")}>
                            <Input
                              value={address.address_line_1}
                              onChange={updateAddress(index, "address_line_1")}
                              aria-invalid={Boolean(getNestedError(errors.addresses, index, "address_line_1"))}
                              className={invalidControlClass(getNestedError(errors.addresses, index, "address_line_1"))}
                            />
                          </Field>
                          <Field label="Address Line 2">
                            <Input value={address.address_line_2} onChange={updateAddress(index, "address_line_2")} />
                          </Field>
                          <Field label="District">
                            <Input value={address.district} onChange={updateAddress(index, "district")} />
                          </Field>
                          <Field label="City" error={getNestedError(errors.addresses, index, "city")}>
                            <Input
                              value={address.city}
                              onChange={updateAddress(index, "city")}
                              aria-invalid={Boolean(getNestedError(errors.addresses, index, "city"))}
                              className={invalidControlClass(getNestedError(errors.addresses, index, "city"))}
                            />
                          </Field>
                          <Field label="State" error={getNestedError(errors.addresses, index, "state")}>
                            <Input
                              value={address.state}
                              onChange={updateAddress(index, "state")}
                              aria-invalid={Boolean(getNestedError(errors.addresses, index, "state"))}
                              className={invalidControlClass(getNestedError(errors.addresses, index, "state"))}
                            />
                          </Field>
                          <Field label="Country">
                            <Input value={address.country} onChange={updateAddress(index, "country")} />
                          </Field>
                          <Field label="PIN Code">
                            <Input value={address.pin_code} onChange={updateAddress(index, "pin_code")} />
                          </Field>
                          <Field label="Landmark">
                            <Input value={address.landmark} onChange={updateAddress(index, "landmark")} />
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <SectionHeading
                    title="Contact Persons"
                    subtitle="Store multiple contact persons, numbers, emails, and designations under the same firm."
                    action={
                      <Button type="button" variant="outline" className="gap-2" onClick={addContact}>
                        <Plus className="h-4 w-4" />
                        Add Contact
                      </Button>
                    }
                  />
                  <div className="space-y-4">
                    {form.contacts.map((contact, index) => (
                      <div key={`contact-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">Contact {index + 1}</p>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                              <input
                                type="checkbox"
                                checked={Boolean(contact.is_primary)}
                                onChange={updateContact(index, "is_primary")}
                                className="h-4 w-4 rounded border-slate-300 text-blue-700"
                              />
                              Primary
                            </label>
                            <Button type="button" variant="ghost" size="sm" className="gap-2 text-rose-600" onClick={removeContact(index)}>
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-4">
                          <Field label="Contact Person" error={getNestedError(errors.contacts, index, "contact_person_name")}>
                            <Input
                              value={contact.contact_person_name}
                              onChange={updateContact(index, "contact_person_name")}
                              aria-invalid={Boolean(getNestedError(errors.contacts, index, "contact_person_name"))}
                              className={invalidControlClass(getNestedError(errors.contacts, index, "contact_person_name"))}
                            />
                          </Field>
                          <Field label="Designation">
                            <Input value={contact.designation} onChange={updateContact(index, "designation")} />
                          </Field>
                          <Field label="Contact Type">
                            <select
                              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                              value={contact.contact_type}
                              onChange={updateContact(index, "contact_type")}
                            >
                              <option value="mobile">Mobile</option>
                              <option value="phone">Phone</option>
                              <option value="email">Email</option>
                              <option value="whatsapp">WhatsApp</option>
                            </select>
                          </Field>
                          <Field label="Contact Value" error={getNestedError(errors.contacts, index, "contact_value")}>
                            <Input
                              value={contact.contact_value}
                              onChange={updateContact(index, "contact_value")}
                              aria-invalid={Boolean(getNestedError(errors.contacts, index, "contact_value"))}
                              className={invalidControlClass(getNestedError(errors.contacts, index, "contact_value"))}
                            />
                          </Field>
                          <Field label="Remarks">
                            <Input value={contact.remarks} onChange={updateContact(index, "remarks")} />
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="bg-blue-700 text-white hover:bg-blue-800" disabled={saving}>
                  {saving ? "Saving..." : "Save Firm"}
                </Button>
              </form>
            </CardContent>
          </Card>
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
