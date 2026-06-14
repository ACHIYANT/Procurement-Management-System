"use strict";

const { ItemSpecificationTemplate } = require("../../models");

class ItemSpecificationTemplateRepository {
  async list({ activeOnly = false } = {}) {
    return ItemSpecificationTemplate.findAll({
      where: activeOnly ? { is_active: true } : {},
      order: [
        ["sort_order", "ASC"],
        ["template_name", "ASC"],
      ],
    });
  }

  async findByPk(id) {
    return ItemSpecificationTemplate.findByPk(id);
  }

  async findByName(templateName) {
    return ItemSpecificationTemplate.findOne({
      where: { template_name: templateName },
    });
  }

  async create(payload) {
    return ItemSpecificationTemplate.create(payload);
  }

  async update(template, payload) {
    return template.update(payload);
  }
}

module.exports = {
  ItemSpecificationTemplateRepository,
};
