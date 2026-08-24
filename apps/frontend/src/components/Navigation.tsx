import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { UserRole } from '@nest/shared-types';
import { useAuth } from '../app/AuthContext';
import { apiRequest } from '../api-client/client';
import {
  LayoutDashboard,
  Package,
  MapPin,
  Library,
  Boxes,
  ClipboardList,
  FileX,
  FileText,
  Users,
  LogOut,
  User,
  Menu,
  X,
} from 'lucide-react';

export function NavigationLayout() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setLoggingOut(false);
      navigate('/login', { replace: true });
    }
  };

  const isAdmin = user && user.role === UserRole.ADMIN;

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Assets', path: '/assets', icon: Package },
    { label: 'Locations', path: '/locations', icon: MapPin },
    { label: 'Catalog', path: '/catalog', icon: Library },
    { label: 'Materials', path: '/materials', icon: Boxes },
    ...(isAdmin
      ? [
          { label: 'Inventory Requests', path: '/materials/requests', icon: ClipboardList },
          { label: 'Catalog Deletions', path: '/catalog/deletion-requests', icon: FileX },
          { label: 'Reports', path: '/reports', icon: FileText },
          { label: 'Users', path: '/admin/approvals', icon: Users },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 text-gray-900">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r flex-shrink-0 flex flex-col justify-between z-20">
        <div>
          {/* Logo / Brand Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <NavLink to="/dashboard" className="flex items-center gap-3">
              <img src="/assets/csat-logo.png" alt="CSAT Logo" className="h-10 w-10 object-contain" />
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-blue-600 leading-tight">NEST</span>
                <span className="text-[0.55rem] leading-none text-gray-500 uppercase tracking-widest mt-0.5">
                  Networked Equipment
                  <br />& Stock Tracker
                </span>
              </div>
            </NavLink>
            <div className="flex items-center gap-2 md:hidden">
              {user && (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-medium">
                  {user.role}
                </span>
              )}
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-md focus:outline-none"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Primary Nav Links */}
          <nav className={`p-3 space-y-1 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <item.icon size={18} className="flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Account / Footer */}
        {user && (
          <div className={`p-4 border-t bg-gray-50 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
            <NavLink
              to="/profile"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded mb-3 transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <User size={18} className="flex-shrink-0" />
              <span>My Profile</span>
            </NavLink>
            
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-3 truncate">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0 text-sm">
                  {user.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="truncate flex flex-col">
                  <span className="text-sm font-medium text-gray-900 truncate leading-tight">
                    {user.display_name}
                  </span>
                  <span className="text-xs text-gray-500 truncate leading-tight mt-0.5">
                    {user.email}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={loggingOut}
                onClick={handleLogout}
                className="text-gray-500 hover:text-red-600 transition-colors p-1.5 rounded hover:bg-red-50 flex-shrink-0"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
