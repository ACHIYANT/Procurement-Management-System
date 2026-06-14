"use strict";

const { Model } = require("sequelize");
const { WORK_TASK_COMMENT_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class WorkTaskComment extends Model {
    static associate(models) {
      WorkTaskComment.belongsTo(models.WorkTask, {
        foreignKey: "work_task_id",
        as: "task",
      });
      WorkTaskComment.belongsTo(models.ProcurementEmployee, {
        foreignKey: "author_employee_id",
        as: "author_employee",
      });
    }
  }

  WorkTaskComment.init(
    {
      work_task_id: { type: DataTypes.INTEGER, allowNull: false },
      comment_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "comment" },
      comment_text: { type: DataTypes.TEXT, allowNull: false },
      author_employee_id: { type: DataTypes.INTEGER, allowNull: true },
      author_name: { type: DataTypes.STRING(160), allowNull: true },
    },
    {
      sequelize,
      modelName: "WorkTaskComment",
      tableName: WORK_TASK_COMMENT_TABLE,
      underscored: true,
    },
  );

  return WorkTaskComment;
};
