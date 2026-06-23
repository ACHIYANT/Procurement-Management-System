"use strict";

const { Model } = require("sequelize");
const {
  TENDER_VENDOR_ITEM_QUOTE_TABLE,
} = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class TenderVendorItemQuote extends Model {
    static associate(models) {
      TenderVendorItemQuote.belongsTo(models.TenderVendor, {
        foreignKey: "tender_vendor_id",
        as: "tender_vendor",
      });
      TenderVendorItemQuote.belongsTo(models.TenderItem, {
        foreignKey: "tender_item_id",
        as: "tender_item",
      });
    }
  }

  TenderVendorItemQuote.init(
    {
      tender_vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tender_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      quoted_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      negotiated_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      pre_ra_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      post_ra_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      loa_allocated_quantity: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      loa_allocated_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      make: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      model: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "TenderVendorItemQuote",
      tableName: TENDER_VENDOR_ITEM_QUOTE_TABLE,
      underscored: true,
    },
  );

  return TenderVendorItemQuote;
};
