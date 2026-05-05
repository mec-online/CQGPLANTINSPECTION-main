import { useAuth } from '@/context/AuthContext';
import { useGps } from '@/context/GpsContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useEffect, useState, ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { href: '/',                   label: 'Home' },
  { href: '/inspections/start',  label: 'Inspections' },
  { href: '/work-orders',        label: 'Work Orders' },
  { href: '/breakdowns',         label: 'Breakdowns' },
  { href: '/assets',             label: 'Assets',    roles: ['SITE_MANAGER', 'MAINTENANCE', 'ADMIN'] },
  { href: '/trends',             label: 'Trends' },
  { href: '/admin/templates',    label: 'Templates', roles: ['SITE_MANAGER', 'ADMIN'] },
  { href: '/dashboard',          label: 'Dashboard', roles: ['SITE_MANAGER', 'MAINTENANCE', 'ADMIN', 'READONLY'] },
  { href: '/admin/scans',        label: 'Scan Log',  roles: ['SITE_MANAGER', 'ADMIN'] },
  { href: '/admin/users',        label: 'Admin',     roles: ['ADMIN'] },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const { status: gpsStatus } = useGps();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const visibleNav = navItems.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-brand-800 shadow-md">
        <div className="flex items-center gap-3 px-4 py-2.5 max-w-7xl mx-auto">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <img
              src="/logo-white.png"
              alt="Cymru Quarry Group"
              className="h-9 w-auto"
            />
          </Link>

          <div className="hidden sm:flex items-center gap-2">
            <div className="w-px h-6 bg-white/20" />
            <span className="text-brand-200 text-sm font-medium">Plant Inspection</span>
          </div>

          <div className="flex-1" />

          {/* User info + sign out */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 text-brand-200 text-sm">
              <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-xs font-semibold text-white">
                {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </span>
              <span>{user.name}</span>
              <span className="text-brand-300 text-xs ml-1">({user.role.replace('_', ' ')})</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-brand-200 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              Sign out
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="lg:hidden text-white p-1.5 rounded-lg hover:bg-white/10"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        {/* Desktop navigation tabs */}
        <nav className="hidden lg:flex border-t border-white/10 px-4 max-w-7xl mx-auto">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                  ? 'text-white border-white'
                  : 'text-brand-200 border-transparent hover:text-white hover:border-white/40'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile nav dropdown */}
        {menuOpen && (
          <nav className="lg:hidden border-t border-white/10 pb-2">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-6 py-3 text-sm font-medium ${
                  pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                    ? 'text-white bg-white/10'
                    : 'text-brand-200 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      {/* GPS denied overlay */}
      {gpsStatus === 'denied' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/95 px-6 text-center">
          <div className="text-5xl mb-4">📍</div>
          <h2 className="text-xl font-bold text-white mb-2">Location Access Required</h2>
          <p className="text-gray-300 text-sm mb-6 max-w-xs">
            This app requires GPS location for all inspections. Location access has been denied.
            Please enable it in your browser or device settings, then reload the page.
          </p>
          <div className="bg-white/10 rounded-xl p-4 text-left text-sm text-gray-300 mb-6 w-full max-w-xs">
            <p className="font-semibold text-white mb-2">To fix this:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open your browser settings</li>
              <li>Find &ldquo;Site permissions&rdquo; or &ldquo;Location&rdquo;</li>
              <li>Allow location for this site</li>
              <li>Reload the page</li>
            </ol>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Reload Page
          </button>
        </div>
      )}
    </div>
  );
}
