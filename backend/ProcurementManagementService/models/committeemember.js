"use strict";

const { Model } = require("sequelize");
const { COMMITTEE_MEMBER_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class CommitteeMember extends Model {
    static associate(models) {
      CommitteeMember.belongsTo(models.CommitteeMeeting, {
        foreignKey: "committee_meeting_id",
        as: "committee_meeting",
      });
    }
  }

  CommitteeMember.init(
    {
      committee_meeting_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      member_name: {
        type: DataTypes.STRING(180),
        allowNull: false,
        validate: { notEmpty: true },
      },
      designation: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      organisation_name: {
        type: DataTypes.STRING(220),
        allowNull: true,
      },
      member_group: {
        type: DataTypes.STRING(60),
        allowNull: false,
        defaultValue: "other",
      },
      payment_eligible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      payment_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      payment_status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "pending",
      },
      payment_reference: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "CommitteeMember",
      tableName: COMMITTEE_MEMBER_TABLE,
      underscored: true,
    },
  );

  return CommitteeMember;
};
