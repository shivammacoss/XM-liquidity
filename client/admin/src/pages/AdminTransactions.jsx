/**
 * XMLiquidity — Admin Transactions Page
 * Approve/reject deposits and withdrawals. THIS IS THE CRITICAL PAGE.
 * Without approving deposits, users can't fund accounts and can't trade.
 */

import { useState, useEffect } from 'react'
import { adminApi } from '../services/admin'

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace(/\/api\/v1\/?$/, '')

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [typeFilter, setTypeFilter] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => { loadTransactions() }, [page, statusFilter, typeFilter])

  const loadTransactions = async () => {
    setLoading(true)
    try {
      const params = { page, per_page: 50 }
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.type = typeFilter
      const { data } = await adminApi.transactions(params)
      setTransactions(data.transactions)
      setTotal(data.total)
    } catch { /* empty */ } finally { setLoading(false) }
  }

  const handleReview = async (txnId, action) => {
    const notes = action === 'reject' ? prompt('Rejection reason (optional):') : ''
    try {
      await adminApi.reviewTransaction(txnId, { action, admin_notes: notes || undefined })
      setMessage(`Transaction ${action}d successfully`)
      loadTransactions()
    } catch { setMessage('Action failed') }
  }

  return (
    <div className="dash-page">
      <div className="dash-page__header">
        <div>
          <h2 className="dash-page__title">DEPOSITS & WITHDRAWALS</h2>
          <p className="dash-page__subtitle">Approve or reject pending transactions</p>
        </div>
      </div>

      {message && <div className="dash-success">{message}</div>}

      <div className="dash-tabs">
        {['pending', 'completed', 'rejected', ''].map((s) => (
          <button key={s || 'all'} className={`dash-tab ${statusFilter === s ? 'dash-tab--active' : ''}`}
            onClick={() => { setStatusFilter(s); setPage(1) }}>
            {s ? s.toUpperCase() : 'ALL'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'deposit', 'withdrawal'].map((t) => (
          <button key={t || 'all'} className={`dash-seg-btn ${typeFilter === t ? 'dash-seg-btn--active' : ''}`}
            onClick={() => { setTypeFilter(t); setPage(1) }}>
            {t ? t.toUpperCase() : 'ALL TYPES'}
          </button>
        ))}
      </div>

      {loading ? <div className="dash-loading">Loading...</div> : transactions.length === 0 ? (
        <div className="dash-empty"><p>No {statusFilter || ''} transactions found.</p></div>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>USER ID</th><th>TYPE</th><th>METHOD</th><th>NETWORK</th><th>AMOUNT</th><th>TXN HASH</th><th>PROOF / DEST</th><th>STATUS</th><th>DATE</th><th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const network = t.payment_details?.network
                const proofUrl = t.payment_details?.proof_image_url
                const toAddress = t.payment_details?.to_address
                return (
                <tr key={t.id}>
                  <td style={{ fontSize: 10, fontFamily: 'monospace' }}>{t.user_id.slice(-8)}</td>
                  <td><span className="dash-badge">{t.type.toUpperCase()}</span></td>
                  <td>{t.method.replace(/_/g, ' ').toUpperCase()}</td>
                  <td>{network ? network.toUpperCase() : '-'}</td>
                  <td><strong>${t.amount.toFixed(2)}</strong></td>
                  <td style={{ fontSize: 10, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.crypto_txn_hash || '-'}</td>
                  <td style={{ maxWidth: 220 }}>
                    {t.type === 'deposit' && proofUrl && (
                      <a href={`${API_ORIGIN}${proofUrl}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                        <img src={`${API_ORIGIN}${proofUrl}`} alt="proof" style={{ height: 44, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)' }} />
                      </a>
                    )}
                    {t.type === 'withdrawal' && toAddress && (
                      <code style={{ fontSize: 10, wordBreak: 'break-all', color: 'rgba(255,255,255,0.75)' }}>{toAddress}</code>
                    )}
                    {!proofUrl && !toAddress && '-'}
                  </td>
                  <td><span className={`dash-status dash-status--${t.status}`}>{t.status.toUpperCase()}</span></td>
                  <td>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td>
                    {t.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="dash-btn-sm" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                          onClick={() => handleReview(t.id, 'approve')}>APPROVE</button>
                        <button className="dash-btn-sm dash-btn-sm--red"
                          onClick={() => handleReview(t.id, 'reject')}>REJECT</button>
                      </div>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > 50 && (
        <div className="dash-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>PREV</button>
          <span className="mono-label">PAGE {page} OF {Math.ceil(total / 50)}</span>
          <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}>NEXT</button>
        </div>
      )}
    </div>
  )
}
