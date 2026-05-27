/**
 * XMLiquidity — Admin Panel Layout
 * Separate sidebar for admin with all management sections.
 */

import { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const adminNavItems = [
  { path: '/admin/users', label: 'BROKERS', icon: 'users' },
  { path: '/admin/transactions', label: 'DEPOSITS / WITHDRAWALS', icon: 'money' },
  { path: '/admin/trades', label: 'TRADES', icon: 'chart' },
  { path: '/admin/risk', label: 'RISK', icon: 'shield' },
  { path: '/admin/charges', label: 'CHARGES', icon: 'tag' },
  { path: '/admin/audit', label: 'AUDIT LOG', icon: 'log' },
]

const icons = {
  grid: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  money: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5"/></svg>,
  chart: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  shield: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  list: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  tag: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  trophy: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>,
  copy: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  fire: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>,
  network: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="14"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/><line x1="12" y1="14" x2="6" y2="16"/><line x1="12" y1="14" x2="18" y2="16"/></svg>,
  log: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  back: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    await logout()
    window.location.href = '/signin'
  }

  return (
    <div className={`dash ${collapsed ? 'dash--collapsed' : ''}`}>
      <aside className="dash__sidebar dash__sidebar--admin">
        <div className="dash__sidebar-header">
          <Link to="/admin" className="dash__logo">
            {collapsed ? 'X' : 'XM'}
            <span className="dash__logo-accent">{collapsed ? 'L' : 'LIQUIDITY'}</span>
            {!collapsed && <span className="dash__admin-badge">ADMIN</span>}
          </Link>
          <button className="dash__collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
            </svg>
          </button>
        </div>

        <nav className="dash__nav">
          <Link to="/dashboard" className="dash__nav-item dash__nav-item--back" title="USER DASHBOARD">
            <span className="dash__nav-icon">{icons.back}</span>
            {!collapsed && <span className="dash__nav-label">USER DASHBOARD</span>}
          </Link>

          {adminNavItems.map((item) => (
            <Link key={item.path} to={item.path} title={item.label}
              className={`dash__nav-item ${location.pathname === item.path ? 'dash__nav-item--active' : ''}`}>
              <span className="dash__nav-icon">{icons[item.icon]}</span>
              {!collapsed && <span className="dash__nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="dash__sidebar-footer">
          <button className="dash__nav-item dash__logout-btn" onClick={handleLogout}>
            <span className="dash__nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </span>
            {!collapsed && <span className="dash__nav-label">LOGOUT</span>}
          </button>
        </div>
      </aside>

      <div className="dash__main">
        <header className="dash__topbar dash__topbar--admin">
          <div className="dash__topbar-left">
            <h1 className="dash__page-title">
              {adminNavItems.find((i) => i.path === location.pathname)?.label || 'ADMIN PANEL'}
            </h1>
          </div>
          <div className="dash__topbar-right">
            <div className="dash__user-info">
              <div className="dash__user-avatar" style={{ borderColor: '#ff5050' }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="dash__user-details">
                <span className="dash__user-name">{user?.name || 'Admin'}</span>
                <span className="dash__user-role" style={{ color: '#ff5050' }}>{user?.role?.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="dash__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
