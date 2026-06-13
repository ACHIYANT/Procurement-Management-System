const { Op } = require("sequelize");
const {
  ProcurementEmployee,
  WorkTask,
  WorkTaskActivity,
  WorkTaskAssignee,
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
];

class WorkTaskRepository {
  listTasks({
    where = {},
    assigneeEmployeeId = null,
    from = null,
    to = null,
    limit = 300,
  } = {}) {
    const taskWhere = { ...where };

    if (from || to) {
      taskWhere.due_at = {};
      if (from) taskWhere.due_at[Op.gte] = from;
      if (to) taskWhere.due_at[Op.lte] = to;
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
      ],
      limit,
      distinct: true,
    });
  }

  findTaskById(id, transaction) {
    return WorkTask.findByPk(id, {
      include: taskIncludes,
      transaction,
      order: [
        [{ model: WorkTaskComment, as: "comments" }, "created_at", "ASC"],
        [{ model: WorkTaskActivity, as: "activities" }, "created_at", "ASC"],
      ],
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

  createComment(payload, transaction) {
    return WorkTaskComment.create(payload, { transaction });
  }

  createActivity(payload, transaction) {
    return WorkTaskActivity.create(payload, { transaction });
  }
}

module.exports = {
  WorkTaskRepository,
  taskIncludes,
};
