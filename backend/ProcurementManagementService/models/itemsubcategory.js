"use strict";

const { Model } = require("sequelize");
const { ITEM_SUBCATEGORY_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class ItemSubcategory extends Model {
    static associate(models) {
      ItemSubcategory.belongsTo(models.ItemCategory, {
        foreignKey: "category_id",
        as: "category",
      });
      ItemSubcategory.hasMany(models.IndentItem, {
        foreignKey: "subcategory_id",
        as: "indent_items",
      });
    }
  }

  ItemSubcategory.init(
    {
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      subcategory_name: {
        type: DataTypes.STRING(160),
        allowNull: false,
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
      modelName: "ItemSubcategory",
      tableName: ITEM_SUBCATEGORY_TABLE,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["category_id", "subcategory_name"],
        },
      ],
    },
  );

  return ItemSubcategory;
};
