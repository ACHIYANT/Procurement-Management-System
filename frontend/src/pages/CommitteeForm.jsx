import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MinusCircle, PlusCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import FileAttachmentField from "@/components/FileAttachmentField";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FieldError from "@/components/FieldError";
import { Input } from "@/components/ui/input";
import committeeMemberMaster from "@/data/committee-member-master.json";
import { postProcurement, procurementRequest, uploadProcurementFile } from "@/lib/procurement-api";
import { buildRequiredErrors, clearFieldError, hasErrors, invalidControlClass } from "@/lib/form-validation";

const LOCATION_SCOPE = "PANCHKULA";
const MEETING_TYPE_OPTIONS = [
  { value: "specification_finalization", label: "Specification Finalization" },
  { value: "bid_opening_committee", label: "Bid Opening Committee (BOC)" },
  { value: "indent_examination_committee", label: "Indent Examination Committee (IEC)" },
  { value: "technical_committee", label: "Technical Committee" },
  { value: "technical_committee_inspection", label: "Technical Committee (Inspection)" },
  { value: "contractual_compliance_committee", label: "Contractual Compliance Committee (CCC)" },
  { value: "legal_audit_committee", label: "Committee for Legal/Audit Matters" },
  { value: "purchase_committee", label: "Purchase Committee" },
  { value: "purchase_committee_lower", label: "Purchase Committee Lower" },
  { value: "purchase_committee_upper", label: "Purchase Committee Upper" },
  { value: "dhppc", label: "DHPPC" },
  { value: "hppc", label: "HPPC" },
  { value: "other", label: "Other" },
];
const PURPOSE_OPTIONS = [
  { value: "specification_terms_conditions_issue", label: "Specification/ T&C related issue" },
  { value: "pre_opening_of_tender", label: "Pre opening of tender" },
  { value: "technical_evaluation_stage", label: "Technical Evaluation Stage" },
  { value: "final_evaluation_technical", label: "Final Evaluation (Technical)" },
  { value: "financial_evaluation_commercial", label: "Financial Evaluation (Commercial)" },
  { value: "negotiation", label: "Negotiation" },
];
const APPROVAL_FORUM_OPTIONS = [
  { value: "none", label: "None" },
  { value: "dhppc", label: "DHPPC" },
  { value: "hppc", label: "HPPC" },
];
const ONE_CRORE = 10000000;
const FIVE_CRORE = 50000000;
const MEETING_TYPE_MEMBER_GROUPS =
  committeeMemberMaster?.meetingTypeMemberGroups || {};
const STATIC_MEMBERS_BY_GROUP =
  committeeMemberMaster?.membersByGroup || {};
const MEMBER_GROUP_OPTIONS = [
  { value: "hartron_official", label: "HARTRON Official" },
  { value: "indenting_department_official", label: "Indenting Department Official" },
  { value: "technical_committee_member", label: "Technical Committee Member" },
  { value: "purchase_committee_member", label: "Purchase Committee Member" },
  { value: "negotiation_committee_member", label: "Negotiation Committee Member" },
  { value: "dhppc_member", label: "DHPPC Member" },
  { value: "hppc_member", label: "HPPC Member" },
  { value: "minister", label: "Minister" },
  { value: "chief_minister", label: "Chief Minister" },
  { value: "ias_official", label: "Senior IAS Official" },
  { value: "other", label: "Other" },
];

const newMember = () => ({
  member_name: "",
  designation: "",
  organisation_name: "",
  member_group: "hartron_official",
  payment_amount: "",
  remarks: "",
});

const newNegotiationEntry = () => ({
  firm_id: "",
  indent_item_id: "",
  negotiated_quantity: "",
  negotiated_rate: "",
  accepted_quantity: "",
  accepted_rate: "",
  accepted_for_po: false,
  rank_order: "",
  remarks: "",
});

function Field({ label, error, children }) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

const deriveApprovalForum = (meetingType, estimatedValue) => {
  if (!["dhppc", "hppc"].includes(meetingType)) return "none";
  const amount = Number(estimatedValue || 0);
  if (amount >= ONE_CRORE && amount <= FIVE_CRORE) return "dhppc";
  if (amount > FIVE_CRORE) return "hppc";
  return "none";
};
const isMeetingPaymentAllowed = (meetingType) =>
  ["technical_committee", "purchase_committee", "purchase_committee_lower", "purchase_committee_upper"].includes(meetingType);
