const DashboardRepository = require("../repository/dashboard-repository");

class DashboardService {
  constructor() {
    this.repository = new DashboardRepository();
  }

  async getSummary() {
    const [
      overview,
      valueFlow,
      indentHealth,
      caseHealth,
      tenderAttention,
      emdHealth,
      poAndPbgHealth,
      empanelmentHealth,
      recentActivity,
    ] = await Promise.all([
      this.repository.getOverviewCounts(),
      this.repository.getValueMetrics(),
      this.repository.getIndentMetrics(),
      this.repository.getProcurementCaseMetrics(),
      this.repository.getTenderAttentionMetrics(),
      this.repository.getEmdMetrics(),
      this.repository.getPurchaseOrderAndPbgMetrics(),
      this.repository.getEmpanelmentMetrics(),
      this.repository.getRecentActivity(),
    ]);

    return {
      generated_at: new Date().toISOString(),
      overview,
      value_flow: valueFlow,
      indent_health: indentHealth,
      procurement_case_health: caseHealth,
      tender_attention: tenderAttention,
      emd_health: emdHealth,
      po_and_pbg_health: poAndPbgHealth,
      empanelment_health: empanelmentHealth,
      recent_activity: recentActivity,
    };
  }
}

module.exports = DashboardService;
