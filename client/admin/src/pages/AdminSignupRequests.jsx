import { useState, useEffect } from 'react'
import { adminApi } from '../services/admin'

export default function AdminSignupRequests() {
  const [requests, setRequests] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('pending')
  const [message, setMessage] = useState('')
  const [approveModal, setApproveModal] = useState(null)
  const [password, setPassword] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', phone: '', password: '' })

  useEffect(() => { loadRequests() }, [page, filter])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const params = { page, per_page: 20 }
      if (filter) params.status = filter
      const { data } = await adminApi.signupRequests(params)
      setRequests(data.requests)
      setTotal(data.total)
    } catch { /* empty */ } finally { setLoading(false) }
  }

  const handleApprove = async () => {
    if (!password || password.length < 6) {
      setMessage('Password must be at least 6 characters')
      return
    }
    setActionLoading(true)
    try {
      const { data } = await adminApi.approveSignup(approveModal.id, password)
      setMessage(`Account created for ${data.email} — Password: ${data.password}`)
      setApproveModal(null)
      setPassword('')
      loadRequests()
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'Approval failed')
    } finally { setActionLoading(false) }
  }

  const handleReject = async (req) => {
    const reason = prompt('Rejection reason (optional):') ?? ''
    setActionLoading(true)
    try {
      await adminApi.rejectSignup(req.id, reason)
      setMessage(`Request from ${req.email} rejected`)
      loadRequests()
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'Rejection failed')
    } finally { setActionLoading(false) }
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
    let pw = ''
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)]
    return pw
  }

  const handleDirectCreate = async (e) => {
    e.preventDefault()
    if (!createForm.name || !createForm.email || !createForm.password) {
      setMessage('Name, email and password are required')
      return
    }
    if (createForm.password.length < 6) {
      setMessage('Password must be at least 6 characters')
      return
    }
    setActionLoading(true)
    try {
      const payload = { name: createForm.name, email: createForm.email, password: createForm.password }
      if (createForm.phone) payload.phone = createForm.phone
      const { data } = await adminApi.createUser(payload)
      setMessage(`Account created for ${data.email} — Password: ${data.password}`)
      setShowCreateForm(false)
      setCreateForm({ name: '', email: '', phone: '', password: '' })
      loadRequests()
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'Creation failed')
    } finally { setActionLoading(false) }
  }

  return (
    <div className="dash-page">
      <div className="dash-page__header">
        <div>
          <h2 className="dash-page__title">SIGNUP REQUESTS</h2>
          <p className="dash-page__subtitle">{total} {filter || 'total'} requests</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="laser-btn"
            style={{ padding: '8px 20px', fontSize: 12 }}
            onClick={() => { setShowCreateForm(!showCreateForm); setApproveModal(null) }}
          >
            + CREATE USER
          </button>
          {['pending', 'approved', 'rejected', ''].map((f) => (
            <button key={f} className={`dash-btn-sm ${filter === f ? 'dash-btn-sm--active' : ''}`}
              onClick={() => { setFilter(f); setPage(1) }}>
              {f ? f.toUpperCase() : 'ALL'}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className="dash-success" style={{ whiteSpace: 'pre-wrap', userSelect: 'text' }}>
          {message}
          <button onClick={() => setMessage('')} style={{ marginLeft: 12, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Direct Create User Form */}
      {showCreateForm && (
        <div className="dash-create-card" style={{ marginBottom: 24, border: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 className="dash-create-card__title">CREATE USER DIRECTLY</h3>
            <button className="dash-btn-sm" onClick={() => setShowCreateForm(false)}>CANCEL</button>
          </div>
          <form onSubmit={handleDirectCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label className="auth-form__label">FULL NAME</label>
                <input className="auth-form__input" type="text" required placeholder="John Doe"
                  value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
              </div>
              <div>
                <label className="auth-form__label">EMAIL</label>
                <input className="auth-form__input" type="email" required placeholder="user@example.com"
                  value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
              </div>
              <div>
                <label className="auth-form__label">PHONE (OPTIONAL)</label>
                <input className="auth-form__input" type="tel" placeholder="+91 98765 43210"
                  value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="auth-form__label">PASSWORD</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="auth-form__input" type="text" required placeholder="Set a password" style={{ flex: 1 }}
                    value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
                  <button type="button" className="dash-btn-sm" style={{ height: 40 }}
                    onClick={() => setCreateForm({ ...createForm, password: generatePassword() })}>GENERATE</button>
                </div>
              </div>
            </div>
            <button type="submit" className="laser-btn" disabled={actionLoading} style={{ width: '100%' }}>
              {actionLoading ? 'CREATING...' : 'CREATE ACCOUNT'}
            </button>
          </form>
        </div>
      )}

      {/* Approve Modal */}
      {approveModal && (
        <div className="dash-create-card" style={{ marginBottom: 24, border: '1px solid rgba(191,255,0,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 className="dash-create-card__title">APPROVE & CREATE ACCOUNT</h3>
            <button className="dash-btn-sm" onClick={() => { setApproveModal(null); setPassword('') }}>CANCEL</button>
          </div>
          <div className="dash-home__cards" style={{ marginBottom: 16 }}>
            <div className="dash-card"><span className="dash-card__label">NAME</span><span className="dash-card__value" style={{ fontSize: 14 }}>{approveModal.name}</span></div>
            <div className="dash-card"><span className="dash-card__label">EMAIL</span><span className="dash-card__value" style={{ fontSize: 14 }}>{approveModal.email}</span></div>
            <div className="dash-card"><span className="dash-card__label">PHONE</span><span className="dash-card__value" style={{ fontSize: 14 }}>{approveModal.phone || '—'}</span></div>
          </div>
          {approveModal.message && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              <strong>Message:</strong> {approveModal.message}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label className="auth-form__label">SET PASSWORD FOR USER</label>
              <input
                className="auth-form__input"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password for the user"
              />
            </div>
            <button className="dash-btn-sm" onClick={() => setPassword(generatePassword())} style={{ marginBottom: 0, height: 40 }}>GENERATE</button>
          </div>
          <button className="laser-btn" onClick={handleApprove} disabled={actionLoading} style={{ width: '100%' }}>
            {actionLoading ? 'CREATING ACCOUNT...' : 'APPROVE & CREATE ACCOUNT'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="dash-loading">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="dash-empty">No signup requests found</div>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>EMAIL</th>
                <th>PHONE</th>
                <th>MESSAGE</th>
                <th>STATUS</th>
                <th>DATE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td>{r.phone || '—'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.message || '—'}
                  </td>
                  <td>
                    <span className={`dash-badge ${r.status === 'pending' ? 'dash-badge--warn' : r.status === 'approved' ? 'dash-badge--ok' : 'dash-badge--danger'}`}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    {r.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="dash-btn-sm dash-btn-sm--green" onClick={() => { setApproveModal(r); setPassword(''); setShowCreateForm(false) }}>
                          APPROVE
                        </button>
                        <button className="dash-btn-sm dash-btn-sm--red" onClick={() => handleReject(r)}>
                          REJECT
                        </button>
                      </div>
                    )}
                    {r.status === 'rejected' && r.rejection_reason && (
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{r.rejection_reason}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {total > 20 && (
            <div className="dash-pagination">
              <button className="dash-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>PREV</button>
              <span className="dash-pagination__info">Page {page} of {Math.ceil(total / 20)}</span>
              <button className="dash-btn-sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)}>NEXT</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
