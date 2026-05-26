"use strict";

const { Model } = require("sequelize");
const { COMMITTEE_NEGOTIATION_ENTRY_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class CommitteeNegotiationEntry extends Model {
    static associate(models) {
      CommitteeNegotiationEntry.belongsTo(models.CommitteeMeeting, {
        foreignKey: "committee_meeting_id",
        as: "committee_meeting",
      });
      CommitteeNegotiationEntry.belongsTo(models.Firm, {
        foreignKey: "firm_id",
        as: "firm",
      });
      CommitteeNegotiationEntry.belongsTo(models.TenderVendor, {
        foreignKey: "tender_vendor_id",
        as: "tender_vendor",
      });
      CommitteeNegotiationEntry.belongsTo(models.IndentItem, {
        foreignKey: "indent_item_id",
        as: "indent_item",
      });
    }
  }

  CommitteeNegotiationEntry.init(
    {
      committee_meeting_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      firm_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tender_vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      indent_item_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      negotiated_quantity: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      negotiated_rate: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      accepted_quantity: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      accepted_rate: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      accepted_for_po: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      rank_order: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "CommitteeNegotiationEntry",
      tableName: COMMITTEE_NEGOTIATION_ENTRY_TABLE,
      underscored: true,
    },
  );

  return CommitteeNegotiationEntry;
};
