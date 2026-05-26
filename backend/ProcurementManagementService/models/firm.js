"use strict";

const { Model } = require("sequelize");
const { FIRM_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class Firm extends Model {
    static associate(models) {
      Firm.hasMany(models.FirmAddress, {
        foreignKey: "firm_id",
        as: "addresses",
      });
      Firm.hasMany(models.FirmContact, {
        foreignKey: "firm_id",
        as: "contacts",
      });
      Firm.hasMany(models.TenderVendor, {
        foreignKey: "firm_id",
        as: "tender_participations",
      });
      Firm.hasMany(models.Empanelment, {
        foreignKey: "firm_id",
        as: "empanelments",
      });
      Firm.hasMany(models.PurchaseOrder, {
        foreignKey: "firm_id",
        as: "purchase_orders",
      });
      Firm.hasMany(models.PbgEntry, {
        foreignKey: "firm_id",
        as: "pbg_entries",
      });
      Firm.hasMany(models.CommitteeNegotiationEntry, {
        foreignKey: "firm_id",
        as: "committee_negotiation_entries",
      });
    }
  }

  Firm.init(
    {
      firm_code: {
        type: DataTypes.STRING(40),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
      },
      firm_name: {
        type: DataTypes.STRING(180),
        allowNull: false,
        validate: { notEmpty: true },
        set(value) {
          this.setDataValue("firm_name", String(value || "").trim().replace(/\s+/g, " "));
        },
      },
      vendor_category: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "general",
      },
      vendor_type: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      gst_no: {
        type: DataTypes.STRING(20),
        allowNull: true,
        set(value) {
          this.setDataValue("gst_no", value ? String(value).trim().toUpperCase() : null);
        },
      },
      pan_no: {
        type: DataTypes.STRING(20),
        allowNull: true,
        set(value) {
          this.setDataValue("pan_no", value ? String(value).trim().toUpperCase() : null);
        },
      },
      msme_no: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      msme_state: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
      modelName: "Firm",
      tableName: FIRM_TABLE,
      underscored: true,
    },
  );

  return Firm;
};
