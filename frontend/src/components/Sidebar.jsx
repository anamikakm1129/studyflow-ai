import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  MessageCircle,
  FileQuestion,
  CalendarDays,
  BookOpen,
  TrendingUp,
  Settings,
  LogOut
} from 'lucide-react'
import Logo from './Logo.jsx'
import Avatar from './ui/Avatar.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useProfile } from '../context/ProfileContext.jsx'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tutor', label: 'AI Tutor', icon: MessageCircle },
  { to: '/quiz', label: 'Quiz Generator', icon: FileQuestion },
  { to: '/planner', label: 'Study Planner', icon: CalendarDays },
  { to: '/subjects', label: 'My Subjects', icon: BookOpen },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/settings', label: 'Settings', icon: Settings }
]

export default function Sidebar({ isOpen, onNavigate }) {
  const { isAuthenticated, user, logout } = useAuth()
  const { classYear } = useProfile()

  // Always derived from the real, freshly-fetched backend user -- never from
  // a local cache -- so this can't ever show a previous account's name.
  const displayName = user?.full_name || user?.email || 'Not signed in'

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <Logo size={30} />
        <span className="sidebar-brand-text">StudyFlow AI</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Avatar name={displayName} />
        <div className="sidebar-footer-info">
          <span className="sidebar-footer-name">{displayName}</span>
          <span className="sidebar-footer-meta">{isAuthenticated ? classYear : 'Sign in to get started'}</span>
        </div>
        {isAuthenticated ? (
          <button className="sidebar-signout" onClick={logout} aria-label="Sign out">
            <LogOut size={17} />
          </button>
        ) : (
          <NavLink to="/login" className="sidebar-signin-link" onClick={onNavigate}>
            Sign in
          </NavLink>
        )}
      </div>
    </aside>
  )
}
