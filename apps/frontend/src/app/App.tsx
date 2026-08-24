import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { ProtectedRoute, RequireRole } from './ProtectedRoute';
import { NavigationLayout } from '../components/Navigation';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { TwoFactorVerifyPage } from '../features/auth/TwoFactorVerifyPage';
import { TwoFactorEnrollPage } from '../features/auth/TwoFactorEnrollPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage';
import { DeactivatedPage } from '../features/auth/DeactivatedPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { LocationsPage } from '../features/locations/LocationsPage';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { CatalogDeletionRequestsPage } from '../features/catalog/CatalogDeletionRequestsPage';
import { MaterialsPage } from '../features/materials/MaterialsPage';
import { AssetsPage } from '../features/assets/AssetsPage';
import { AssetDetailPage } from '../features/assets/AssetDetailPage';
import { InventoryRequestsPage } from '../features/materials/InventoryRequestsPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { ApprovalsPage } from '../features/admin/ApprovalsPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { UserRole } from '@nest/shared-types';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login/2fa" element={<TwoFactorVerifyPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/deactivated" element={<DeactivatedPage />} />

          {/* Authenticated routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<NavigationLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/locations" element={<LocationsPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/materials" element={<MaterialsPage />} />
              <Route path="/assets" element={<AssetsPage />} />
              <Route path="/assets/:id" element={<AssetDetailPage />} />
              <Route path="/2fa/enroll" element={<TwoFactorEnrollPage />} />

              {/* Admin-only screens */}
              <Route element={<RequireRole minRole={UserRole.ADMIN} />}>
                <Route path="/materials/requests" element={<InventoryRequestsPage />} />
                <Route path="/catalog/deletion-requests" element={<CatalogDeletionRequestsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/admin/approvals" element={<ApprovalsPage />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
