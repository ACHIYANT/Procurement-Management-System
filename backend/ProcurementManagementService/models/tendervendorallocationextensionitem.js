"use strict";

const { Model } = require("sequelize");
const {
  TENDER_VENDOR_ALLOCATION_EXTENSION_ITEM_TABLE,
} = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class TenderVendorAllocationExtensionItem extends Model {
    static associate(models) {
      TenderVendorAllocationExtensionItem.belongsTo(
        models.TenderVendorAllocationExtension,
        {
          foreignKey: "allocation_extension_id",
          as: "allocation_extension",
        },
      );
      TenderVendorAllocationExtensionItem.belongsTo(models.TenderItem, {
        foreignKey: "tender_item_id",
        as: "tender_item",
      });
    }
  }

  TenderVendorAllocationExtensionItem.init(
    {
      allocation_extension_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tender_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      extension_quantity: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      extension_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "TenderVendorAllocationExtensionItem",
      tableName: TENDER_VENDOR_ALLOCATION_EXTENSION_ITEM_TABLE,
      underscored: true,
    },
  );

  return TenderVendorAllocationExtensionItem;
};
