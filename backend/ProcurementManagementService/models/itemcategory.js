"use strict";

const { Model } = require("sequelize");
const { ITEM_CATEGORY_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class ItemCategory extends Model {
    static associate(models) {
      ItemCategory.hasMany(models.ItemSubcategory, {
        foreignKey: "category_id",
        as: "subcategories",
      });
      ItemCategory.hasMany(models.IndentItem, {
        foreignKey: "category_id",
        as: "indent_items",
      });
    }
  }

  ItemCategory.init(
    {
      category_name: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "ItemCategory",
      tableName: ITEM_CATEGORY_TABLE,
      underscored: true,
    },
  );

  return ItemCategory;
};
