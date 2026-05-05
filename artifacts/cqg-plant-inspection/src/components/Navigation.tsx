import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/inspections/start', label: 'Inspections', icon: '✓' },
  { href: '/work-orders', label: 'Work Orders', icon: '🔧' },
  { href: '/breakdowns/log', label: 'Breakdowns', icon: '⚠' },
  { href: '/assets', label: 'Assets', icon: '⚙', roles: ['ADMIN', 'SITE_MANAGER', 'MAINTENANCE'] },
  { href: '/reports/compliance', label: 'Reports', icon: '📊', roles: ['ADMIN', 'SITE_MANAGER', 'MAINTENANCE', 'READONLY'] },
  { href: '/admin/users', label: 'Admin', icon: '⚙', roles: ['ADMIN'] },
];

export default function Navigation() {
  const location = useLocation();
  const pathname = location.pathname;
  const { user, logout } = useAuth();

  if (!user) return null;

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-[#0a0a0a] text-[#f5f5f5] fixed top-0 left-0 z-40">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <img src="/cqg-logo.svg" alt="CQG" width={40} height={40} />
          <div>
            <div className="text-sm font-semibold leading-tight">CQG Plant</div>
            <div className="text-xs text-gray-400">Inspection System</div>
          </div>
        </div>

        <nav className="flex-1 py-4">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-[#dc2d2f] text-white'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <div className="text-xs text-gray-400 mb-1">{user.name}</div>
          <div className="text-xs text-gray-500 mb-3">{user.role}</div>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-white transition-colors py-1"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Bottom tab bar — mobile/tablet */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#e0e0e0] pb-safe">
        <div className="flex items-center justify-around">
          {visibleItems.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-2 min-h-[56px] text-xs font-medium transition-colors ${
                isActive(item.href)
                  ? 'text-[#dc2d2f]'
                  : 'text-gray-500'
              }`}
            >
              <span className="text-xl mb-0.5">{item.icon}</span>
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
