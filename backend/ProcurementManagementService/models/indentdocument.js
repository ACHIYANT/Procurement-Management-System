"use strict";

const { Model } = require("sequelize");
const { INDENT_DOCUMENT_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class IndentDocument extends Model {
    static associate(models) {
      IndentDocument.belongsTo(models.Indent, {
        foreignKey: "indent_id",
        as: "indent",
      });
      IndentDocument.belongsTo(models.ProcurementEmployee, {
        foreignKey: "uploaded_by",
        as: "uploader",
      });
    }
  }

  IndentDocument.init(
    {
      indent_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      document_type: {
        type: DataTypes.STRING(80),
        allowNull: false,
        defaultValue: "supporting_document",
      },
      document_title: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      document_path: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      uploaded_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "IndentDocument",
      tableName: INDENT_DOCUMENT_TABLE,
      underscored: true,
    },
  );

  return IndentDocument;
};
