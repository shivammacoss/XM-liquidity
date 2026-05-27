/**
 * XMLiquidity — Business / IB Page
 * Create IB account, view dashboard, referral links, commissions.
 */

import { useState, useEffect } from 'react'
import { ibApi } from '../../services/dashboard'

const IB_TYPES = [
  { value: 'direct', label: 'DIRECT IB', desc: 'Earn commission per trade from your referrals' },
  { value: 'community', label: 'IB COMMUNITY', desc: '10-level MLM distribution network' },
  { value: 'sub_broker', label: 'SUB-BROKER', desc: 'Earn commission + business share on all revenue' },
]

export default function Business() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [ibType, setIbType] = useState('direct')
  const [referralCode, setReferralCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadDashboard() }, [])

  const loadDashboard = async () => {
    try { const { data } = await ibApi.dashboard(); setDashboard(data) }
    catch { /* empty */ } finally { setLoading(false) }
  }

  const handleCreate = async (e) => {
    e.preventDefault(); setCreating(true); setError('')
    try {
      const { data } = await ibApi.create({ ib_type: ibType, referral_code_used: referralCode || undefined })
      setMessage(`IB account created! Your referral code: ${data.referral_code}`)
      loadDashboard()
    } catch (err) { setError(err.response?.data?.detail || 'Failed') }
    finally { setCreating(false) }
  }

  if (loading) return <div className="dash-loading">Loading...</div>

  if (!dashboard?.has_ib) {
    return (
      <div className="dash-page">
        <div className="dash-page__header">
          <div>
            <h2 className="dash-page__title">BUSINESS / IB</h2>
            <p className="dash-page__subtitle">Start earning commissions from referrals</p>
          </div>
        </div>
        {message && <div className="dash-success">{message}</div>}
        {error && <div className="auth-form__error">{error}</div>}
        <div className="dash-create-card">
          <h3 className="dash-create-card__title">CREATE IB ACCOUNT</h3>
          <form onSubmit={handleCreate} className="auth-form" style={{ maxWidth: 500 }}>
            <div className="dash-create-form__types">
              {IB_TYPES.map((t) => (
                <label key={t.value} className={`dash-type-option ${ibType === t.value ? 'dash-type-option--active' : ''}`}>
                  <input type="radio" name="ib_type" value={t.value} checked={ibType === t.value}
                    onChange={(e) => setIbType(e.target.value)} />
                  <span className="dash-type-option__label">{t.label}</span>
                  <span className="dash-type-option__desc">{t.desc}</span>
                </label>
              ))}
            </div>
            <div className="auth-form__group">
              <label className="auth-form__label">REFERRAL CODE (OPTIONAL)</label>
              <input className="auth-form__input" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="ST-XXXXXXXX" />
            </div>
            <button type="submit" className="laser-btn" disabled={creating}>{creating ? 'CREATING...' : 'CREATE IB ACCOUNT'}</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="dash-page">
      <div className="dash-page__header">
        <div>
          <h2 className="dash-page__title">IB DASHBOARD</h2>
          <p className="dash-page__subtitle">Your business overview</p>
        </div>
      </div>

      <div className="dash-home__cards">
        <div className="dash-card"><span className="dash-card__label">IB TYPE</span><span className="dash-card__value">{dashboard.ib_type.replace('_', ' ').toUpperCase()}</span></div>
        <div className="dash-card"><span className="dash-card__label">TOTAL EARNED</span><span className="dash-card__value text-green">${dashboard.total_earned}</span></div>
        <div className="dash-card"><span className="dash-card__label">REFERRALS</span><span className="dash-card__value">{dashboard.total_referrals}</span></div>
        <div className="dash-card"><span className="dash-card__label">REFERRAL CODE</span><span className="dash-card__value" style={{ fontSize: 16 }}>{dashboard.referral_code}</span></div>
      </div>

      {Object.keys(dashboard.level_distribution || {}).length > 0 && (
        <>
          <h3 className="dash-home__section-title">LEVEL DISTRIBUTION</h3>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead><tr><th>LEVEL</th><th>REFERRALS</th></tr></thead>
              <tbody>
                {Object.entries(dashboard.level_distribution).map(([level, count]) => (
                  <tr key={level}><td>Level {level}</td><td>{count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {dashboard.recent_commissions?.length > 0 && (
        <>
          <h3 className="dash-home__section-title" style={{ marginTop: 32 }}>RECENT COMMISSIONS</h3>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead><tr><th>AMOUNT</th><th>LEVEL</th><th>TYPE</th><th>DATE</th></tr></thead>
              <tbody>
                {dashboard.recent_commissions.map((c) => (
                  <tr key={c.id}>
                    <td className="text-green">${c.amount}</td><td>Level {c.level}</td>
                    <td>{c.revenue_type}</td><td>{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
