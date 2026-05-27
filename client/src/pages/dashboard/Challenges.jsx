/**
 * XMLiquidity — Challenges & Competitions Page
 * Daily/weekly/monthly challenges, leaderboard.
 */

import { useState, useEffect } from 'react'
import { challengesApi, accountsApi } from '../../services/dashboard'

export default function Challenges() {
  const [challenges, setChallenges] = useState([])
  const [accounts, setAccounts] = useState([])
  const [leaderboard, setLeaderboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [c, a] = await Promise.all([challengesApi.list(), accountsApi.list()])
      setChallenges(c.data); setAccounts(a.data.accounts.filter(ac => ac.is_funded))
    } catch { /* empty */ } finally { setLoading(false) }
  }

  const handleJoin = async (challengeId) => {
    if (accounts.length === 0) { setError('You need a funded account to join'); return }
    setError(''); setMessage('')
    try {
      await challengesApi.join(challengeId, accounts[0].id)
      setMessage('Joined challenge!'); loadData()
    } catch (err) { setError(err.response?.data?.detail || 'Failed to join') }
  }

  const viewLeaderboard = async (challengeId) => {
    try {
      const { data } = await challengesApi.leaderboard(challengeId)
      setLeaderboard(data)
    } catch { /* empty */ }
  }

  if (loading) return <div className="dash-loading">Loading...</div>

  return (
    <div className="dash-page">
      <div className="dash-page__header">
        <div>
          <h2 className="dash-page__title">CHALLENGES & COMPETITIONS</h2>
          <p className="dash-page__subtitle">Compete with traders worldwide</p>
        </div>
      </div>

      {message && <div className="dash-success">{message}</div>}
      {error && <div className="auth-form__error">{error}</div>}

      {challenges.length === 0 ? <div className="dash-empty"><p>No challenges available. Check back soon!</p></div> : (
        <div className="dash-prop-grid">
          {challenges.map((c) => (
            <div key={c.id} className="dash-prop-card">
              <div className="dash-prop-card__header">
                <span className="dash-prop-card__type">{c.type.toUpperCase()}</span>
                <span className={`dash-status dash-status--${c.status}`}>{c.status.toUpperCase()}</span>
              </div>
              <div className="dash-prop-card__size">{c.title}</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0' }}>{c.description}</p>
              <div className="dash-prop-card__rules">
                <div>Category: {c.category.replace('_', ' ').toUpperCase()}</div>
                <div>Participants: {c.participant_count}</div>
                <div>Entry Fee: {c.entry_fee > 0 ? `$${c.entry_fee}` : 'FREE'}</div>
                <div>Starts: {new Date(c.start_at).toLocaleDateString()}</div>
                <div>Ends: {new Date(c.end_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!c.is_joined && (c.status === 'active' || c.status === 'upcoming') && (
                  <button className="laser-btn laser-btn--sm" onClick={() => handleJoin(c.id)}>JOIN</button>
                )}
                {c.is_joined && <span className="dash-badge" style={{ color: 'var(--accent)' }}>JOINED</span>}
                <button className="dash-btn-sm" onClick={() => viewLeaderboard(c.id)}>LEADERBOARD</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {leaderboard && (
        <div style={{ marginTop: 32 }}>
          <h3 className="dash-home__section-title">LEADERBOARD — {leaderboard.challenge.title}</h3>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead><tr><th>#</th><th>TRADER</th><th>SCORE</th><th>P&L</th><th>TRADES</th><th>WIN RATE</th></tr></thead>
              <tbody>
                {leaderboard.leaderboard.map((e) => (
                  <tr key={e.user_id} className={e.is_me ? 'dash-table__highlight' : ''}>
                    <td><strong>{e.rank}</strong></td>
                    <td>{e.user_name} {e.is_me && <span style={{ color: 'var(--accent)' }}>(YOU)</span>}</td>
                    <td>{e.score}</td>
                    <td className={e.metrics?.total_pnl >= 0 ? 'text-green' : 'text-red'}>${e.metrics?.total_pnl?.toFixed(2) || 0}</td>
                    <td>{e.metrics?.total_trades || 0}</td>
                    <td>{e.metrics?.win_rate || 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
