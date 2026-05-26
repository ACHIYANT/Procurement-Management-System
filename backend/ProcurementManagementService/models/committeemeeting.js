"use strict";

const { Model } = require("sequelize");
const { COMMITTEE_MEETING_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class CommitteeMeeting extends Model {
    static associate(models) {
      CommitteeMeeting.belongsTo(models.ProcurementCase, {
        foreignKey: "procurement_case_id",
        as: "procurement_case",
      });
      CommitteeMeeting.belongsTo(models.Tender, {
        foreignKey: "tender_id",
        as: "tender",
      });
      CommitteeMeeting.hasMany(models.CommitteeMember, {
        foreignKey: "committee_meeting_id",
        as: "members",
      });
      CommitteeMeeting.hasMany(models.CommitteeNegotiationEntry, {
        foreignKey: "committee_meeting_id",
        as: "negotiation_entries",
      });
    }
  }

  CommitteeMeeting.init(
    {
      procurement_case_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tender_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      meeting_no: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
      },
      meeting_type: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      purpose: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      approval_forum: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "none",
      },
      meeting_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      meeting_time: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      venue: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      agenda: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      agenda_document_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "scheduled",
      },
      proceedings_document_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      attendance_document_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      location_scope: {
        type: DataTypes.STRING(80),
        allowNull: false,
        set(value) {
          this.setDataValue("location_scope", String(value || "").trim().replace(/\s+/g, " ").toUpperCase());
        },
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "CommitteeMeeting",
      tableName: COMMITTEE_MEETING_TABLE,
      underscored: true,
    },
  );

  return CommitteeMeeting;
};
