"use strict";

const { Op } = require("sequelize");
const { ItemCategory, ItemSubcategory, sequelize } = require("../../models");

const categoryInclude = [
  {
    model: ItemSubcategory,
    as: "subcategories",
    separate: true,
    order: [["subcategory_name", "ASC"]],
  },
];

class ItemCategoryRepository {
  async list({ activeOnly = false } = {}) {
    return ItemCategory.findAll({
      where: activeOnly ? { is_active: true } : {},
      include: categoryInclude,
      order: [["category_name", "ASC"]],
    });
  }

  async findByPk(id, include = categoryInclude) {
    return ItemCategory.findByPk(id, { include });
  }

  async findCategoryByName(categoryName) {
    const normalizedName = String(categoryName || "").trim().replace(/\s+/g, " ").toLowerCase();
    return ItemCategory.findOne({
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("category_name"))),
        normalizedName,
      ),
      include: categoryInclude,
    });
  }

  async findSubcategoryByCategoryAndName(categoryId, subcategoryName) {
    const normalizedName = String(subcategoryName || "").trim().replace(/\s+/g, " ").toLowerCase();
    return ItemSubcategory.findOne({
      where: {
        category_id: categoryId,
        [Op.and]: sequelize.where(
          sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("subcategory_name"))),
          normalizedName,
        ),
      },
    });
  }

  async createCategory(payload, options = {}) {
    return ItemCategory.create(payload, options);
  }

  async bulkCreateSubcategories(payload, options = {}) {
    return ItemSubcategory.bulkCreate(payload, options);
  }

  async updateCategory(category, payload, options = {}) {
    return category.update(payload, options);
  }

  async findSubcategoryByPk(id) {
    return ItemSubcategory.findByPk(id);
  }

  async updateSubcategory(subcategory, payload, options = {}) {
    return subcategory.update(payload, options);
  }

  async withTransaction(callback) {
    return sequelize.transaction(callback);
  }
}

module.exports = {
  ItemCategoryRepository,
};
