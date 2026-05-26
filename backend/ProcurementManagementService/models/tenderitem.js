"use strict";

const { Model } = require("sequelize");
const { TENDER_ITEM_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class TenderItem extends Model {
    static associate(models) {
      TenderItem.belongsTo(models.Tender, {
        foreignKey: "tender_id",
        as: "tender",
      });
      TenderItem.belongsTo(models.ProcurementCaseItem, {
        foreignKey: "procurement_case_item_id",
        as: "case_item",
      });
      TenderItem.belongsTo(models.IndentItem, {
        foreignKey: "indent_item_id",
        as: "indent_item",
      });
      TenderItem.hasMany(models.TenderVendorItemQuote, {
        foreignKey: "tender_item_id",
        as: "vendor_quotes",
      });
      TenderItem.hasMany(models.TenderVendorAllocationExtensionItem, {
        foreignKey: "tender_item_id",
        as: "allocation_extension_items",
      });
    }
  }

  TenderItem.init(
    {
      tender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      procurement_case_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      indent_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tender_quantity: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      tender_value: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      unit: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "TenderItem",
      tableName: TENDER_ITEM_TABLE,
      underscored: true,
    },
  );

  return TenderItem;
};
