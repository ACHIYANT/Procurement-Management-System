"use strict";

const { Model } = require("sequelize");
const { INDENT_ITEM_EVENT_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class IndentItemEvent extends Model {
    static associate(models) {
      IndentItemEvent.belongsTo(models.IndentItem, {
        foreignKey: "indent_item_id",
        as: "indent_item",
      });
      IndentItemEvent.belongsTo(models.ProcurementEmployee, {
        foreignKey: "actor_procurement_employee_id",
        as: "actor",
      });
      IndentItemEvent.belongsTo(models.ProcurementEmployee, {
        foreignKey: "from_procurement_officer_id",
        as: "from_officer",
      });
      IndentItemEvent.belongsTo(models.ProcurementEmployee, {
        foreignKey: "to_procurement_officer_id",
        as: "to_officer",
      });
    }
  }

  IndentItemEvent.init(
    {
      indent_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      event_type: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      event_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      actor_procurement_employee_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      from_procurement_officer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      to_procurement_officer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "IndentItemEvent",
      tableName: INDENT_ITEM_EVENT_TABLE,
      underscored: true,
    },
  );

  return IndentItemEvent;
};
