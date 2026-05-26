"use strict";

const { buildCursorWhere, buildSortOrder } = require("../utils/procurement-domain");
const {
  CommitteeMeeting,
  CommitteeMember,
  CommitteeNegotiationEntry,
  ProcurementCase,
  Tender,
  Firm,
  Indent,
  IndentItem,
  TenderVendor,
  sequelize,
} = require("../../models");

const committeeDetailIncludes = [
  {
    model: ProcurementCase,
    as: "procurement_case",
    include: [{ model: Indent, as: "indent" }],
  },
  {
    model: Tender,
    as: "tender",
  },
  {
    model: CommitteeMember,
    as: "members",
    separate: true,
    order: [["id", "ASC"]],
  },
  {
    model: CommitteeNegotiationEntry,
    as: "negotiation_entries",
    separate: true,
    order: [["rank_order", "ASC"], ["id", "ASC"]],
    include: [
      { model: Firm, as: "firm" },
      { model: IndentItem, as: "indent_item" },
      {
        model: TenderVendor,
        as: "tender_vendor",
        include: [{ model: Firm, as: "firm" }],
      },
    ],
  },
];

class CommitteeRepository {
  async listBase({ where = {}, limit, cursor, sortBy = "id", sortDirection = "DESC" } = {}) {
    return CommitteeMeeting.findAll({
      where: buildCursorWhere({ baseWhere: where, cursor, sortBy, sortDirection }),
      include: [
        {
          model: ProcurementCase,
          as: "procurement_case",
          include: [{ model: Indent, as: "indent" }],
        },
        { model: Tender, as: "tender" },
      ],
      order: buildSortOrder(sortBy, sortDirection),
      ...(limit ? { limit } : {}),
      subQuery: false,
    });
  }

  async findByPk(id, include = committeeDetailIncludes) {
    return CommitteeMeeting.findByPk(id, { include });
  }

  async findProcurementCaseByPk(id) {
    return ProcurementCase.findByPk(id, {
      include: [{ model: Indent, as: "indent" }],
    });
  }

  async findTenderByPk(id) {
    return Tender.findByPk(id, {
      include: [{ model: ProcurementCase, as: "procurement_case", include: [{ model: Indent, as: "indent" }] }],
    });
  }

  async findIndentItemByPk(id) {
    return IndentItem.findByPk(id);
  }

  async findFirmByPk(id) {
    return Firm.findByPk(id);
  }

  async findTenderVendorByPk(id) {
    return TenderVendor.findByPk(id);
  }

  async findOneByTenderAndPurpose(tenderId, purpose) {
    return CommitteeMeeting.findOne({
      where: {
        tender_id: tenderId,
        purpose,
      },
      attributes: ["id", "meeting_no", "meeting_date"],
      order: [["id", "ASC"]],
    });
  }

  async createCommitteeMeeting(payload, options = {}) {
    return CommitteeMeeting.create(payload, options);
  }

  async bulkCreateMembers(payload, options = {}) {
    return CommitteeMember.bulkCreate(payload, options);
  }

  async bulkCreateNegotiationEntries(payload, options = {}) {
    return CommitteeNegotiationEntry.bulkCreate(payload, options);
  }

  async findMembersByMeetingIds(meetingIds = []) {
    return CommitteeMember.findAll({
      where: { committee_meeting_id: meetingIds },
      order: [
        ["committee_meeting_id", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async findNegotiationEntriesByMeetingIds(meetingIds = []) {
    return CommitteeNegotiationEntry.findAll({
      where: { committee_meeting_id: meetingIds },
      include: [{ model: Firm, as: "firm" }, { model: IndentItem, as: "indent_item" }],
      order: [
        ["committee_meeting_id", "ASC"],
        ["rank_order", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async findMemberAttendance(where = {}, meetingWhere = {}) {
    return CommitteeMember.findAll({
      where,
      include: [
        {
          model: CommitteeMeeting,
          as: "committee_meeting",
          ...(Object.keys(meetingWhere || {}).length ? { where: meetingWhere } : {}),
          include: [
            {
              model: ProcurementCase,
              as: "procurement_case",
              include: [{ model: Indent, as: "indent" }],
            },
            { model: Tender, as: "tender" },
          ],
        },
      ],
      order: [
        ["member_name", "ASC"],
        [{ model: CommitteeMeeting, as: "committee_meeting" }, "meeting_date", "DESC"],
        ["id", "DESC"],
      ],
    });
  }

  async withTransaction(callback) {
    return sequelize.transaction(callback);
  }
}

module.exports = {
  CommitteeRepository,
  committeeDetailIncludes,
};
