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
  Moon,
  Sun,
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
    { label: 'Quotations', path: '/quotations', icon: FileText },
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
    <div className="min-h-screen flex flex-col md:flex-row bg-transparent text-gray-900">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 flex-shrink-0 flex flex-col justify-between z-20 neu-flat m-2 md:m-4 rounded-xl overflow-hidden">
        <div>
          {/* Logo / Brand Header */}
          <div className="p-4 flex items-center justify-between pb-6">
            <NavLink to="/dashboard" className="flex items-center gap-3">
              <img src="/assets/csat-logo.png" alt="CSAT Logo" className="h-10 w-10 object-contain drop-shadow-md hidden dark:block" />
              <img src="/assets/csat-logo-dark.png" alt="CSAT Logo Dark" className="h-10 w-10 object-contain drop-shadow-md dark:hidden" />
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-blue-600 leading-tight drop-shadow-sm">NEST</span>
                <span className="text-[0.55rem] leading-none text-gray-500 uppercase tracking-widest mt-0.5">
                  Networked Equipment
                  <br />& Stock Tracker
                </span>
              </div>
            </NavLink>
            <div className="flex items-center gap-2 md:hidden">
              {user && (
                <span className="text-xs px-2 py-0.5 rounded neu-inset text-blue-800 font-mono font-medium">
                  {user.role}
                </span>
              )}
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-gray-600 neu-button rounded-md focus:outline-none"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Primary Nav Links */}
          <nav className={`px-4 pb-4 space-y-3 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                    isActive
                      ? 'neu-inset text-blue-700 font-bold'
                      : 'text-gray-600 hover:text-blue-600 neu-button'
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
          <div className={`p-4 mt-auto ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
            <NavLink
              to="/profile"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl mb-4 transition-all ${
                  isActive ? 'neu-inset text-blue-700' : 'text-gray-600 hover:text-blue-600 neu-button'
                }`
              }
            >
              <User size={18} className="flex-shrink-0" />
              <span>My Profile</span>
            </NavLink>
            
            <div className="flex items-center justify-between gap-2 px-2 py-2 neu-inset rounded-xl">
              <div className="flex items-center gap-3 truncate">
                <div className="w-8 h-8 rounded-full neu-flat flex items-center justify-center font-bold flex-shrink-0 text-sm text-blue-600">
                  {user.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="truncate flex flex-col">
                  <span className="text-sm font-semibold text-gray-700 truncate leading-tight">
                    {user.display_name}
                  </span>
                  <span className="text-xs text-gray-500 truncate leading-tight mt-0.5">
                    {user.email}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const isDark = document.documentElement.classList.contains('dark');
                    if (isDark) {
                      document.documentElement.classList.remove('dark');
                      localStorage.setItem('theme-preference', 'light');
                    } else {
                      document.documentElement.classList.add('dark');
                      localStorage.setItem('theme-preference', 'dark');
                    }
                  }}
                  className="text-gray-500 hover:text-blue-600 transition-colors p-2 rounded-xl neu-button flex-shrink-0"
                  title="Toggle Theme"
                >
                  <Moon size={16} className="block dark:hidden" />
                  <Sun size={16} className="hidden dark:block" />
                </button>

                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-red-600 transition-colors p-2 rounded-xl neu-button flex-shrink-0"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto min-h-screen p-2 md:p-4">
        <Outlet />
      </main>
    </div>
  );
}

