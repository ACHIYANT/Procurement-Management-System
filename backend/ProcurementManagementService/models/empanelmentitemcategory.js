"use strict";

const { Model } = require("sequelize");
const { EMPANELMENT_ITEM_CATEGORY_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class EmpanelmentItemCategory extends Model {
    static associate(models) {
      EmpanelmentItemCategory.belongsTo(models.Empanelment, {
        foreignKey: "empanelment_id",
        as: "empanelment",
      });
      EmpanelmentItemCategory.hasMany(models.EmpanelmentOem, {
        foreignKey: "item_category_id",
        as: "oems",
      });
    }
  }

  EmpanelmentItemCategory.init(
    {
      empanelment_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      category_name: {
        type: DataTypes.STRING(160),
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
      modelName: "EmpanelmentItemCategory",
      tableName: EMPANELMENT_ITEM_CATEGORY_TABLE,
      underscored: true,
    },
  );

  return EmpanelmentItemCategory;
};
