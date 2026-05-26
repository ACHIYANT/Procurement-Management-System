"use strict";

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
