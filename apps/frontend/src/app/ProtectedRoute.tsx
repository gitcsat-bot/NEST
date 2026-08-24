import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { UserRole, roleAtLeast } from '@nest/shared-types';
import { useAuth } from './AuthContext';

// Guards authenticated routes — renders children via <Outlet> if a user is
// present in context, otherwise redirects to /login. `replace` prevents the
// /login page from appearing in the back-navigation history.
export function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

// UX-only role gate for routes like Reports/Approvals — mirrors the
// inline `canCreate`/`canDelete` checks other pages already do (see
// CatalogPage.tsx), just applied at the route level for pages that are
// entirely role-restricted rather than having role-restricted controls
// within an otherwise-shared page. The backend's @Roles()/RolesGuard is
// the actual authorization boundary; this only avoids rendering a page
// that would 403 on every request.
export function RequireRole({ minRole }: { minRole: UserRole }) {
  const { user } = useAuth();

  if (!user || !roleAtLeast(user.role as UserRole, minRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
