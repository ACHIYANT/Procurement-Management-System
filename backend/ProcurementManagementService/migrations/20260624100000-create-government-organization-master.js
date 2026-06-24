"use strict";

const {
  GOVERNMENT_ORGANIZATION_TABLE,
} = require("../src/constants/table-names");

const masterEntries = [
  ["Home Department", "home_department", "Department", null],
  ["Department of Agriculture and Farmers Welfare", "agriculture_department", "Department", null],
  ["Animal Husbandry & Dairying Department", "animal_husbandry_department", "Department", null],
  ["Archaeology & Museums Department", "archaeology_department", "Department", null],
  ["Higher Education Department", "higher_education_department", "Department", null],
  ["School Education Department", "school_education_department", "Department", null],
  ["Elementary Education Department", "elementary_education_department", "Department", null],
  ["Electronics & IT Department", "it_department", "Department", null],
  ["Environment Department", "environment_department", "Department", null],
  ["Excise & Taxation Department", "excise_taxation_department", "Department", null],
  ["Finance Department", "finance_department", "Department", null],
  ["Fisheries Department", "fisheries_department", "Department", null],
  ["Food & Civil Supplies Department", "food_supply_department", "Department", null],
  ["Forest Department", "forest_department", "Department", null],
  ["Health Department", "health_department", "Department", null],
  ["Irrigation Department", "irrigation_department", "Department", null],
  ["Labour Department", "labour_department", "Department", null],
  ["Police Department", "police_department", "Department", null],
  ["Prisons Department", "prisons_department", "Department", null],
  ["Information & PR Department", "ipr_department", "Department", null],
  ["Public Works Department", "pwd_department", "Department", null],
  ["Revenue Department", "revenue_department", "Department", null],
  ["Rural Development Department", "rural_development_department", "Department", null],
  ["Tourism Department", "tourism_department", "Department", null],
  ["Town & Country Planning", "tcp_department", "Department", null],
  ["Transport Department", "transport_department", "Department", null],
  ["Treasury Department", "treasury_department", "Department", null],
  ["Women & Child Development", "wcd_department", "Department", null],
  ["Public Health Engineering", "phed_department", "Department", null],
  ["Archives Department", "archives_department", "Department", null],
  ["Civil Aviation Department", "civil_aviation_department", "Department", null],
  ["Panchayati Raj Department", "panchayat_department", "Department", null],
  ["Statistics Department", "statistics_department", "Department", null],
  ["Horticulture Department", "horticulture_department", "Department", null],
  ["Home Guards Department", "home_guards_department", "Department", null],
  ["Industries Department", "industries_department", "Department", null],
  ["Skill Development Department", "skill_development_department", "Department", null],
  ["Renewable Energy Department", "renewable_energy_department", "Department", null],
  ["Social Justice Department", "social_justice_department", "Department", null],
  ["Sports Department", "sports_department", "Department", null],
  ["Supplies Department", "supplies_department", "Department", null],
  ["Technical Education Department", "technical_education_department", "Department", null],
  ["Electrical Inspector Department", "electrical_inspector_department", "Department", null],
  ["Citizen Resource Info Department", "citizen_resources_department", "Department", null],
  ["Urban Local Bodies Department", "ulb_department", "Department", null],
  ["Power Department", "power_department", "Department", null],
  ["Haryana State Agricultural Marketing Board", "hsamb", "Board", "agriculture_department"],
  ["Haryana State Cooperative Apex Bank", "harco_bank", "Board", "agriculture_department"],
  ["HAFED", "hafed", "Board", "agriculture_department"],
  ["State Counselling Board", "state_counselling_board", "Board", "technical_education_department"],
  ["Haryana Power Generation Corporation Limited", "hpgcl", "Corporation", "power_department"],
  ["UHBVN", "uhbvn", "Corporation", "power_department"],
  ["DHBVN", "dhbvn", "Corporation", "power_department"],
  ["Board of School Education Haryana", "bseh", "Board", "school_education_department"],
  ["HARTRON", "hartron", "Corporation", "it_department"],
  ["Haryana Financial Corporation", "hfc", "Corporation", "industries_department"],
  ["Haryana Housing Board", "housing_board", "Board", "ulb_department"],
  ["Haryana Khadi Board", "khadi_board", "Board", "industries_department"],
  ["Mansa Devi Shrine Board", "mansa_devi_board", "Board", "tourism_department"],
  ["HRIDC", "hridc", "Corporation", "transport_department"],
  ["Handloom Corporation", "handloom_corporation", "Corporation", "industries_department"],
  ["Pollution Control Board", "hspcb", "Authority", "environment_department"],
  ["Roads & Bridges Development Corporation", "hsrdc", "Corporation", "pwd_department"],
  ["Warehousing Corporation", "warehousing_corporation", "Corporation", "food_supply_department"],
  ["Food Corporation of India (Haryana)", "fci_haryana", "Central PSU", null],
  ["Haryana Shehri Vikas Pradhikaran (HSVP)", "hsvp", "Authority", "ulb_department"],
  ["Haryana Real Estate Regulatory Authority (HRERA)", "hrera", "Authority", "tcp_department"],
  ["Haryana Electricity Regulatory Commission (HERC)", "herc", "Authority", "power_department"],
  ["Haryana Public Service Commission", "hpsc", "Commission", null],
  ["Haryana Staff Selection Commission", "hssc", "Commission", null],
  ["Haryana State Information Commission", "hsic", "Commission", null],
  ["Haryana Human Rights Commission", "hhrc", "Commission", null],
  ["Maharshi Dayanand University", "mdu", "University", "higher_education_department"],
  ["Kurukshetra University", "kuk", "University", "higher_education_department"],
  ["CCSHAU Hisar", "ccshau", "University", "agriculture_department"],
  ["LUVAS Hisar", "luvas", "University", "animal_husbandry_department"],
  ["UHSR Rohtak", "uhsr", "University", "health_department"],
  ["PGIMS Rohtak", "pgims", "Medical College", "health_department"],
  ["Kalpana Chawla GMC Karnal", "kcgmc", "Medical College", "health_department"],
  ["SHKM GMC Nalhar", "shkm", "Medical College", "health_department"],
  ["Haryana School Shiksha Pariyojna Parishad", "hssp", "Society", "school_education_department"],
  ["State Health Society Haryana", "state_health_society", "Society", "health_department"],
  ["Haryana Skill Development Mission", "hsdm", "Society", "skill_development_department"],
  ["Punjab and Haryana High Court", "phhc", "Court", null],
  ["District Courts Haryana", "district_courts", "Court", null],
];

