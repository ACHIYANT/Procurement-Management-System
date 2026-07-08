"use strict";

const { Model } = require("sequelize");
const { INDENT_ITEM_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class IndentItem extends Model {
    static associate(models) {
      IndentItem.belongsTo(models.Indent, {
        foreignKey: "indent_id",
        as: "indent",
      });
      IndentItem.belongsTo(models.ItemCategory, {
        foreignKey: "category_id",
        as: "category",
      });
      IndentItem.belongsTo(models.ItemSubcategory, {
        foreignKey: "subcategory_id",
        as: "subcategory",
      });
      IndentItem.belongsTo(models.ProcurementEmployee, {
        foreignKey: "assigned_procurement_officer_id",
        as: "procurement_officer",
      });
      IndentItem.belongsTo(models.ProcurementEmployee, {
        foreignKey: "estimated_by_procurement_officer_id",
        as: "estimated_by_officer",
      });
      IndentItem.hasMany(models.ProcurementCaseItem, {
        foreignKey: "indent_item_id",
        as: "case_links",
      });
      IndentItem.hasMany(models.TenderItem, {
        foreignKey: "indent_item_id",
        as: "tender_items",
      });
      IndentItem.hasMany(models.IndentItemEvent, {
        foreignKey: "indent_item_id",
        as: "events",
      });
      IndentItem.hasMany(models.CommitteeNegotiationEntry, {
        foreignKey: "indent_item_id",
        as: "committee_negotiation_entries",
      });
    }
  }

  IndentItem.init(
    {
      indent_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      subcategory_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      item_name: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      quantity: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      unit: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      procurement_scope_type: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "standard_quantity",
      },
      contract_period_value: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      contract_period_unit: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      contract_value_limit: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: true,
      },
      scope_remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      specification: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      specific_make_required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      estimated_rate: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      estimated_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      preferred_make: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      administrative_approval_required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      administrative_approval_status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "not_required",
      },
      administrative_approval_document_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      assigned_procurement_officer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      assigned_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      assignment_status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "unassigned",
      },
      return_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      returned_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      procurement_decision_status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "pending",
      },
      estimated_by_procurement_officer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      estimated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      modelName: "IndentItem",
      tableName: INDENT_ITEM_TABLE,
      underscored: true,
    },
  );

  return IndentItem;
};
