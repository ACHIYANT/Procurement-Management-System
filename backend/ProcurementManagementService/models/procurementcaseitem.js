"use strict";

const { Model } = require("sequelize");
const { PROCUREMENT_CASE_ITEM_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class ProcurementCaseItem extends Model {
    static associate(models) {
      ProcurementCaseItem.belongsTo(models.ProcurementCase, {
        foreignKey: "procurement_case_id",
        as: "procurement_case",
      });
      ProcurementCaseItem.belongsTo(models.IndentItem, {
        foreignKey: "indent_item_id",
        as: "indent_item",
      });
      ProcurementCaseItem.hasMany(models.TenderItem, {
        foreignKey: "procurement_case_item_id",
        as: "tender_items",
      });
    }
  }

  ProcurementCaseItem.init(
    {
      procurement_case_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      indent_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
      modelName: "ProcurementCaseItem",
      tableName: PROCUREMENT_CASE_ITEM_TABLE,
      underscored: true,
    },
  );

  return ProcurementCaseItem;
};
