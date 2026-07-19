const { Op } = require("sequelize");
const {
  ProcurementEmployee,
  WorkTask,
  WorkTaskActivity,
  WorkTaskAssignee,
  WorkTaskAttachment,
  WorkTaskComment,
} = require("../../models");

const taskIncludes = [
  { model: ProcurementEmployee, as: "created_by_employee" },
  { model: ProcurementEmployee, as: "assigned_by_employee" },
  { model: ProcurementEmployee, as: "completed_by_employee" },
  { model: ProcurementEmployee, as: "returned_by_employee" },
  {
    model: WorkTaskAssignee,
    as: "assignees",
    include: [{ model: ProcurementEmployee, as: "assigned_to_employee" }],
  },
  {
    model: WorkTaskComment,
    as: "comments",
    include: [{ model: ProcurementEmployee, as: "author_employee" }],
  },
  {
    model: WorkTaskActivity,
    as: "activities",
    include: [{ model: ProcurementEmployee, as: "actor_employee" }],
  },
  {
    model: WorkTaskAttachment,
    as: "attachments",
    include: [{ model: ProcurementEmployee, as: "uploaded_by_employee" }],
  },
];

class WorkTaskRepository {
  listTasks({
    where = {},
    assigneeEmployeeId = null,
    participantEmployeeId = null,
    from = null,
    to = null,
    limit = 300,
  } = {}) {
    const taskWhere = { ...where };
    const participantId = participantEmployeeId ? Number(participantEmployeeId) : null;

    if (from || to) {
      taskWhere.due_at = {};
      if (from) taskWhere.due_at[Op.gte] = from;
      if (to) taskWhere.due_at[Op.lte] = to;
    }

    if (participantId) {
      taskWhere[Op.and] = [
        ...(Array.isArray(taskWhere[Op.and]) ? taskWhere[Op.and] : []),
        {
          [Op.or]: [
            { created_by_employee_id: participantId },
            { assigned_by_employee_id: participantId },
            { completed_by_employee_id: participantId },
            { returned_by_employee_id: participantId },
            { "$assignees.assigned_to_employee_id$": participantId },
          ],
        },
      ];
    }

    const include = taskIncludes.map((entry) => ({ ...entry }));
    if (assigneeEmployeeId) {
      const assigneeInclude = include.find((entry) => entry.as === "assignees");
      assigneeInclude.where = { assigned_to_employee_id: assigneeEmployeeId };
      assigneeInclude.required = true;
    }

    return WorkTask.findAll({
      where: taskWhere,
      include,
      order: [
        ["due_at", "ASC"],
        ["priority", "ASC"],
        ["id", "DESC"],
        [{ model: WorkTaskComment, as: "comments" }, "created_at", "ASC"],
        [{ model: WorkTaskActivity, as: "activities" }, "created_at", "ASC"],
        [{ model: WorkTaskAttachment, as: "attachments" }, "created_at", "DESC"],
      ],
      limit,
      distinct: true,
      subQuery: false,
    });
  }

  findTaskById(id, transaction) {
    return WorkTask.findByPk(id, {
      include: taskIncludes,
      transaction,
      order: [
        [{ model: WorkTaskComment, as: "comments" }, "created_at", "ASC"],
        [{ model: WorkTaskActivity, as: "activities" }, "created_at", "ASC"],
        [{ model: WorkTaskAttachment, as: "attachments" }, "created_at", "DESC"],
      ],
    });
  }

  findActiveSystemTask({ systemRuleCode, entityType, entityId }, transaction) {
    return WorkTask.findOne({
      where: {
        origin_type: "system",
        system_rule_code: systemRuleCode,
        entity_type: entityType,
        entity_id: String(entityId),
        status: { [Op.in]: ["open", "in_progress", "returned", "reassigned"] },
      },
      include: taskIncludes,
      transaction,
    });
  }

  findReminderOccurrenceTasks(sourceTaskId, transaction) {
    return WorkTask.findAll({
      where: {
        origin_type: "system",
        system_rule_code: "task_reminder_occurrence",
        entity_type: "work_task_reminder",
        entity_id: { [Op.like]: `${sourceTaskId}:%` },
        status: { [Op.in]: ["open", "in_progress", "returned", "reassigned"] },
      },
      include: taskIncludes,
      transaction,
    });
  }

  findActiveReminderSourceTasks(transaction) {
    return WorkTask.findAll({
      where: {
        reminder_at: { [Op.ne]: null },
        status: { [Op.in]: ["open", "in_progress", "returned", "reassigned"] },
        [Op.or]: [
          { system_rule_code: null },
          { system_rule_code: { [Op.ne]: "task_reminder_occurrence" } },
        ],
      },
      include: taskIncludes,
      transaction,
      limit: 500,
      order: [["reminder_at", "ASC"]],
    });
  }

  createTask(payload, transaction) {
    return WorkTask.create(payload, { transaction });
  }

  updateTask(task, payload, transaction) {
    return task.update(payload, { transaction });
  }

  createAssignees(assignees, transaction) {
    if (!assignees.length) return [];
    return WorkTaskAssignee.bulkCreate(assignees, { transaction });
  }

  updateAssignees(taskId, payload, transaction) {
    return WorkTaskAssignee.update(payload, {
      where: { work_task_id: taskId },
      transaction,
    });
  }

  async replaceAssignees(taskId, assignees, transaction) {
    await WorkTaskAssignee.destroy({
      where: { work_task_id: taskId },
      transaction,
    });
    return this.createAssignees(
      assignees.map((assignee) => ({ ...assignee, work_task_id: taskId })),
      transaction,
    );
  }

  createComment(payload, transaction) {
    return WorkTaskComment.create(payload, { transaction });
  }

  createActivity(payload, transaction) {
    return WorkTaskActivity.create(payload, { transaction });
  }

  createAttachment(payload, transaction) {
    return WorkTaskAttachment.create(payload, { transaction });
  }
}

module.exports = {
  WorkTaskRepository,
  taskIncludes,
};
