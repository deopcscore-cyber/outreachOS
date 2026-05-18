import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/prospects', label: 'Prospects', icon: '⊕' },
  { to: '/campaigns', label: 'Campaigns', icon: '✉' },
  { to: '/outbox', label: 'Outbox', icon: '↑' },
  { to: '/warm-leads', label: 'Warm Leads', icon: '🔥' },
  { to: '/analytics', label: 'Analytics', icon: '↗' },
  { to: '/suppression', label: 'Suppression', icon: '⊘' },
  { to: '/settings', label: 'Settings', icon: '◎' },
];

export default function Layout({ children }) {
  const { userEmail, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col fixed inset-y-0 left-0 z-10" style={{ background: '#0f172a' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">O</div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">OutreachOS</p>
              <p className="text-slate-500 text-xs mt-0.5">Email Platform</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              <span className="text-base leading-none w-4 text-center flex-shrink-0">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/5">
          <p className="text-xs text-slate-500 truncate mb-2">{userEmail}</p>
          <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Sign out →
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-56 flex-1 min-h-screen">
        <div className="max-w-5xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
