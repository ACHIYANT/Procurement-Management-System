"use strict";

const { Model } = require("sequelize");
const {
  TENDER_VENDOR_ALLOCATION_EXTENSION_TABLE,
} = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class TenderVendorAllocationExtension extends Model {
    static associate(models) {
      TenderVendorAllocationExtension.belongsTo(models.TenderVendor, {
        foreignKey: "tender_vendor_id",
        as: "tender_vendor",
      });
      TenderVendorAllocationExtension.belongsTo(models.Tender, {
        foreignKey: "tender_id",
        as: "tender",
      });
      TenderVendorAllocationExtension.belongsTo(models.Firm, {
        foreignKey: "firm_id",
        as: "firm",
      });
      TenderVendorAllocationExtension.hasMany(
        models.TenderVendorAllocationExtensionItem,
        {
          foreignKey: "allocation_extension_id",
          as: "items",
        },
      );
    }
  }

  TenderVendorAllocationExtension.init(
    {
      tender_vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      firm_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      extension_basis: {
        type: DataTypes.STRING(40),
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
      approval_reference: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      approval_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      document_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "TenderVendorAllocationExtension",
      tableName: TENDER_VENDOR_ALLOCATION_EXTENSION_TABLE,
      underscored: true,
    },
  );

  return TenderVendorAllocationExtension;
};
