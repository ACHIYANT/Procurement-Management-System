const DashboardRepository = require("../repository/dashboard-repository");

class DashboardService {
  constructor() {
    this.repository = new DashboardRepository();
  }

  async getSummary(query = {}) {
    const scopeIds = await this.repository.resolveDashboardScope(query);
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
      this.repository.getOverviewCounts(scopeIds),
      this.repository.getValueMetrics(scopeIds),
      this.repository.getIndentMetrics(scopeIds),
      this.repository.getProcurementCaseMetrics(scopeIds),
      this.repository.getTenderAttentionMetrics(scopeIds),
      this.repository.getEmdMetrics(scopeIds),
      this.repository.getPurchaseOrderAndPbgMetrics(scopeIds),
      this.repository.getEmpanelmentMetrics(scopeIds),
      this.repository.getRecentActivity(scopeIds),
    ]);

    return {
      generated_at: new Date().toISOString(),
      scope: scopeIds ? "user" : "global",
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
