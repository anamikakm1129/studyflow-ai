import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar.jsx'
import Logo from './Logo.jsx'

export default function Layout({ children }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-shell">
      <div className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Logo size={24} />
          <span className="sidebar-brand-text" style={{ fontSize: '16px' }}>
            StudyFlow AI
          </span>
        </div>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>
      </div>

      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sidebar isOpen={isSidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      <main className="app-main">{children}</main>
    </div>
  )
}
