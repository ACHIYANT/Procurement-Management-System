"use strict";

const { ItemCategoryRepository } = require("../repository/item-category-repository");
const {
  asId,
  normalizeNullableText,
  normalizeText,
  notFound,
  requireValue,
} = require("../utils/procurement-domain");

const normalizeBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "active"].includes(normalized)) return true;
  if (["false", "0", "no", "inactive"].includes(normalized)) return false;
  return Boolean(value);
};

class ItemCategoryService {
  constructor() {
    this.repository = new ItemCategoryRepository();
  }

  async list(query = {}) {
    const activeOnly = normalizeBoolean(query.activeOnly || query.active_only, false);
    return this.repository.list({ activeOnly });
  }

  normalizeSubcategories(subcategories = []) {
    return (Array.isArray(subcategories) ? subcategories : [])
      .map((item) => ({
        subcategory_name: normalizeText(
          typeof item === "string" ? item : item?.subcategory_name,
        ),
        is_active: normalizeBoolean(item?.is_active, true),
      }))
      .filter((item) => item.subcategory_name);
  }

  async create(payload = {}) {
    const categoryName = requireValue(payload, "category_name", "Category name");
    const subcategories = this.normalizeSubcategories(payload.subcategories);

    const created = await this.repository.withTransaction(async (transaction) => {
      const category = await this.repository.createCategory(
        {
          category_name: categoryName,
          is_active: normalizeBoolean(payload.is_active, true),
        },
        { transaction },
      );

      if (subcategories.length) {
        await this.repository.bulkCreateSubcategories(
          subcategories.map((subcategory) => ({
            ...subcategory,
            category_id: category.id,
          })),
          { transaction },
        );
      }

      return category;
    });

    return this.repository.findByPk(created.id);
  }

  async updateCategory(id, payload = {}) {
    const category = await this.repository.findByPk(asId(id, "Category id"));
    if (!category) throw notFound("Item category not found.");

    const update = {};
    if ("category_name" in payload) {
      update.category_name = requireValue(payload, "category_name", "Category name");
    }
    if ("is_active" in payload) {
      update.is_active = normalizeBoolean(payload.is_active, true);
    }

    if (Object.keys(update).length) {
      await this.repository.updateCategory(category, update);
    }
    return this.repository.findByPk(category.id);
  }

  async addSubcategories(categoryId, payload = {}) {
    const category = await this.repository.findByPk(asId(categoryId, "Category id"));
    if (!category) throw notFound("Item category not found.");

    const subcategories = this.normalizeSubcategories(payload.subcategories || [payload]);
    if (!subcategories.length) {
      const error = new Error("At least one subcategory name is required.");
      error.statusCode = 400;
      throw error;
    }

    await this.repository.bulkCreateSubcategories(
      subcategories.map((subcategory) => ({
        ...subcategory,
        category_id: category.id,
      })),
    );
    return this.repository.findByPk(category.id);
  }

  async updateSubcategory(id, payload = {}) {
    const subcategory = await this.repository.findSubcategoryByPk(
      asId(id, "Subcategory id"),
    );
    if (!subcategory) throw notFound("Item subcategory not found.");

    const update = {};
    if ("subcategory_name" in payload) {
      update.subcategory_name =
        normalizeNullableText(payload.subcategory_name) ||
        subcategory.subcategory_name;
    }
    if ("is_active" in payload) {
      update.is_active = normalizeBoolean(payload.is_active, true);
    }

    if (Object.keys(update).length) {
      await this.repository.updateSubcategory(subcategory, update);
    }
    return this.repository.findByPk(subcategory.category_id);
  }
}

module.exports = ItemCategoryService;