const toSeedRows = () => {
  const now = new Date();
  return masterEntries.map(([organizationName, organizationCode, organizationGroup, parentCode], index) => ({
    organization_name: organizationName,
    organization_code: organizationCode,
    organization_group: organizationGroup,
    parent_code: parentCode,
    sort_order: index + 1,
    is_active: true,
    created_at: now,
    updated_at: now,
  }));
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(GOVERNMENT_ORGANIZATION_TABLE, {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      organization_name: { type: Sequelize.STRING(220), allowNull: false },
      organization_code: { type: Sequelize.STRING(140), allowNull: false, unique: true },
      organization_group: { type: Sequelize.STRING(80), allowNull: false, defaultValue: "Department" },
      parent_code: { type: Sequelize.STRING(140), allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 100 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex(GOVERNMENT_ORGANIZATION_TABLE, ["organization_group", "organization_name"], {
      name: "government_organizations_group_name_unique",
      unique: true,
    });
    await queryInterface.addIndex(GOVERNMENT_ORGANIZATION_TABLE, ["parent_code"], {
      name: "government_organizations_parent_code_idx",
    });
    await queryInterface.addIndex(GOVERNMENT_ORGANIZATION_TABLE, ["is_active", "organization_group"], {
      name: "government_organizations_active_group_idx",
    });

    await queryInterface.bulkInsert(GOVERNMENT_ORGANIZATION_TABLE, toSeedRows());
  },

  async down(queryInterface) {
    await queryInterface.dropTable(GOVERNMENT_ORGANIZATION_TABLE).catch(() => {});
  },
};
