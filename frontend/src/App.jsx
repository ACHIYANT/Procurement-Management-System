import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import Login from "./pages/Login";
import ActivateAccount from "./pages/ActivateAccount";
import Dashboard from "./pages/Dashboard";
import WorkDesk from "./pages/WorkDesk";
import EmdManagement from "./pages/EmdManagement";
import EmdList from "./pages/EmdList";
import PbgList from "./pages/PbgList";
import EmdEdit from "./pages/EmdEdit";
import DepartmentFundForm from "./pages/DepartmentFundForm";
import DepartmentFundList from "./pages/DepartmentFundList";
import PbgEdit from "./pages/PbgEdit";
import Reconciliation from "./pages/Reconciliation";
import ReconciliationDepartmentDetail from "./pages/ReconciliationDepartmentDetail";
import Reports from "./pages/Reports";
import FirmList from "./pages/FirmList";
import FirmForm from "./pages/FirmForm";
import EmpanelmentList from "./pages/EmpanelmentList";
import EmpanelmentForm from "./pages/EmpanelmentForm";
import EmpanelmentDetail from "./pages/EmpanelmentDetail";
import ItemCategoryMaster from "./pages/ItemCategoryMaster";
import TenderList from "./pages/TenderList";
import TenderForm from "./pages/TenderForm";
import TenderDetail from "./pages/TenderDetail";
import PurchaseOrderList from "./pages/PurchaseOrderList";
import PurchaseOrderDetail from "./pages/PurchaseOrderDetail";
import PbgFromPo from "./pages/PbgFromPo";
import IndentList from "./pages/IndentList";
import IndentForm from "./pages/IndentForm";
import IndentDetail from "./pages/IndentDetail";
import ProcurementCaseList from "./pages/ProcurementCaseList";
import ProcurementCaseForm from "./pages/ProcurementCaseForm";
import ProcurementCaseDetail from "./pages/ProcurementCaseDetail";
import CommitteeList from "./pages/CommitteeList";
import CommitteeForm from "./pages/CommitteeForm";
import CommitteeDetail from "./pages/CommitteeDetail";
import CommitteeAttendanceReport from "./pages/CommitteeAttendanceReport";
import Administration from "./pages/Administration";
import ApprovalCenter from "./pages/ApprovalCenter";
import ProcurementEmployeeForm from "./pages/ProcurementEmployeeForm";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./auth/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/activate-account" element={<ActivateAccount />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<ProtectedRoute moduleKey="dashboard"><Dashboard /></ProtectedRoute>} />
            <Route path="/my-work" element={<ProtectedRoute moduleKey="workTasks"><WorkDesk /></ProtectedRoute>} />
            <Route path="/emd" element={<ProtectedRoute moduleKey="emd"><EmdList /></ProtectedRoute>} />
            <Route path="/emd/new" element={<ProtectedRoute moduleKey="emd" action="create"><EmdManagement /></ProtectedRoute>} />
            <Route path="/emd/:id/edit" element={<ProtectedRoute moduleKey="emd" action="manage"><EmdEdit /></ProtectedRoute>} />
            <Route path="/pbg" element={<ProtectedRoute moduleKey="pbg"><PbgList /></ProtectedRoute>} />
            <Route path="/pbg/new" element={<Navigate to="/purchase-orders" replace />} />
            <Route path="/pbg/:id/edit" element={<ProtectedRoute moduleKey="pbg" action="manage"><PbgEdit /></ProtectedRoute>} />
            <Route path="/department-funds" element={<ProtectedRoute moduleKey="departmentFunds"><DepartmentFundList /></ProtectedRoute>} />
            <Route path="/department-funds/new" element={<ProtectedRoute moduleKey="departmentFunds" action="create"><DepartmentFundForm /></ProtectedRoute>} />
            <Route path="/reconciliation" element={<ProtectedRoute moduleKey="reconciliation"><Reconciliation /></ProtectedRoute>} />
            <Route path="/reconciliation/:departmentName" element={<ProtectedRoute moduleKey="reconciliation"><ReconciliationDepartmentDetail /></ProtectedRoute>} />
            <Route path="/indents" element={<ProtectedRoute moduleKey="indents"><IndentList /></ProtectedRoute>} />
            <Route path="/indents/new" element={<ProtectedRoute moduleKey="indents" action="create"><IndentForm /></ProtectedRoute>} />
            <Route path="/indents/:id" element={<ProtectedRoute moduleKey="indents"><IndentDetail /></ProtectedRoute>} />
            <Route path="/procurement-cases" element={<ProtectedRoute moduleKey="procurementCases"><ProcurementCaseList /></ProtectedRoute>} />
            <Route path="/procurement-cases/new" element={<ProtectedRoute moduleKey="procurementCases" action="create" allowAdminOverride={false}><ProcurementCaseForm /></ProtectedRoute>} />
            <Route path="/procurement-cases/:id" element={<ProtectedRoute moduleKey="procurementCases"><ProcurementCaseDetail /></ProtectedRoute>} />
            <Route path="/tenders" element={<ProtectedRoute moduleKey="tenders"><TenderList /></ProtectedRoute>} />
            <Route path="/tenders/new" element={<ProtectedRoute moduleKey="tenders" action="create"><TenderForm /></ProtectedRoute>} />
            <Route path="/tenders/:id" element={<ProtectedRoute moduleKey="tenders"><TenderDetail /></ProtectedRoute>} />
            <Route path="/tenders/:tenderId/inspection-delivery/:poId" element={<ProtectedRoute moduleKey="tenders"><PurchaseOrderDetail workflowStage="inspection_delivery" /></ProtectedRoute>} />
            <Route path="/tenders/:tenderId/installation/:poId" element={<ProtectedRoute moduleKey="tenders"><PurchaseOrderDetail workflowStage="installation" /></ProtectedRoute>} />
            <Route path="/tenders/:tenderId/seller-invoice/:poId" element={<ProtectedRoute moduleKey="tenders"><PurchaseOrderDetail workflowStage="seller_invoice" /></ProtectedRoute>} />
            <Route path="/tenders/:tenderId/purchase-invoice/:poId" element={<ProtectedRoute moduleKey="tenders"><PurchaseOrderDetail workflowStage="purchase_invoice" /></ProtectedRoute>} />
            <Route path="/tenders/:tenderId/sale-invoice/:poId" element={<ProtectedRoute moduleKey="tenders"><PurchaseOrderDetail workflowStage="sale_invoice" /></ProtectedRoute>} />
            <Route path="/tenders/:tenderId/vendor-payment/:poId" element={<ProtectedRoute moduleKey="tenders"><PurchaseOrderDetail workflowStage="vendor_payment" /></ProtectedRoute>} />
            <Route path="/committees" element={<ProtectedRoute moduleKey="committees"><CommitteeList /></ProtectedRoute>} />
            <Route path="/committees/new" element={<ProtectedRoute moduleKey="committees" action="create" allowAdminOverride={false}><CommitteeForm /></ProtectedRoute>} />
            <Route path="/committees/:id" element={<ProtectedRoute moduleKey="committees"><CommitteeDetail /></ProtectedRoute>} />
            <Route path="/committees/reports/member-attendance" element={<ProtectedRoute moduleKey="committees"><CommitteeAttendanceReport /></ProtectedRoute>} />
            <Route path="/purchase-orders" element={<ProtectedRoute moduleKey="purchaseOrders"><PurchaseOrderList /></ProtectedRoute>} />
            <Route path="/purchase-orders/:id" element={<ProtectedRoute moduleKey="purchaseOrders"><PurchaseOrderDetail /></ProtectedRoute>} />
            <Route path="/purchase-orders/:id/inspection-delivery" element={<ProtectedRoute moduleKey="purchaseOrders"><PurchaseOrderDetail workflowStage="inspection_delivery" /></ProtectedRoute>} />
            <Route path="/purchase-orders/:id/installation" element={<ProtectedRoute moduleKey="purchaseOrders"><PurchaseOrderDetail workflowStage="installation" /></ProtectedRoute>} />
            <Route path="/purchase-orders/:id/seller-invoice" element={<ProtectedRoute moduleKey="purchaseOrders"><PurchaseOrderDetail workflowStage="seller_invoice" /></ProtectedRoute>} />
            <Route path="/purchase-orders/:id/purchase-invoice" element={<ProtectedRoute moduleKey="purchaseOrders"><PurchaseOrderDetail workflowStage="purchase_invoice" /></ProtectedRoute>} />
            <Route path="/purchase-orders/:id/sale-invoice" element={<ProtectedRoute moduleKey="purchaseOrders"><PurchaseOrderDetail workflowStage="sale_invoice" /></ProtectedRoute>} />
            <Route path="/purchase-orders/:id/vendor-payment" element={<ProtectedRoute moduleKey="purchaseOrders"><PurchaseOrderDetail workflowStage="vendor_payment" /></ProtectedRoute>} />
            <Route path="/purchase-orders/:id/pbg/new" element={<ProtectedRoute moduleKey="purchaseOrders" action="managePbg"><PbgFromPo /></ProtectedRoute>} />
            <Route path="/firms" element={<ProtectedRoute moduleKey="firms"><FirmList /></ProtectedRoute>} />
            <Route path="/firms/new" element={<ProtectedRoute moduleKey="firms" action="create"><FirmForm /></ProtectedRoute>} />
            <Route path="/empanelments" element={<ProtectedRoute moduleKey="empanelments"><EmpanelmentList /></ProtectedRoute>} />
            <Route path="/empanelments/new" element={<ProtectedRoute moduleKey="empanelments" action="create"><EmpanelmentForm /></ProtectedRoute>} />
            <Route path="/empanelments/:id" element={<ProtectedRoute moduleKey="empanelments"><EmpanelmentDetail /></ProtectedRoute>} />
            <Route path="/item-categories" element={<ProtectedRoute moduleKey="itemCategories"><ItemCategoryMaster /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute moduleKey="reports"><Reports /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute moduleKey="approvals"><ApprovalCenter /></ProtectedRoute>} />
            <Route path="/administration" element={<ProtectedRoute moduleKey="administration"><Administration /></ProtectedRoute>} />
            <Route path="/administration/procurement-employees/new" element={<ProtectedRoute moduleKey="administration" action="manage"><ProcurementEmployeeForm /></ProtectedRoute>} />
            <Route path="/administration/procurement-employees/:id/edit" element={<ProtectedRoute moduleKey="administration" action="manage"><ProcurementEmployeeForm /></ProtectedRoute>} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
