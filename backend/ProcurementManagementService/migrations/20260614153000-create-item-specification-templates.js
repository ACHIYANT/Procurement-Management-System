"use strict";

const {
  ITEM_SPECIFICATION_TEMPLATE_TABLE,
} = require("../src/constants/table-names");

const toJson = (value) => JSON.stringify(value || []);

const defaultTemplates = [
  {
    template_name: "Apple iMac",
    item_name: "Apple iMac",
    keywords_json: toJson(["apple", "imac", "mac"]),
    category_hints_json: toJson(["computer"]),
    subcategory_hints_json: toJson(["imac", "apple"]),
    groups_json: toJson([
      {
        label: "Processor",
        suggestions: ["Latest M-series chip", "M3 chip", "M4 chip"],
      },
      {
        label: "Memory / Storage",
        suggestions: ["16GB unified memory", "24GB unified memory", "512GB SSD", "1TB SSD"],
      },
      {
        label: "Display / OS",
        suggestions: ["24 inch Retina display", "macOS", "Magic Keyboard and Mouse"],
      },
    ]),
    required_details_json: toJson([
      { label: "Processor / chip", patterns: ["m1", "m2", "m3", "m4", "chip", "processor"] },
      { label: "Memory", patterns: ["memory", "ram", "gb"] },
      { label: "Storage", patterns: ["ssd", "storage", "tb"] },
      { label: "Display", patterns: ["retina", "display", "inch"] },
    ]),
    sort_order: 10,
    is_active: true,
  },
  {
    template_name: "Windows All-in-One Desktop",
    item_name: "Windows All-in-One Desktop",
    keywords_json: toJson(["computer", "desktop", "all-in-one", "aio", "windows"]),
    category_hints_json: toJson(["computer"]),
    subcategory_hints_json: toJson(["all-in-one", "aio", "windows"]),
    groups_json: toJson([
      {
        label: "Processor",
        suggestions: ["Intel i5 latest generation", "Intel i7 14th Gen or latest higher processor", "Intel i9 latest generation"],
      },
      {
        label: "Memory / Storage",
        suggestions: ["8GB RAM", "16GB RAM", "32GB RAM", "512GB SSD", "1TB SSD"],
      },
      {
        label: "OS / Display",
        suggestions: ["Windows 11 Pro", "23.8 inch FHD Display", "Wireless keyboard and mouse"],
      },
    ]),
    required_details_json: toJson([
      { label: "Processor", patterns: ["intel", "i5", "i7", "i9", "processor", "gen"] },
      { label: "RAM", patterns: ["ram"] },
      { label: "Storage", patterns: ["ssd", "hdd", "storage"] },
      { label: "Operating system", patterns: ["windows", "os"] },
      { label: "Display", patterns: ["display", "fhd", "inch"] },
    ]),
    sort_order: 20,
    is_active: true,
  },
  {
    template_name: "Monitor",
    item_name: "Monitor / Display Unit",
    keywords_json: toJson(["monitor", "display"]),
    category_hints_json: toJson(["peripheral", "computer"]),
    subcategory_hints_json: toJson(["monitor", "display"]),
    groups_json: toJson([
      {
        label: "Display",
        suggestions: ["24 inch", "27 inch", "FHD", "QHD", "IPS panel"],
      },
      {
        label: "Connectivity / Features",
        suggestions: ["Screen sharing feature", "HDMI", "DisplayPort", "Height adjustable stand"],
      },
    ]),
    required_details_json: toJson([
      { label: "Screen size", patterns: ["inch", "27", "24"] },
      { label: "Resolution", patterns: ["fhd", "qhd", "4k", "resolution"] },
      { label: "Connectivity", patterns: ["hdmi", "displayport", "vga", "usb-c"] },
    ]),
    sort_order: 30,
    is_active: true,
  },
  {
    template_name: "Printer / Scanner",
    item_name: "Printer / Scanner",
    keywords_json: toJson(["printer", "photocopier", "photostat", "scanner", "laserjet", "adf"]),
    category_hints_json: toJson(["printing", "scanning", "photocopy"]),
    subcategory_hints_json: toJson(["printer", "scanner", "photocopier", "adf", "laser"]),
    groups_json: toJson([
      {
        label: "Type",
        suggestions: ["Monochrome", "Color Laser", "Multifunction", "Single Function"],
      },
      {
        label: "Functions",
        suggestions: ["Print / Scan / Copy", "Duplex printing", "ADF", "Legal size support"],
      },
      {
        label: "Connectivity",
        suggestions: ["USB", "Network / Wi-Fi", "Ethernet"],
      },
    ]),
    required_details_json: toJson([
      { label: "Printer/scanner type", patterns: ["monochrome", "color", "laser", "scanner"] },
      { label: "Functions", patterns: ["print", "scan", "copy", "multifunction", "single function"] },
      { label: "Paper size / ADF", patterns: ["adf", "legal", "a4", "duplex"] },
      { label: "Connectivity", patterns: ["usb", "network", "wi-fi", "ethernet"] },
    ]),
    sort_order: 40,
    is_active: true,
  },
  {
    template_name: "UPS",
    item_name: "Offline UPS",
    keywords_json: toJson(["ups", "power", "backup"]),
    category_hints_json: toJson(["power", "backup", "ups"]),
    subcategory_hints_json: toJson(["offline ups", "ups"]),
    groups_json: toJson([
      {
        label: "Capacity / Type",
        suggestions: ["1 KVA", "2 KVA", "Offline UPS", "Online UPS"],
      },
      {
        label: "Battery / Protection",
        suggestions: ["With battery", "30 minutes backup", "Input voltage protection", "Overload protection"],
      },
    ]),
    required_details_json: toJson([
      { label: "Capacity", patterns: ["kva", "va"] },
      { label: "UPS type", patterns: ["offline", "online", "line interactive"] },
      { label: "Battery backup", patterns: ["battery", "backup"] },
    ]),
    sort_order: 50,
    is_active: true,
  },
].map((entry) => ({
  ...entry,
  created_at: new Date(),
  updated_at: new Date(),
}));

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(ITEM_SPECIFICATION_TEMPLATE_TABLE, {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      template_name: { type: Sequelize.STRING(160), allowNull: false, unique: true },
      item_name: { type: Sequelize.STRING(180), allowNull: true },
      keywords_json: { type: Sequelize.TEXT, allowNull: true },
      category_hints_json: { type: Sequelize.TEXT, allowNull: true },
      subcategory_hints_json: { type: Sequelize.TEXT, allowNull: true },
      groups_json: { type: Sequelize.TEXT, allowNull: true },
      required_details_json: { type: Sequelize.TEXT, allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 100 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.bulkInsert(ITEM_SPECIFICATION_TEMPLATE_TABLE, defaultTemplates);
  },

  async down(queryInterface) {
    await queryInterface.dropTable(ITEM_SPECIFICATION_TEMPLATE_TABLE).catch(() => {});
  },
};
