import { Routes, Route, Navigate } from 'react-router-dom';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import StartInspectionPage from './pages/StartInspectionPage';
import InspectionPage from './pages/InspectionPage';
import WorkOrdersPage from './pages/WorkOrdersPage';
import WorkOrderDetailPage from './pages/WorkOrderDetailPage';
import BreakdownsPage from './pages/BreakdownsPage';
import LogBreakdownPage from './pages/LogBreakdownPage';
import AssetsPage from './pages/AssetsPage';
import AssetDetailPage from './pages/AssetDetailPage';
import TrendsPage from './pages/TrendsPage';
import DashboardPage from './pages/DashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminTemplatesPage from './pages/admin/AdminTemplatesPage';
import AdminScansPage from './pages/admin/AdminScansPage';
import AdminPPMPage from './pages/admin/AdminPPMPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import CompliancePage from './pages/reports/CompliancePage';
import ReportFailuresPage from './pages/reports/ReportFailuresPage';
import ReportWorkOrdersPage from './pages/reports/ReportWorkOrdersPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/inspections/start" element={<StartInspectionPage />} />
      <Route path="/inspections/:id" element={<InspectionPage />} />
      <Route path="/work-orders" element={<WorkOrdersPage />} />
      <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
      <Route path="/breakdowns" element={<BreakdownsPage />} />
      <Route path="/breakdowns/log" element={<LogBreakdownPage />} />
      <Route path="/assets" element={<AssetsPage />} />
      <Route path="/assets/:id" element={<AssetDetailPage />} />
      <Route path="/trends" element={<TrendsPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/admin/users" element={<AdminUsersPage />} />
      <Route path="/admin/templates" element={<AdminTemplatesPage />} />
      <Route path="/admin/scans" element={<AdminScansPage />} />
      <Route path="/admin/ppm" element={<AdminPPMPage />} />
      <Route path="/admin/settings" element={<AdminSettingsPage />} />
      <Route path="/reports/compliance" element={<CompliancePage />} />
      <Route path="/reports/failures" element={<ReportFailuresPage />} />
      <Route path="/reports/work-orders" element={<ReportWorkOrdersPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
