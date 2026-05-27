/**
 * XMLiquidity — Copy Trading + PAMM Page
 */

import { useState, useEffect } from 'react'
import { copyApi, accountsApi } from '../../services/dashboard'

export default function CopyTrading() {
  const [tab, setTab] = useState('masters')
  const [masters, setMasters] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [pamms, setPamms] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [m, s, p, a] = await Promise.all([
        copyApi.masters(), copyApi.mySubscriptions(), copyApi.pammList(), accountsApi.list(),
      ])
      setMasters(m.data); setSubscriptions(s.data); setPamms(p.data); setAccounts(a.data.accounts)
    } catch { /* empty */ } finally { setLoading(false) }
  }

  const handleSubscribe = async (masterId) => {
    const fundedAccounts = accounts.filter(a => a.is_funded)
    if (fundedAccounts.length === 0) { setError('You need a funded account to subscribe'); return }
    setMessage(''); setError('')
    try {
      await copyApi.subscribe({ master_id: masterId, account_id: fundedAccounts[0].id, lot_multiplier: 1.0 })
      setMessage('Subscribed successfully!')
      loadAll()
    } catch (err) { setError(err.response?.data?.detail || 'Subscribe failed') }
  }

  const handleUnsubscribe = async (subId) => {
    try { await copyApi.unsubscribe(subId); setMessage('Unsubscribed'); loadAll() } catch { /* empty */ }
  }

  if (loading) return <div className="dash-loading">Loading...</div>

  return (
    <div className="dash-page">
      <div className="dash-page__header">
        <div>
          <h2 className="dash-page__title">COPY TRADING & PAMM</h2>
          <p className="dash-page__subtitle">Follow top traders or invest in managed accounts</p>
        </div>
      </div>

      {message && <div className="dash-success">{message}</div>}
      {error && <div className="auth-form__error">{error}</div>}

      <div className="dash-tabs">
        <button className={`dash-tab ${tab === 'masters' ? 'dash-tab--active' : ''}`} onClick={() => setTab('masters')}>COPY MASTERS</button>
        <button className={`dash-tab ${tab === 'subs' ? 'dash-tab--active' : ''}`} onClick={() => setTab('subs')}>MY SUBSCRIPTIONS ({subscriptions.length})</button>
        <button className={`dash-tab ${tab === 'pamm' ? 'dash-tab--active' : ''}`} onClick={() => setTab('pamm')}>PAMM INVEST</button>
      </div>

      {tab === 'masters' && (
        <div className="dash-accounts-grid">
          {masters.length === 0 ? <div className="dash-empty"><p>No approved masters yet.</p></div> : masters.map((m) => (
            <div key={m.id} className="dash-account-card">
              <div className="dash-account-card__header"><span className="dash-account-card__type">MASTER</span></div>
              <div className="dash-account-card__number">{m.master_name}</div>
              <div className="dash-account-card__meta">
                <div><span className="dash-account-card__label">P&L</span><span className={m.total_pnl >= 0 ? 'text-green' : 'text-red'}>${m.total_pnl}</span></div>
                <div><span className="dash-account-card__label">TRADES</span><span>{m.total_trades}</span></div>
                <div><span className="dash-account-card__label">WIN RATE</span><span>{m.win_rate}%</span></div>
                <div><span className="dash-account-card__label">FOLLOWERS</span><span>{m.subscriber_count}</span></div>
              </div>
              <button className="laser-btn laser-btn--sm" onClick={() => handleSubscribe(m.id)}>COPY THIS TRADER</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'subs' && (
        <div className="dash-accounts-grid">
          {subscriptions.length === 0 ? <div className="dash-empty"><p>No active subscriptions.</p></div> : subscriptions.map((s) => (
            <div key={s.id} className="dash-account-card">
              <div className="dash-account-card__header"><span className="dash-account-card__type">FOLLOWING</span></div>
              <div className="dash-account-card__number">{s.master_name}</div>
              <div className="dash-account-card__meta">
                <div><span className="dash-account-card__label">MULTIPLIER</span><span>{s.lot_multiplier}x</span></div>
                <div><span className="dash-account-card__label">COPIED</span><span>{s.total_copied_trades}</span></div>
                <div><span className="dash-account-card__label">P&L</span><span className={s.total_pnl >= 0 ? 'text-green' : 'text-red'}>${s.total_pnl}</span></div>
              </div>
              <button className="dash-btn-sm dash-btn-sm--red" onClick={() => handleUnsubscribe(s.id)}>UNSUBSCRIBE</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'pamm' && (
        <div className="dash-accounts-grid">
          {pamms.length === 0 ? <div className="dash-empty"><p>No PAMM accounts available.</p></div> : pamms.map((p) => (
            <div key={p.id} className="dash-account-card">
              <div className="dash-account-card__header"><span className="dash-account-card__type">PAMM</span></div>
              <div className="dash-account-card__number">{p.manager_name}</div>
              <div className="dash-account-card__meta">
                <div><span className="dash-account-card__label">POOL</span><span>${p.total_pool}</span></div>
                <div><span className="dash-account-card__label">PROFIT SHARE</span><span>{p.profit_share_pct}%</span></div>
                <div><span className="dash-account-card__label">P&L</span><span className={p.total_pnl >= 0 ? 'text-green' : 'text-red'}>${p.total_pnl}</span></div>
                <div><span className="dash-account-card__label">INVESTORS</span><span>{p.investor_count}</span></div>
              </div>
              <button className="laser-btn laser-btn--sm">INVEST</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
