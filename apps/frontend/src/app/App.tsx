import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ProtectedRoute, RequireRole } from './ProtectedRoute';
import { NavigationLayout } from '../components/Navigation';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { TwoFactorVerifyPage } from '../features/auth/TwoFactorVerifyPage';
import { TwoFactorEnrollPage } from '../features/auth/TwoFactorEnrollPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { LocationsPage } from '../features/locations/LocationsPage';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { CatalogDeletionRequestsPage } from '../features/catalog/CatalogDeletionRequestsPage';
import { MaterialsPage } from '../features/materials/MaterialsPage';
import { QuotationsPage } from '../features/quotations/QuotationsPage';
import { AssetsPage } from '../features/assets/AssetsPage';
import { AssetDetailPage } from '../features/assets/AssetDetailPage';
import { InventoryRequestsPage } from '../features/materials/InventoryRequestsPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { ApprovalsPage } from '../features/admin/ApprovalsPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { UserRole } from '@nest/shared-types';

function ThemeManager() {
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) {
      // Force dark mode on auth pages
      document.documentElement.classList.add('dark');
    } else {
      // Authenticated - apply user preference, default to dark
      const pref = localStorage.getItem('theme-preference');
      if (pref === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    }
  }, [user]);

  return null;
}

export function App() {
  return (
    <AuthProvider>
      <ThemeManager />
      <BrowserRouter>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login/2fa" element={<TwoFactorVerifyPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Authenticated routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<NavigationLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/locations" element={<LocationsPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/materials" element={<MaterialsPage />} />
              <Route path="/quotations" element={<QuotationsPage />} />
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
