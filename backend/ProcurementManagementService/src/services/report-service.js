"use strict";

const ReportRepository = require("../repository/report-repository");

class ReportService {
  constructor() {
    this.repository = new ReportRepository();
  }

  async getSummary() {
    const [
      overview,
      valueFlow,
      departmentRows,
      flowHealth,
      pendingIndentWork,
      tenderAttention,
      purchaseOrderPaymentPosition,
      tenderLifecycleRows,
    ] = await Promise.all([
      this.repository.getOverviewCounts(),
      this.repository.getValueFlowMetrics(),
      this.repository.getDepartmentRollup(),
      this.repository.getFlowHealth(),
      this.repository.getPendingIndentWork(),
      this.repository.getTenderAttention(),
      this.repository.getPurchaseOrderPaymentPosition(),
      this.repository.getTenderLifecycleReport(),
    ]);

    const actionRequiredCount =
      Number(flowHealth.indents_pending_assignment || 0) +
      Number(flowHealth.indents_pending_estimate || 0) +
      Number(flowHealth.procurement_cases_without_tender || 0) +
      Number(flowHealth.tenders_with_emd_issue || 0) +
      Number(flowHealth.tenders_with_pbg_issue || 0) +
      Number(flowHealth.purchase_orders_pending_payment || 0);

    return {
      generated_at: new Date().toISOString(),
      overview,
      value_flow: valueFlow,
      flow_health: flowHealth,
      department_rows: departmentRows,
      pending_indent_work: pendingIndentWork,
      tender_attention: tenderAttention,
      purchase_order_payment_position: purchaseOrderPaymentPosition,
      tender_lifecycle_rows: tenderLifecycleRows,
      action_required_count: actionRequiredCount,
    };
  }
}

module.exports = ReportService;
