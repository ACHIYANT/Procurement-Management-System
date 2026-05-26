"use strict";

const { Model } = require("sequelize");
const { EMPANELMENT_OEM_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class EmpanelmentOem extends Model {
    static associate(models) {
      EmpanelmentOem.belongsTo(models.Empanelment, {
        foreignKey: "empanelment_id",
        as: "empanelment",
      });
      EmpanelmentOem.belongsTo(models.EmpanelmentItemCategory, {
        foreignKey: "item_category_id",
        as: "item_category",
      });
    }
  }

  EmpanelmentOem.init(
    {
      empanelment_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      item_category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      oem_name: {
        type: DataTypes.STRING(180),
        allowNull: false,
        validate: { notEmpty: true },
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "EmpanelmentOem",
      tableName: EMPANELMENT_OEM_TABLE,
      underscored: true,
    },
  );

  return EmpanelmentOem;
};
