"use strict";

const { Model } = require("sequelize");
const {
  ITEM_SPECIFICATION_TEMPLATE_TABLE,
} = require("../src/constants/table-names");

const parseJsonArray = (value) => {
  if (!value) return [];
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

module.exports = (sequelize, DataTypes) => {
  class ItemSpecificationTemplate extends Model {}

  ItemSpecificationTemplate.init(
    {
      template_name: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
      },
      item_name: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      keywords_json: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          return parseJsonArray(this.getDataValue("keywords_json"));
        },
        set(value) {
          this.setDataValue("keywords_json", JSON.stringify(Array.isArray(value) ? value : []));
        },
      },
      category_hints_json: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          return parseJsonArray(this.getDataValue("category_hints_json"));
        },
        set(value) {
          this.setDataValue("category_hints_json", JSON.stringify(Array.isArray(value) ? value : []));
        },
      },
      subcategory_hints_json: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          return parseJsonArray(this.getDataValue("subcategory_hints_json"));
        },
        set(value) {
          this.setDataValue("subcategory_hints_json", JSON.stringify(Array.isArray(value) ? value : []));
        },
      },
      groups_json: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          return parseJsonArray(this.getDataValue("groups_json"));
        },
        set(value) {
          this.setDataValue("groups_json", JSON.stringify(Array.isArray(value) ? value : []));
        },
      },
      required_details_json: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          return parseJsonArray(this.getDataValue("required_details_json"));
        },
        set(value) {
          this.setDataValue("required_details_json", JSON.stringify(Array.isArray(value) ? value : []));
        },
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "ItemSpecificationTemplate",
      tableName: ITEM_SPECIFICATION_TEMPLATE_TABLE,
      underscored: true,
    },
  );

  return ItemSpecificationTemplate;
};
