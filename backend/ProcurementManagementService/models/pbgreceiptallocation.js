"use strict";

const { Model } = require("sequelize");
const { PBG_RECEIPT_ALLOCATION_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PbgReceiptAllocation extends Model {
    static associate(models) {
      PbgReceiptAllocation.belongsTo(models.PbgEntry, {
        foreignKey: "pbg_entry_id",
        as: "pbg_receipt",
      });
      PbgReceiptAllocation.belongsTo(models.PbgObligation, {
        foreignKey: "pbg_obligation_id",
        as: "pbg_obligation",
      });
    }
  }

  PbgReceiptAllocation.init(
    {
      pbg_entry_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      pbg_obligation_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      allocated_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
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
      modelName: "PbgReceiptAllocation",
      tableName: PBG_RECEIPT_ALLOCATION_TABLE,
      underscored: true,
    },
  );

  return PbgReceiptAllocation;
};
