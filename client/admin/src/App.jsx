/**
 * XMLiquidity Admin — Separate App
 * Runs on admin.xmliquidity.com (port 5174 locally)
 * Has its own login page — only admin/sub-admin can access.
 */

import { BrowserRouter, Routes, Route, useLocation, Navigate, Link, Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useAuth } from './hooks/useAuth'
import { restoreTokens } from './services/api'
import { fetchCurrentUser } from './store/authSlice'

// Admin Pages
import AdminDashboard from './pages/AdminDashboard'
import AdminUsers from './pages/AdminUsers'
import AdminTransactions from './pages/AdminTransactions'
import AdminTrades from './pages/AdminTrades'
import AdminRisk from './pages/AdminRisk'
import AdminInstruments from './pages/AdminInstruments'
import AdminCharges from './pages/AdminCharges'
import AdminProp from './pages/AdminProp'
import AdminCopyTrading from './pages/AdminCopyTrading'
import AdminChallenges from './pages/AdminChallenges'
import AdminIB from './pages/AdminIB'
import AdminAudit from './pages/AdminAudit'
import AdminPaymentSettings from './pages/AdminPaymentSettings'
import AdminSignupRequests from './pages/AdminSignupRequests'
import AdminNotificationBell from './components/AdminNotificationBell'

// --- Admin Login Page ---
function AdminLogin() {
  const { login, isLoading, error, clearAuthError, isAuthenticated, user } = useAuth()
  const [loginError, setLoginError] = useState('')
  const navigate = useNavigate()

  // If already logged in as admin, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && user && (user.role === 'super_admin' || user.role === 'sub_admin')) {
      navigate('/')
    }
  }, [isAuthenticated, user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearAuthError()
    setLoginError('')
    const formData = new FormData(e.target)
    const result = await login({
      email: formData.get('email'),
      password: formData.get('password'),
    })
    if (result.error) {
      setLoginError(result.payload || 'Login failed')
    } else {
      const u = result.payload?.user
      if (u && u.role !== 'super_admin' && u.role !== 'sub_admin') {
        setLoginError('Access denied. Admin credentials required.')
      } else {
        navigate('/')
      }
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <div className="admin-login__logo">
          XM<span className="admin-login__logo-accent">LIQUIDITY</span>
          <span className="admin-login__badge">ADMIN</span>
        </div>
        <h1 className="admin-login__title">ADMIN PANEL</h1>
        <p className="admin-login__subtitle">Enter your admin credentials</p>

        {(error || loginError) && <div className="auth-form__error">{loginError || error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__group">
            <label className="auth-form__label">EMAIL</label>
            <input name="email" type="email" className="auth-form__input" placeholder="admin@xmliquidity.com" required autoComplete="email" />
          </div>
          <div className="auth-form__group">
            <label className="auth-form__label">PASSWORD</label>
            <input name="password" type="password" className="auth-form__input" placeholder="Admin password" required autoComplete="current-password" />
          </div>
          <button type="submit" className="laser-btn" style={{ width: '100%', background: '#ff5050', boxShadow: '0 0 20px rgba(255,50,50,0.3)' }} disabled={isLoading}>
            {isLoading ? 'SIGNING IN...' : 'ADMIN SIGN IN'}
          </button>
        </form>
      </div>
    </div>
  )
}

// --- Admin Protected Route ---
function AdminProtected({ children }) {
  const { isAuthenticated, user, isLoading } = useSelector((state) => state.auth)

  if (isLoading) {
    return <div className="auth-loading"><div className="auth-loading__spinner" /></div>
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user && user.role !== 'super_admin' && user.role !== 'sub_admin') {
    return <Navigate to="/login" replace />
  }

  return children
}

// --- SVG Icons (same stroke style as user dashboard) ---
const svgIcon = (paths) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
)

const icons = {
  dashboard: svgIcon(<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>),
  users: svgIcon(<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>),
  transactions: svgIcon(<><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5"/></>),
  trades: svgIcon(<><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>),
  risk: svgIcon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>),
  instruments: svgIcon(<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>),
  charges: svgIcon(<><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>),
  prop: svgIcon(<><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></>),
  copy: svgIcon(<><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>),
  challenges: svgIcon(<><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></>),
  ib: svgIcon(<><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="14"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/><line x1="12" y1="14" x2="6" y2="16"/><line x1="12" y1="14" x2="18" y2="16"/></>),
  audit: svgIcon(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>),
  logout: svgIcon(<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>),
}

const navItems = [
  { path: '/signup-requests', label: 'SIGNUP REQUESTS', icon: 'users' },
  { path: '/users', label: 'BROKERS', icon: 'users' },
  { path: '/transactions', label: 'DEPOSITS / WITHDRAWALS', icon: 'transactions' },
  { path: '/trades', label: 'TRADES', icon: 'trades' },
  { path: '/risk', label: 'RISK', icon: 'risk' },
  { path: '/charges', label: 'CHARGES', icon: 'charges' },
  { path: '/payment-settings', label: 'PAYMENT ADDRESSES', icon: 'transactions' },
  { path: '/audit', label: 'AUDIT LOG', icon: 'audit' },
]

function AdminLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  return (
    <div className={`dash ${collapsed ? 'dash--collapsed' : ''}`}>
      <aside className="dash__sidebar">
        <div className="dash__sidebar-header">
          <span className="dash__logo">
            {collapsed ? (
              <img src="/favicon.svg" alt="ST" width="28" height="28" style={{ borderRadius: 6 }} />
            ) : (
              <>XM<span className="dash__logo-accent">LIQUIDITY</span><span className="dash__admin-badge">ADMIN</span></>
            )}
          </span>
          <button className="dash__collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
            </svg>
          </button>
        </div>

        <nav className="dash__nav">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} title={item.label}
              className={`dash__nav-item ${location.pathname === item.path ? 'dash__nav-item--active' : ''}`}>
              <span className="dash__nav-icon">{icons[item.icon]}</span>
              {!collapsed && <span className="dash__nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="dash__sidebar-footer">
          <button className="dash__nav-item dash__logout-btn" onClick={handleLogout}>
            <span className="dash__nav-icon">{icons.logout}</span>
            {!collapsed && <span className="dash__nav-label">LOGOUT</span>}
          </button>
        </div>
      </aside>

      <div className="dash__main">
        <header className="dash__topbar">
          <div>
            <h1 className="dash__page-title">
              {navItems.find((i) => i.path === location.pathname)?.label || 'ADMIN'}
            </h1>
          </div>
          <AdminNotificationBell />
          <div className="dash__user-info">
            <div className="dash__user-avatar">{user?.name?.charAt(0) || 'A'}</div>
            <div className="dash__user-details">
              <span className="dash__user-name">{user?.name || 'Admin'}</span>
              <span className="dash__user-role">{user?.role?.toUpperCase()}</span>
            </div>
          </div>
        </header>
        <main className="dash__content"><Outlet /></main>
      </div>
    </div>
  )
}

