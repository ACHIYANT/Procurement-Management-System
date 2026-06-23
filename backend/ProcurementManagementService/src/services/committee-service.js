"use strict";

const { Op } = require("sequelize");
const path = require("path");
const { CommitteeRepository } = require("../repository/committee-repository");
const { ProcurementCaseRepository } = require("../repository/procurement-case-repository");
const {
  asAmountNumber,
  asId,
  buildCursorResponse,
  isCursorMode,
  normalizeAmount,
  normalizeCursor,
  normalizeDate,
  normalizeLimit,
  normalizeSortBy,
  normalizeSortDirection,
  normalizeNullableText,
  normalizeText,
  notFound,
  requireValue,
} = require("../utils/procurement-domain");
const committeeMemberMaster = require(path.resolve(
  __dirname,
  "../../../../frontend/src/data/committee-member-master.json",
));
const COMMITTEE_SORT_FIELDS = [
  "id",
  "meeting_no",
  "meeting_type",
  "purpose",
  "meeting_date",
  "meeting_time",
  "approval_forum",
  "venue",
];

const MEETING_TYPES = new Set([
  "specification_finalization",
  "bid_opening_committee",
  "indent_examination_committee",
  "technical_committee",
  "technical_committee_inspection",
  "contractual_compliance_committee",
  "legal_audit_committee",
  "purchase_committee",
  "purchase_committee_lower",
  "purchase_committee_upper",
  "dhppc",
  "hppc",
  "other",
]);
const MEETING_PURPOSES = new Set([
  "specification_terms_conditions_issue",
  "pre_opening_of_tender",
  "technical_evaluation_stage",
  "final_evaluation_technical",
  "financial_evaluation_commercial",
  "negotiation",
]);

const APPROVAL_FORUMS = new Set(["none", "dhppc", "hppc"]);
const MEMBER_GROUPS = new Set([
  "hartron_official",
  "indenting_department_official",
  "technical_committee_member",
  "purchase_committee_member",
  "negotiation_committee_member",
  "dhppc_member",
  "hppc_member",
  "minister",
  "chief_minister",
  "ias_official",
  "other",
]);
const PAYMENT_STATUSES = new Set(["pending", "processed", "not_applicable"]);
const ONE_CRORE = 10000000;
const FIVE_CRORE = 50000000;
const ONE_TIME_TENDER_PURPOSES = new Set([
  "final_evaluation_technical",
  "financial_evaluation_commercial",
]);

const MEETING_PREFIX_BY_PURPOSE = {
  technical_evaluation_stage: "TCM",
  final_evaluation_technical: "TCM",
  financial_evaluation_commercial: "PCM",
  negotiation: "NCM",
  pre_opening_of_tender: "BOC",
  specification_terms_conditions_issue: "SCM",
};

const MEETING_PREFIX_BY_TYPE = {
  specification_finalization: "SCM",
  bid_opening_committee: "BOC",
  indent_examination_committee: "IEC",
  technical_committee: "TCM",
  technical_committee_inspection: "TCM",
  contractual_compliance_committee: "CCC",
  legal_audit_committee: "LAC",
  purchase_committee: "PCM",
  purchase_committee_lower: "PCM",
  purchase_committee_upper: "PCM",
  dhppc: "DHPPC",
  hppc: "HPPC",
};

const getCommitteeMeetingPrefix = (meetingType, purpose) =>
  MEETING_PREFIX_BY_PURPOSE[purpose] ||
  MEETING_PREFIX_BY_TYPE[meetingType] ||
  "CM";

const buildCommitteeMeetingNo = (id, { meetingType, purpose } = {}) =>
  `${getCommitteeMeetingPrefix(meetingType, purpose)}-${String(id).padStart(6, "0")}`;

const assertAllowed = (value, allowed, label) => {
  if (value && !allowed.has(value)) {
    const error = new Error(`${label} is invalid.`);
    error.statusCode = 400;
    throw error;
  }
};

const toList = (value) => (Array.isArray(value) ? value : []);

