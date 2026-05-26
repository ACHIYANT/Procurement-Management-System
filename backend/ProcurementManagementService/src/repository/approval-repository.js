const {
  ApprovalRequest,
  ApprovalRequestPayload,
  ApprovalRequestStep,
  ApprovalWorkflow,
  ApprovalWorkflowLevel,
  ProcurementEmployee,
} = require("../../models");

const workflowIncludes = [
  {
    model: ApprovalWorkflowLevel,
    as: "levels",
    include: [{ model: ProcurementEmployee, as: "approver_employee" }],
  },
  { model: ProcurementEmployee, as: "created_by_employee" },
];

const requestIncludes = [
  {
    model: ApprovalWorkflow,
    as: "workflow",
    include: [{ model: ApprovalWorkflowLevel, as: "levels" }],
  },
  {
    model: ApprovalRequestStep,
    as: "steps",
    include: [
      { model: ProcurementEmployee, as: "approver_employee" },
      { model: ProcurementEmployee, as: "approved_by_employee" },
    ],
  },
  { model: ApprovalRequestPayload, as: "payload" },
  { model: ProcurementEmployee, as: "requested_by_employee" },
];

class ApprovalRepository {
  listWorkflows(where = {}) {
    return ApprovalWorkflow.findAll({
      where,
      include: workflowIncludes,
      order: [
        ["id", "DESC"],
        [{ model: ApprovalWorkflowLevel, as: "levels" }, "level_no", "ASC"],
      ],
    });
  }

  findWorkflowById(id, transaction) {
    return ApprovalWorkflow.findByPk(id, {
      include: workflowIncludes,
      transaction,
      order: [[{ model: ApprovalWorkflowLevel, as: "levels" }, "level_no", "ASC"]],
    });
  }

  findActiveWorkflow(moduleKey, actionKey, transaction) {
    return ApprovalWorkflow.findOne({
      where: { module_key: moduleKey, action_key: actionKey, is_active: true },
      include: workflowIncludes,
      order: [[{ model: ApprovalWorkflowLevel, as: "levels" }, "level_no", "ASC"]],
      transaction,
    });
  }

  createWorkflow(payload, transaction) {
    return ApprovalWorkflow.create(payload, { transaction });
  }

  async replaceWorkflowLevels(workflowId, levels, transaction) {
    await ApprovalWorkflowLevel.destroy({
      where: { approval_workflow_id: workflowId },
      transaction,
    });
    if (!levels.length) return [];
    return ApprovalWorkflowLevel.bulkCreate(
      levels.map((level) => ({ ...level, approval_workflow_id: workflowId })),
      { transaction },
    );
  }

  updateWorkflow(workflow, payload, transaction) {
    return workflow.update(payload, { transaction });
  }

  listRequests(where = {}) {
    return ApprovalRequest.findAll({
      where,
      include: requestIncludes,
      order: [
        ["id", "DESC"],
        [{ model: ApprovalRequestStep, as: "steps" }, "level_no", "ASC"],
      ],
      limit: 200,
    });
  }

  findRequestById(id, transaction) {
    return ApprovalRequest.findByPk(id, {
      include: requestIncludes,
      transaction,
      order: [[{ model: ApprovalRequestStep, as: "steps" }, "level_no", "ASC"]],
    });
  }

  createRequest(payload, transaction) {
    return ApprovalRequest.create(payload, { transaction });
  }

  createRequestPayload(payload, transaction) {
    return ApprovalRequestPayload.create(payload, { transaction });
  }

  createRequestSteps(steps, transaction) {
    return ApprovalRequestStep.bulkCreate(steps, { transaction });
  }
}

module.exports = {
  ApprovalRepository,
  requestIncludes,
  workflowIncludes,
};