// --- App ---
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// On mount, rehydrate the session from sessionStorage so a page refresh
// doesn't bounce the admin back to /login.
function SessionRestore({ children }) {
  const dispatch = useDispatch()
  const { isAuthenticated } = useSelector((state) => state.auth)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (isAuthenticated) { setChecked(true); return }
    const { access } = restoreTokens()
    if (access) {
      dispatch(fetchCurrentUser()).finally(() => setChecked(true))
    } else {
      setChecked(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!checked) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__spinner" />
      </div>
    )
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="noise-overlay" />
      <ScrollToTop />
      <SessionRestore>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route element={
          <AdminProtected>
            <AdminLayout />
          </AdminProtected>
        }>
          <Route path="/" element={<Navigate to="/signup-requests" replace />} />
          <Route path="/signup-requests" element={<AdminSignupRequests />} />
          <Route path="/users" element={<AdminUsers />} />
          <Route path="/transactions" element={<AdminTransactions />} />
          <Route path="/trades" element={<AdminTrades />} />
          <Route path="/risk" element={<AdminRisk />} />
          <Route path="/instruments" element={<AdminInstruments />} />
          <Route path="/charges" element={<AdminCharges />} />
          <Route path="/prop" element={<AdminProp />} />
          <Route path="/copy-trading" element={<AdminCopyTrading />} />
          <Route path="/challenges" element={<AdminChallenges />} />
          <Route path="/ib" element={<AdminIB />} />
          <Route path="/payment-settings" element={<AdminPaymentSettings />} />
          <Route path="/audit" element={<AdminAudit />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </SessionRestore>
    </BrowserRouter>
  )
}