const deriveApprovalForum = (meetingType, estimatedValue) => {
  if (!["dhppc", "hppc"].includes(meetingType)) return "none";
  const amount = asAmountNumber(estimatedValue);
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
const getStaticMembersForGroup = (memberGroup) =>
  Array.isArray(committeeMemberMaster?.membersByGroup?.[memberGroup])
    ? committeeMemberMaster.membersByGroup[memberGroup]
    : [];
const getMemberPaymentAmount = (memberGroup, memberName) => {
  const member = getStaticMembersForGroup(memberGroup).find(
    (staticMember) =>
      String(staticMember.member_name || "") === String(memberName || ""),
  );
  return normalizeAmount(member?.payment_amount_per_day || 0);
};

class CommitteeService {
  constructor() {
    this.repository = new CommitteeRepository();
    this.procurementCaseRepository = new ProcurementCaseRepository();
  }

  decorateMeeting(meeting) {
    if (!meeting) return meeting;
    const target = meeting.dataValues || meeting;
    const members = Array.isArray(target.members || meeting.members) ? target.members || meeting.members : [];
    const negotiationEntries =
      Array.isArray(target.negotiation_entries || meeting.negotiation_entries)
        ? target.negotiation_entries || meeting.negotiation_entries
        : [];

    target.member_count = members.length;
    target.payment_eligible_member_count = members.filter((member) => member?.payment_eligible).length;
    target.payment_amount_total = Number(
      members.reduce((sum, member) => sum + asAmountNumber(member?.payment_amount), 0).toFixed(2),
    );
    target.negotiation_entry_count = negotiationEntries.length;
    target.accepted_negotiation_count = negotiationEntries.filter((entry) => entry?.accepted_for_po).length;
    target.negotiated_value_total = Number(
      negotiationEntries.reduce(
        (sum, entry) =>
          sum +
          (asAmountNumber(entry?.accepted_quantity || entry?.negotiated_quantity) *
            asAmountNumber(entry?.accepted_rate || entry?.negotiated_rate)),
        0,
      ).toFixed(2),
    );
    return meeting;
  }

  async decorateMeetingListRows(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return list;

    const ids = list.map((row) => row?.id).filter(Boolean);
    const [members, negotiationEntries] = await Promise.all([
      this.repository.findMembersByMeetingIds(ids),
      this.repository.findNegotiationEntriesByMeetingIds(ids),
    ]);

    const membersByMeetingId = new Map();
    for (const member of members || []) {
      const meetingId = Number(member?.committee_meeting_id);
      if (!membersByMeetingId.has(meetingId)) membersByMeetingId.set(meetingId, []);
      membersByMeetingId.get(meetingId).push(member);
    }

    const entriesByMeetingId = new Map();
    for (const entry of negotiationEntries || []) {
      const meetingId = Number(entry?.committee_meeting_id);
      if (!entriesByMeetingId.has(meetingId)) entriesByMeetingId.set(meetingId, []);
      entriesByMeetingId.get(meetingId).push(entry);
    }

    return list.map((row) => {
      const meeting = typeof row?.toJSON === "function" ? row.toJSON() : { ...row };
      const id = Number(meeting.id);
      meeting.members = membersByMeetingId.get(id) || [];
      meeting.negotiation_entries = entriesByMeetingId.get(id) || [];
      return this.decorateMeeting(meeting);
    });
  }

  async list(query = {}) {
    const search = normalizeText(query.search);
    const where = {};

    if (search) {
      where[Op.or] = [
        { meeting_no: { [Op.like]: `%${search}%` } },
        { meeting_type: { [Op.like]: `%${search}%` } },
        { approval_forum: { [Op.like]: `%${search}%` } },
        { "$procurement_case.case_no$": { [Op.like]: `%${search}%` } },
        { "$tender.tender_title$": { [Op.like]: `%${search}%` } },
      ];
    }

    if (query.procurement_case_id) where.procurement_case_id = asId(query.procurement_case_id, "Procurement case");
    if (query.tender_id) where.tender_id = asId(query.tender_id, "Tender");
    if (query.meeting_type) where.meeting_type = normalizeText(query.meeting_type);

    const sortBy = normalizeSortBy(query.sortBy || query.sort_by, COMMITTEE_SORT_FIELDS, "id");
    const sortDirection = normalizeSortDirection(query.sortDir || query.sort_dir, "DESC");

    if (isCursorMode(query)) {
      const limit = normalizeLimit(query.limit);
      const cursor = normalizeCursor(query.cursor);
      const rows = await this.repository.listBase({
        where,
        limit: limit + 1,
        cursor,
        sortBy,
        sortDirection,
      });
      const response = buildCursorResponse(rows, limit, { sortBy, sortDirection });
      response.rows = await this.decorateMeetingListRows(response.rows);
      return response;
    }

    return this.decorateMeetingListRows(
      await this.repository.listBase({ where, limit: 100, sortBy, sortDirection }),
    );
  }

  async getById(id) {
    const meeting = await this.repository.findByPk(asId(id, "Committee meeting"));
    if (!meeting) throw notFound("Committee meeting not found.");
    return this.decorateMeeting(meeting);
  }

  normalizeMembers(members = [], meetingType = "") {
    return toList(members).map((member, index) => {
      const memberName = requireValue(member, "member_name", `Member name at row ${index + 1}`);
      const memberGroup = normalizeText(member.member_group) || "other";
      const paymentStatus = normalizeText(member.payment_status) || "pending";
      const paymentEligible = isMemberPaymentEligible(meetingType, memberGroup);
      const paymentAmount = paymentEligible
        ? getMemberPaymentAmount(memberGroup, memberName)
        : null;

      assertAllowed(memberGroup, MEMBER_GROUPS, "Member group");
      assertAllowed(paymentStatus, PAYMENT_STATUSES, "Payment status");

      return {
        member_name: memberName,
        designation: normalizeNullableText(member.designation),
        organisation_name: normalizeNullableText(member.organisation_name),
        member_group: memberGroup,
        payment_eligible: paymentEligible,
        payment_amount: paymentEligible ? paymentAmount : null,
        payment_status: paymentEligible ? paymentStatus : "not_applicable",
        payment_reference: null,
        remarks: normalizeNullableText(member.remarks),
      };
    });
  }

  async normalizeNegotiationEntries(entries = [], meetingPayload = {}) {
    const meetingType = normalizeText(meetingPayload.meeting_type);
    return Promise.all(
      toList(entries).map(async (entry, index) => {
        if (!["dhppc", "hppc"].includes(meetingType)) return null;

        const firmId = asId(entry.firm_id, `Negotiation firm at row ${index + 1}`);
        const firm = await this.repository.findFirmByPk(firmId);
        if (!firm) throw notFound(`Negotiation firm not found at row ${index + 1}.`);

        const indentItemId = entry.indent_item_id ? asId(entry.indent_item_id, `Indent item at row ${index + 1}`) : null;
        if (indentItemId) {
          const indentItem = await this.repository.findIndentItemByPk(indentItemId);
          if (!indentItem) throw notFound(`Indent item not found at row ${index + 1}.`);
        }

        const tenderVendorId = entry.tender_vendor_id ? asId(entry.tender_vendor_id, `Tender vendor at row ${index + 1}`) : null;
        if (tenderVendorId) {
          const tenderVendor = await this.repository.findTenderVendorByPk(tenderVendorId);
          if (!tenderVendor) throw notFound(`Tender vendor not found at row ${index + 1}.`);
        }

        return {
          firm_id: firmId,
          tender_vendor_id: tenderVendorId,
          indent_item_id: indentItemId,
          negotiated_quantity:
            entry.negotiated_quantity === "" || entry.negotiated_quantity === undefined || entry.negotiated_quantity === null
              ? null
              : normalizeAmount(entry.negotiated_quantity),
          negotiated_rate:
            entry.negotiated_rate === "" || entry.negotiated_rate === undefined || entry.negotiated_rate === null
              ? null
              : normalizeAmount(entry.negotiated_rate),
          accepted_quantity:
            entry.accepted_quantity === "" || entry.accepted_quantity === undefined || entry.accepted_quantity === null
              ? null
              : normalizeAmount(entry.accepted_quantity),
          accepted_rate:
            entry.accepted_rate === "" || entry.accepted_rate === undefined || entry.accepted_rate === null
              ? null
              : normalizeAmount(entry.accepted_rate),
          accepted_for_po: Boolean(entry.accepted_for_po),
          rank_order: entry.rank_order ? Number(entry.rank_order) : null,
          remarks: normalizeNullableText(entry.remarks),
        };
      }),
    ).then((rows) => rows.filter(Boolean));
  }

  async create(payload = {}) {
    const meetingType = requireValue(payload, "meeting_type", "Meeting type");
    const purpose = normalizeText(payload.purpose);
    const procurementCaseId = asId(payload.procurement_case_id, "Procurement case");
    const tenderId = payload.tender_id ? asId(payload.tender_id, "Tender") : null;
    assertAllowed(meetingType, MEETING_TYPES, "Meeting type");
    assertAllowed(purpose, MEETING_PURPOSES, "Purpose");

    const [procurementCase, tender] = await Promise.all([
      this.repository.findProcurementCaseByPk(procurementCaseId),
      tenderId ? this.repository.findTenderByPk(tenderId) : Promise.resolve(null),
    ]);

    if (!procurementCase) throw notFound("Procurement case not found.");
    if (tenderId && !tender) throw notFound("Tender not found.");
    if (tender && Number(tender.procurement_case_id) !== procurementCaseId) {
      const error = new Error("Tender must belong to the selected procurement case.");
      error.statusCode = 409;
      throw error;
    }
    if (ONE_TIME_TENDER_PURPOSES.has(purpose)) {
      if (!tenderId) {
        const error = new Error(
          "This meeting purpose must be linked with a tender.",
        );
        error.statusCode = 400;
        throw error;
      }
      const existing = await this.repository.findOneByTenderAndPurpose(
        tenderId,
        purpose,
      );
      if (existing) {
        const error = new Error(
          `${purpose === "final_evaluation_technical" ? "Final Evaluation (Technical)" : "Financial Evaluation (Commercial)"} meeting is already recorded for this tender.`,
        );
        error.statusCode = 409;
        throw error;
      }
    }

    const approvalForum = deriveApprovalForum(
      meetingType,
      procurementCase?.estimated_value,
    );
    assertAllowed(approvalForum, APPROVAL_FORUMS, "Approval forum");

    const members = this.normalizeMembers(payload.members || [], meetingType);
    const negotiationEntries = await this.normalizeNegotiationEntries(payload.negotiation_entries || [], { meeting_type: meetingType });

    const created = await this.repository.withTransaction(async (transaction) => {
      const meeting = await this.repository.createCommitteeMeeting(
        {
          procurement_case_id: procurementCaseId,
          tender_id: tenderId,
          meeting_no: `PENDING-${getCommitteeMeetingPrefix(meetingType, purpose)}-${Date.now()}`,
          meeting_type: meetingType,
          purpose: purpose || null,
          approval_forum: approvalForum,
          meeting_date: normalizeDate(payload.meeting_date),
          meeting_time: normalizeNullableText(payload.meeting_time),
          venue: normalizeNullableText(payload.venue),
          agenda: normalizeNullableText(payload.agenda),
          agenda_document_path: normalizeNullableText(payload.agenda_document_path),
          status: normalizeText(payload.status) || "scheduled",
          proceedings_document_path: normalizeNullableText(payload.proceedings_document_path),
          attendance_document_path: normalizeNullableText(payload.attendance_document_path),
          remarks: normalizeNullableText(payload.remarks),
          location_scope: requireValue(payload, "location_scope", "Location scope"),
        },
        { transaction },
      );

      await meeting.update(
        { meeting_no: buildCommitteeMeetingNo(meeting.id, { meetingType, purpose }) },
        { transaction },
      );

      if (members.length) {
        await this.repository.bulkCreateMembers(
          members.map((member) => ({
            ...member,
            committee_meeting_id: meeting.id,
          })),
          { transaction },
        );
      }

      if (negotiationEntries.length) {
        await this.repository.bulkCreateNegotiationEntries(
          negotiationEntries.map((entry) => ({
            ...entry,
            committee_meeting_id: meeting.id,
          })),
          { transaction },
        );
      }

      const caseStillActive = await this.procurementCaseRepository.findProcurementCaseByPk(procurementCaseId, {
        transaction,
      });
      if (caseStillActive?.status === "tender_created") {
        await this.procurementCaseRepository.updateProcurementCaseStatusIfAllowed(
          procurementCaseId,
          "under_process",
          ["tender_created"],
          { transaction },
        );
      }

      return meeting;
    });

    return this.getById(created.id);
  }

  async memberAttendanceReport(query = {}) {
    const search = normalizeText(query.search);
    const where = {
      member_group: {
        [Op.in]: ["technical_committee_member", "purchase_committee_member"],
      },
    };
    const meetingWhere = {};

    if (search) {
      where[Op.or] = [
        { member_name: { [Op.like]: `%${search}%` } },
        { designation: { [Op.like]: `%${search}%` } },
        { organisation_name: { [Op.like]: `%${search}%` } },
      ];
    }
    const dateFrom = query.date_from ? normalizeDate(query.date_from) : null;
    const dateTo = query.date_to ? normalizeDate(query.date_to) : null;
    if (dateFrom && dateTo) {
      meetingWhere.meeting_date = { [Op.between]: [dateFrom, dateTo] };
    } else if (dateFrom) {
      meetingWhere.meeting_date = { [Op.gte]: dateFrom };
    } else if (dateTo) {
      meetingWhere.meeting_date = { [Op.lte]: dateTo };
    }

    const rows = await this.repository.findMemberAttendance(where, meetingWhere);
    const grouped = new Map();

    for (const row of rows) {
      const key = [
        String(row?.member_name || "").trim().toLowerCase(),
        String(row?.designation || "").trim().toLowerCase(),
        String(row?.organisation_name || "").trim().toLowerCase(),
      ].join("|");

      if (!grouped.has(key)) {
        grouped.set(key, {
          member_name: row?.member_name || "NA",
          designation: row?.designation || "NA",
          organisation_name: row?.organisation_name || "NA",
          member_group: row?.member_group || "other",
          attendance_count: 0,
          meeting_day_count: 0,
          payment_eligible_count: 0,
          payment_day_count: 0,
          payment_amount_total: 0,
          meetings: [],
          _meetingDates: new Set(),
          _paymentDates: new Set(),
        });
      }

      const bucket = grouped.get(key);
      const meetingDate = row?.committee_meeting?.meeting_date || "NA";
      const meetingType = row?.committee_meeting?.meeting_type || "NA";
      const paymentEligibleForDay =
        Boolean(row?.payment_eligible) && isMeetingPaymentAllowed(meetingType);

      bucket.attendance_count += 1;
      if (row?.payment_eligible) bucket.payment_eligible_count += 1;
      bucket._meetingDates.add(meetingDate);
      if (paymentEligibleForDay) bucket._paymentDates.add(meetingDate);
      bucket.meetings.push({
        committee_meeting_id: row?.committee_meeting_id,
        meeting_no: row?.committee_meeting?.meeting_no || "NA",
        meeting_type: meetingType,
        meeting_date: meetingDate,
        payment_amount: paymentEligibleForDay ? asAmountNumber(row?.payment_amount) : 0,
        payment_status: row?.payment_status || "NA",
        payment_counted_for_day: false,
        procurement_case_no: row?.committee_meeting?.procurement_case?.case_no || "NA",
        indent_no: row?.committee_meeting?.procurement_case?.indent?.indent_no || "NA",
        tender_title: row?.committee_meeting?.tender?.tender_title || "NA",
      });
    }

    return Array.from(grouped.values()).map((entry) => {
      const countedPaymentDates = new Set();
      const meetings = entry.meetings.map((meeting) => {
        const shouldCount =
          meeting.payment_amount > 0 &&
          !countedPaymentDates.has(meeting.meeting_date);
        if (shouldCount) countedPaymentDates.add(meeting.meeting_date);
        return {
          ...meeting,
          payment_counted_for_day: shouldCount,
        };
      });

      const paymentAmountTotal = meetings.reduce(
        (sum, meeting) =>
          sum + (meeting.payment_counted_for_day ? asAmountNumber(meeting.payment_amount) : 0),
        0,
      );

      return {
        member_name: entry.member_name,
        designation: entry.designation,
        organisation_name: entry.organisation_name,
        member_group: entry.member_group,
        attendance_count: entry.attendance_count,
        meeting_day_count: entry._meetingDates.size,
        payment_eligible_count: entry.payment_eligible_count,
        payment_day_count: entry._paymentDates.size,
        payment_amount_total: Number(paymentAmountTotal.toFixed(2)),
        meetings,
      };
    });
  }
}

module.exports = CommitteeService;
