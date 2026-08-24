import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserDto } from '@nest/shared-types';
import { apiRequest } from '../api-client/client';

// Simple auth context for Phase 0 — holds the authenticated user object
// returned by POST /auth/login or POST /auth/2fa/verify. Not persisted to
// localStorage (session is maintained server-side via HttpOnly cookie per
// ADR-005); refreshing the page while authenticated will require a
// /auth/me endpoint in a later phase to rehydrate this. For Phase 0, a
// page refresh sends the user back to login, which is acceptable.

interface AuthContextValue {
  user: UserDto | null;
  setUser: (user: UserDto | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ user: UserDto }>('/auth/me')
      .then(res => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
