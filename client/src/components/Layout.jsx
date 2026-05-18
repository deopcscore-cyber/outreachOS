import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const workspaceNav = [
  { to: '/', label: 'Dashboard', icon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  )},
  { to: '/prospects', label: 'Prospects', icon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="9" cy="7" r="4"/><path d="M2 21a7 7 0 0114 0"/><path d="M19 7v6m3-3h-6" strokeLinecap="round"/>
    </svg>
  )},
  { to: '/campaigns', label: 'Campaigns', icon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  { to: '/outbox', label: 'Outbox', icon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  { to: '/warm-leads', label: 'Warm Leads', icon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  { to: '/analytics', label: 'Analytics', icon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
];

const accountNav = [
  { to: '/suppression', label: 'Suppression', icon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" strokeLinecap="round"/>
    </svg>
  )},
  { to: '/settings', label: 'Settings', icon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
];

function NavItem({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? 'bg-white/10 text-white'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`
      }
    >
      <span className="flex-shrink-0 opacity-80">{icon}</span>
      {label}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { userEmail, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = userEmail ? userEmail.charAt(0).toUpperCase() : '?';

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
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          <div>
            <p className="px-3 mb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Workspace</p>
            <div className="space-y-0.5">
              {workspaceNav.map(item => <NavItem key={item.to} {...item} />)}
            </div>
          </div>
          <div>
            <p className="px-3 mb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Account</p>
            <div className="space-y-0.5">
              {accountNav.map(item => <NavItem key={item.to} {...item} />)}
            </div>
          </div>
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/5 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-300 truncate">{userEmail}</p>
            <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-56 flex-1 min-h-screen">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
