/**
 * XMLiquidity Admin — Notification Bell
 * Uses admin notification endpoints.
 */

import { useState, useEffect, useRef } from 'react'
import api from '../../services/api'

export default function AdminNotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadUnreadCount = async () => {
    try { const { data } = await api.get('/admin/notifications/unread-count'); setUnreadCount(data.unread_count) } catch { /* empty */ }
  }

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/notifications', { params: { per_page: 20 } })
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } catch { /* empty */ } finally { setLoading(false) }
  }

  const handleOpen = () => { setOpen(!open); if (!open) loadNotifications() }

  const handleMarkRead = async (id) => {
    await api.post(`/admin/notifications/${id}/read`)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const handleMarkAllRead = async () => {
    await api.post('/admin/notifications/read-all')
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  return (
    <div className="notif-bell" ref={ref}>
      <button className="notif-bell__btn" onClick={handleOpen}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="notif-bell__badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-popup">
          <div className="notif-popup__header">
            <span className="notif-popup__title">ADMIN NOTIFICATIONS</span>
            {unreadCount > 0 && <button className="notif-popup__mark-all" onClick={handleMarkAllRead}>MARK ALL READ</button>}
          </div>
          <div className="notif-popup__list">
            {loading ? <div className="notif-popup__empty">Loading...</div> :
              notifications.length === 0 ? <div className="notif-popup__empty">No notifications</div> :
              notifications.map((n) => (
                <div key={n.id} className={`notif-item ${!n.is_read ? 'notif-item--unread' : ''}`}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}>
                  <div className="notif-item__dot" style={{ background: !n.is_read ? (n.priority === 'high' ? '#ff5050' : 'var(--accent)') : 'transparent' }} />
                  <div className="notif-item__content">
                    <div className="notif-item__title">{n.title}</div>
                    <div className="notif-item__message">{n.message}{n.from_user_name ? ` — ${n.from_user_name}` : ''}</div>
                    <div className="notif-item__time">{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