const isMemberPaymentEligible = (meetingType, memberGroup) =>
  (meetingType === "technical_committee" &&
    memberGroup === "technical_committee_member") ||
  (["purchase_committee", "purchase_committee_lower", "purchase_committee_upper"].includes(meetingType) &&
    memberGroup === "purchase_committee_member");
const getAllowedMemberGroups = (meetingType) =>
  MEETING_TYPE_MEMBER_GROUPS[meetingType] || MEETING_TYPE_MEMBER_GROUPS.other || ["other"];
const getStaticMembersForGroup = (memberGroup) =>
  Array.isArray(STATIC_MEMBERS_BY_GROUP[memberGroup])
    ? STATIC_MEMBERS_BY_GROUP[memberGroup]
    : [];
const getStaticMemberPaymentAmount = (memberGroup, memberName) => {
  const member = getStaticMembersForGroup(memberGroup).find(
    (staticMember) =>
      String(staticMember.member_name || "") === String(memberName || ""),
  );
  return Number(member?.payment_amount_per_day || 0);
};

export default function CommitteeForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
    moveTo: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [procurementCases, setProcurementCases] = useState([]);
  const [tenders, setTenders] = useState([]);
  const [firms, setFirms] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    procurement_case_id: searchParams.get("procurementCaseId") || "",
    tender_id: searchParams.get("tenderId") || "",
    meeting_type: "technical_committee",
    purpose: "technical_evaluation_stage",
    meeting_date: "",
    meeting_time: "",
    approval_forum: "none",
    venue: "",
    agenda: "",
    agenda_document_path: "",
    proceedings_document_path: "",
    attendance_document_path: "",
    remarks: "",
    location_scope: LOCATION_SCOPE,
    members: [newMember()],
    negotiation_entries: [newNegotiationEntry()],
  });

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const [caseData, tenderData, firmData] = await Promise.all([
          procurementRequest("/procurement-cases?cursorMode=true&limit=200"),
          procurementRequest("/tenders?cursorMode=true&limit=200"),
          procurementRequest("/firms?cursorMode=true&limit=200"),
        ]);
        setProcurementCases(caseData?.rows || []);
        setTenders(tenderData?.rows || []);
        setFirms(firmData?.rows || []);
      } catch (error) {
        setPopup({ open: true, type: "error", message: error.message || "Unable to load committee masters." });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!form.procurement_case_id) {
      setItems([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await procurementRequest(`/procurement-cases/${form.procurement_case_id}`);
        setItems(Array.isArray(data?.case_items) ? data.case_items : []);
      } catch {
        setItems([]);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [form.procurement_case_id]);

  const filteredTenders = useMemo(
    () =>
      form.procurement_case_id
        ? tenders.filter((tender) => String(tender.procurement_case_id || "") === String(form.procurement_case_id))
        : tenders,
    [form.procurement_case_id, tenders],
  );

  const tendersById = useMemo(
    () =>
      new Map(
        tenders.map((tender) => [String(tender.id), tender]),
      ),
    [tenders],
  );

  const isNegotiation = ["dhppc", "hppc"].includes(form.meeting_type);
  const isPaymentMeeting = isMeetingPaymentAllowed(form.meeting_type);
  const allowedMemberGroups = useMemo(
    () => getAllowedMemberGroups(form.meeting_type),
    [form.meeting_type],
  );
  const selectedProcurementCase = useMemo(
    () =>
      procurementCases.find(
        (procurementCase) =>
          String(procurementCase.id || "") === String(form.procurement_case_id || ""),
      ) || null,
    [form.procurement_case_id, procurementCases],
  );
  const derivedApprovalForum = useMemo(
    () =>
      deriveApprovalForum(
        form.meeting_type,
        selectedProcurementCase?.estimated_value,
      ),
    [form.meeting_type, selectedProcurementCase?.estimated_value],
  );

  const updateForm = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => {
      if (field === "procurement_case_id") {
        const selectedTender = tendersById.get(String(current.tender_id || ""));
        const belongsToSelectedCase =
          selectedTender &&
          String(selectedTender.procurement_case_id || "") === String(value || "");

        return {
          ...current,
          procurement_case_id: value,
          tender_id: belongsToSelectedCase ? current.tender_id : "",
        };
      }

      if (field === "tender_id") {
        const selectedTender = tendersById.get(String(value || ""));
        return {
          ...current,
          tender_id: value,
          procurement_case_id: selectedTender?.procurement_case_id
            ? String(selectedTender.procurement_case_id)
            : current.procurement_case_id,
        };
      }

      return {
        ...current,
        [field]: value,
      };
    });
    clearFieldError(setErrors, field);
  };

  useEffect(() => {
    if (!form.tender_id) return;
    const selectedTender = tendersById.get(String(form.tender_id));
    if (!selectedTender?.procurement_case_id) return;

    if (String(form.procurement_case_id || "") !== String(selectedTender.procurement_case_id)) {
      setForm((current) => ({
        ...current,
        procurement_case_id: String(selectedTender.procurement_case_id),
      }));
    }
  }, [form.procurement_case_id, form.tender_id, tendersById]);

  useEffect(() => {
    const nextForum = derivedApprovalForum;
    if (String(form.approval_forum || "none") === String(nextForum || "none")) {
      return;
    }
    setForm((current) => ({
      ...current,
      approval_forum: nextForum,
    }));
  }, [derivedApprovalForum, form.approval_forum]);

  useEffect(() => {
    if (isPaymentMeeting) return;
    setForm((current) => ({
      ...current,
      members: current.members.map((member) => ({
        ...member,
      })),
    }));
  }, [isPaymentMeeting]);

  useEffect(() => {
    const fallbackGroup = allowedMemberGroups[0] || "other";
    setForm((current) => ({
      ...current,
      members: current.members.map((member) => {
        if (allowedMemberGroups.includes(member.member_group)) {
          return member;
        }
        const fallbackStaticMembers = getStaticMembersForGroup(fallbackGroup);
        const fallbackStaticMember = fallbackStaticMembers[0] || null;
        return {
          ...member,
          member_group: fallbackGroup,
          member_name: fallbackStaticMember?.member_name || "",
          designation: fallbackStaticMember?.designation || "",
          organisation_name: fallbackStaticMember?.organisation_name || "",
          payment_amount: fallbackStaticMember?.payment_amount_per_day
            ? String(fallbackStaticMember.payment_amount_per_day)
            : "",
        };
      }),
    }));
  }, [allowedMemberGroups]);

  const setMemberField = (index, field, value) => {
    setForm((current) => {
      const nextMembers = current.members.map((member, memberIndex) => {
        if (memberIndex !== index) return member;

        if (field === "member_group") {
          const staticMembers = getStaticMembersForGroup(value);
          const selectedStaticMember = staticMembers[0] || null;
          return {
            ...member,
            member_group: value,
            member_name: selectedStaticMember?.member_name || "",
            designation: selectedStaticMember?.designation || "",
            organisation_name: selectedStaticMember?.organisation_name || "",
            payment_amount: selectedStaticMember?.payment_amount_per_day
              ? String(selectedStaticMember.payment_amount_per_day)
              : "",
          };
        }

        if (field === "member_name") {
          const staticMembers = getStaticMembersForGroup(member.member_group);
          const selectedStaticMember =
            staticMembers.find(
              (staticMember) =>
                String(staticMember.member_name || "") === String(value || ""),
            ) || null;

          if (selectedStaticMember) {
            return {
              ...member,
              member_name: selectedStaticMember.member_name || "",
              designation: selectedStaticMember.designation || "",
              organisation_name: selectedStaticMember.organisation_name || "",
              payment_amount: selectedStaticMember.payment_amount_per_day
                ? String(selectedStaticMember.payment_amount_per_day)
                : "",
            };
          }
        }

        return { ...member, [field]: value };
      });

      return {
        ...current,
        members: nextMembers,
      };
    });
  };

  const setNegotiationField = (index, field, value) => {
    setForm((current) => ({
      ...current,
      negotiation_entries: current.negotiation_entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ),
    }));
  };

  const uploadDocument = (scope, filenameBase) => async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("filename_base", filenameBase);
    return uploadProcurementFile(`/files/upload/${scope}`, formData);
  };

  const uploadProceedings = uploadDocument(
    "committee_proceedings_document",
    `${form.meeting_type || "committee"}_${form.meeting_date || "meeting"}_proceedings`,
  );
  const uploadAttendance = uploadDocument(
    "committee_attendance_document",
    `${form.meeting_type || "committee"}_${form.meeting_date || "meeting"}_attendance`,
  );
  const uploadAgendaDocument = uploadDocument(
    "committee_agenda_document",
    `${form.meeting_type || "committee"}_${form.meeting_date || "meeting"}_agenda`,
  );

  const submit = async (event) => {
    event.preventDefault();
    const validationErrors = buildRequiredErrors(form, [
      { name: "procurement_case_id", label: "Procurement Case" },
      { name: "meeting_type", label: "Meeting Type" },
      { name: "purpose", label: "Purpose" },
      { name: "meeting_date", label: "Meeting Date" },
    ]);

    if (!form.members.some((member) => String(member.member_name || "").trim())) {
      validationErrors.members = "Add at least one member.";
    }
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSaving(true);
    try {
      const payload = {
        ...form,
        tender_id: form.tender_id || null,
        members: form.members.filter((member) => String(member.member_name || "").trim()),
        negotiation_entries: [],
      };
      const data = await postProcurement("/committees", payload);
      setPopup({
        open: true,
        type: "success",
        message: `Committee meeting created successfully.\nMeeting No.: ${data.meeting_no || "Generated"}`,
        moveTo: `/committees/${data.id}`,
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to create committee meeting.",
        moveTo: "",
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
            <div className="border-b border-white/10 px-6 py-4 md:px-8">
            <Link to="/committees" className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to committees
            </Link>
            </div>
            <div className="px-6 py-6 md:px-8 md:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">Committee Meeting</p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">Add Committee Meeting</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70 md:text-[15px]">
              Record committee rounds, meeting subject, documents, member composition, and negotiation allocation for final acceptance.
            </p>
            </div>
          </div>

          <form className="grid gap-6" onSubmit={submit} noValidate>
            <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Procurement Case" error={errors.procurement_case_id}>
                  <select className={`h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm ${invalidControlClass(errors.procurement_case_id)}`} value={form.procurement_case_id} onChange={updateForm("procurement_case_id")}>
                    <option value="">Select procurement case</option>
                    {procurementCases.map((procurementCase) => (
                      <option key={procurementCase.id} value={procurementCase.id}>
                        {procurementCase.case_no} - {procurementCase.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tender">
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.tender_id} onChange={updateForm("tender_id")}>
                    <option value="">No tender linked</option>
                    {filteredTenders.map((tender) => (
                      <option key={tender.id} value={tender.id}>
                        {tender.tender_title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Meeting Type" error={errors.meeting_type}>
                  <select className={`h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm ${invalidControlClass(errors.meeting_type)}`} value={form.meeting_type} onChange={updateForm("meeting_type")}>
                    {MEETING_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Purpose" error={errors.purpose}>
                  <select className={`h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm ${invalidControlClass(errors.purpose)}`} value={form.purpose} onChange={updateForm("purpose")}>
                    {PURPOSE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Meeting Date" error={errors.meeting_date}>
                  <Input type="date" value={form.meeting_date} onChange={updateForm("meeting_date")} className={invalidControlClass(errors.meeting_date)} />
                </Field>
                <Field label="Meeting Time">
                  <Input
                    type="time"
                    value={form.meeting_time}
                    onChange={updateForm("meeting_time")}
                    step="60"
                  />
                </Field>
                {isNegotiation ? (
                  <Field label="Approval Forum">
                    <div className="space-y-1">
                      <Input
                        value={
                          APPROVAL_FORUM_OPTIONS.find(
                            (option) => option.value === derivedApprovalForum,
                          )?.label || "None"
                        }
                        readOnly
                        disabled
                      />
                      <p className="text-xs text-slate-500">
                        {derivedApprovalForum === "dhppc"
                          ? "Cases from Rs. 1 crore to Rs. 5 crore fall under DHPPC."
                          : derivedApprovalForum === "hppc"
                            ? "Cases above Rs. 5 crore fall under HPPC."
                            : "Approval forum is not applicable here because the selected case value is below Rs. 1 crore."}
                      </p>
                    </div>
                  </Field>
                ) : null}
                <Field label="Venue">
                  <Input value={form.venue} onChange={updateForm("venue")} />
                </Field>
                <Field label="Location Scope">
                  <Input value={form.location_scope} readOnly disabled />
                </Field>
                <div className="md:col-span-2 xl:col-span-2">
                  <Field label="Meeting Subject / Title">
                    <textarea rows={3} value={form.agenda} onChange={updateForm("agenda")} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </Field>
                </div>
                <div className="md:col-span-2 xl:col-span-2">
                  <Field label="Remarks">
                    <textarea rows={3} value={form.remarks} onChange={updateForm("remarks")} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <FileAttachmentField
                    label="Agenda Document"
                    storedPath={form.agenda_document_path}
                    onChange={(value) => setForm((current) => ({ ...current, agenda_document_path: value }))}
                    onUpload={uploadAgendaDocument}
                    helperText="Upload the agenda document for this meeting."
                  />
                </div>
                <div className="md:col-span-2">
                  <FileAttachmentField
                    label="Proceedings / Minutes Document"
                    storedPath={form.proceedings_document_path}
                    onChange={(value) => setForm((current) => ({ ...current, proceedings_document_path: value }))}
                    onUpload={uploadProceedings}
                    helperText="Upload the meeting proceedings or minutes document."
                  />
                </div>
                <div className="md:col-span-2">
                  <FileAttachmentField
                    label="Attendance Document"
                    storedPath={form.attendance_document_path}
                    onChange={(value) => setForm((current) => ({ ...current, attendance_document_path: value }))}
                    onUpload={uploadAttendance}
                    helperText="Upload attendance sheet or supporting record."
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Members and Attendance</h2>
                    <p className="text-sm text-slate-500">Capture who attended the meeting and who is eligible for payment.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setForm((current) => ({ ...current, members: [...current.members, newMember()] }))}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Member
                  </Button>
                </div>
                <FieldError message={errors.members} />
                <div className="space-y-4">
                  {form.members.map((member, index) => (
                    <div key={`member-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">Member {index + 1}</p>
                        {form.members.length > 1 ? (
                          <Button type="button" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => setForm((current) => ({ ...current, members: current.members.filter((_, memberIndex) => memberIndex !== index) }))}>
                            <MinusCircle className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Field label="Member Group">
                          <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={member.member_group} onChange={(event) => setMemberField(index, "member_group", event.target.value)}>
                            {MEMBER_GROUP_OPTIONS.filter((option) =>
                              allowedMemberGroups.includes(option.value),
                            ).map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Member Name">
                          {getStaticMembersForGroup(member.member_group).length ? (
                            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={member.member_name} onChange={(event) => setMemberField(index, "member_name", event.target.value)}>
                              <option value="">Select member</option>
                              {getStaticMembersForGroup(member.member_group).map((staticMember) => (
                                <option key={`${member.member_group}-${staticMember.member_name}`} value={staticMember.member_name}>
                                  {staticMember.member_name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input value={member.member_name} onChange={(event) => setMemberField(index, "member_name", event.target.value)} />
                          )}
                        </Field>
                        <Field label="Designation">
                          <Input value={member.designation} onChange={(event) => setMemberField(index, "designation", event.target.value)} readOnly={Boolean(getStaticMembersForGroup(member.member_group).length)} />
                        </Field>
                        <Field label="Organisation">
                          <Input value={member.organisation_name} onChange={(event) => setMemberField(index, "organisation_name", event.target.value)} readOnly={Boolean(getStaticMembersForGroup(member.member_group).length)} />
                        </Field>
                        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meeting Payment</p>
                          <p className="mt-1 font-medium text-slate-800">
                            {isMemberPaymentEligible(form.meeting_type, member.member_group)
                              ? `Eligible - Rs. ${
                                  getStaticMemberPaymentAmount(
                                    member.member_group,
                                    member.member_name,
                                  ) || member.payment_amount || 0
                                } per day`
                              : "Not Eligible"}
                          </p>
                        </div>
                      </div>
                      {!isPaymentMeeting ? (
                        <p className="mt-3 text-xs text-slate-500">
                          Member payment is applicable only for Technical Committee and Purchase Committee meetings.
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" className="bg-blue-700 text-white hover:bg-blue-800" disabled={saving}>
                {saving ? "Saving..." : "Save Committee Meeting"}
              </Button>
            </div>
          </form>
        </div>
      </div>
      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        moveTo={popup.moveTo}
        onClose={() =>
          setPopup({ open: false, type: "info", message: "", moveTo: "" })
        }
      />
    </>
  );
}
