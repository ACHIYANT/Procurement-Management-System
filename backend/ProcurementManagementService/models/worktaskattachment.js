"use strict";

const { Model } = require("sequelize");
const { WORK_TASK_ATTACHMENT_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class WorkTaskAttachment extends Model {
    static associate(models) {
      WorkTaskAttachment.belongsTo(models.WorkTask, {
        foreignKey: "work_task_id",
        as: "task",
      });
      WorkTaskAttachment.belongsTo(models.ProcurementEmployee, {
        foreignKey: "uploaded_by_employee_id",
        as: "uploaded_by_employee",
      });
    }
  }

  WorkTaskAttachment.init(
    {
      work_task_id: { type: DataTypes.INTEGER, allowNull: false },
      document_path: { type: DataTypes.STRING(500), allowNull: false },
      original_file_name: { type: DataTypes.STRING(260), allowNull: true },
      file_size: { type: DataTypes.INTEGER, allowNull: true },
      mime_type: { type: DataTypes.STRING(120), allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
      uploaded_by_employee_id: { type: DataTypes.INTEGER, allowNull: true },
      uploaded_by_name: { type: DataTypes.STRING(160), allowNull: true },
    },
    {
      sequelize,
      modelName: "WorkTaskAttachment",
      tableName: WORK_TASK_ATTACHMENT_TABLE,
      underscored: true,
    },
  );

  return WorkTaskAttachment;
};
