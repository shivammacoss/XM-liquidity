/**
 * XMLiquidity — Dashboard Layout
 * Sidebar + Topbar wrapper for all dashboard pages.
 */

import { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import NotificationBell from '../NotificationBell'

const userNavItems = [
  { path: '/dashboard', label: 'DASHBOARD', icon: 'grid' },
  { path: '/dashboard/accounts', label: 'LIQUIDITY ACCOUNT', icon: 'wallet' },
  { path: '/dashboard/api-access', label: 'API / WEBHOOK', icon: 'plug' },
  { path: '/dashboard/orders', label: 'TRADES', icon: 'list' },
  { path: '/dashboard/wallet', label: 'WALLET', icon: 'coins' },
  { path: '/dashboard/profile', label: 'PROFILE', icon: 'user' },
]

const icons = {
  grid: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  wallet: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  chart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  list: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  coins: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v12" /><path d="M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5" />
    </svg>
  ),
  trophy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6" /><path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
      <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <path d="M18 2H6v7a6 6 0 0012 0V2z" />
    </svg>
  ),
  copy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  bot: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  ),
  fire: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
    </svg>
  ),
  network: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="5" r="3" /><line x1="12" y1="8" x2="12" y2="14" />
      <circle cx="6" cy="19" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="12" y1="14" x2="6" y2="16" /><line x1="12" y1="14" x2="18" y2="16" />
    </svg>
  ),
  user: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  plug: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 2v6" /><path d="M15 2v6" /><path d="M6 8h12v4a6 6 0 01-12 0V8z" /><path d="M12 18v4" />
    </svg>
  ),
}

const primaryMobileNav = [
  { path: '/dashboard', label: 'Home', icon: 'grid' },
  { path: '/dashboard/accounts', label: 'Accounts', icon: 'wallet' },
  { path: '/dashboard/orders', label: 'Orders', icon: 'list' },
  { path: '/dashboard/wallet', label: 'Wallet', icon: 'coins' },
]

const moreMobileItems = [
  { path: '/dashboard/profile', label: 'Profile', icon: 'user' },
]

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    window.location.href = '/signin'
  }

  return (
    <div className={`dash ${sidebarCollapsed ? 'dash--collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className="dash__sidebar">
        <div className="dash__sidebar-header">
          <Link to="/" className="dash__logo">
            {sidebarCollapsed ? (
              <img src="/favicon.svg" alt="ST" width="28" height="28" style={{ borderRadius: 6 }} />
            ) : (
              <>XM<span className="dash__logo-accent">LIQUIDITY</span></>
            )}
          </Link>
          <button
            className="dash__collapse-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed
                ? <polyline points="9 18 15 12 9 6" />
                : <polyline points="15 18 9 12 15 6" />
              }
            </svg>
          </button>
        </div>

        <nav className="dash__nav">
          {userNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`dash__nav-item ${location.pathname === item.path ? 'dash__nav-item--active' : ''}`}
              title={item.label}
            >
              <span className="dash__nav-icon">{icons[item.icon]}</span>
              {!sidebarCollapsed && <span className="dash__nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="dash__sidebar-footer">
          <button className="dash__nav-item dash__logout-btn" onClick={handleLogout}>
            <span className="dash__nav-icon">{icons.logout}</span>
            {!sidebarCollapsed && <span className="dash__nav-label">LOGOUT</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="dash__main">
        {/* Topbar */}
        <header className="dash__topbar">
          <div className="dash__topbar-left">
            <h1 className="dash__page-title">
              {userNavItems.find((i) => i.path === location.pathname)?.label || 'DASHBOARD'}
            </h1>
          </div>
          <div className="dash__topbar-right">
            <NotificationBell />
            <div className="dash__user-info">
              <div className="dash__user-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              {!sidebarCollapsed && (
                <div className="dash__user-details">
                  <span className="dash__user-name">{user?.name || 'User'}</span>
                  <span className="dash__user-role">{user?.role?.toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="dash__content">
          <Outlet />
        </main>
      </div>

      {/* === MOBILE BOTTOM NAV === */}
      <nav className="dash-mnav" aria-label="Primary">
        {primaryMobileNav.map((item) => {
          const active = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`dash-mnav__item ${active ? 'dash-mnav__item--active' : ''}`}
            >
              <span className="dash-mnav__icon">{icons[item.icon]}</span>
              <span className="dash-mnav__label">{item.label}</span>
            </Link>
          )
        })}
        <button
          className={`dash-mnav__item ${moreOpen ? 'dash-mnav__item--active' : ''}`}
          onClick={() => setMoreOpen(true)}
          aria-label="More"
        >
          <span className="dash-mnav__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
            </svg>
          </span>
          <span className="dash-mnav__label">More</span>
        </button>
      </nav>

      {/* === MOBILE MORE DRAWER === */}
      {moreOpen && (
        <>
          <div className="dash-msheet__backdrop" onClick={() => setMoreOpen(false)} />
          <div className="dash-msheet" role="dialog" aria-label="More">
            <div className="dash-msheet__handle" />
            <div className="dash-msheet__title">MORE</div>
            <div className="dash-msheet__grid">
              {moreMobileItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="dash-msheet__item"
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="dash-msheet__icon">{icons[item.icon]}</span>
                  <span className="dash-msheet__label">{item.label}</span>
                </Link>
              ))}
            </div>
            <button
              className="dash-msheet__logout"
              onClick={() => { setMoreOpen(false); handleLogout() }}
            >
              <span className="dash-msheet__icon">{icons.logout}</span>
              <span>LOGOUT</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
