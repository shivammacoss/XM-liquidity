/**
 * XMLiquidity — User Prop Challenges (bharat_funded parity)
 * Tabs: BROWSE · MY ACCOUNTS · DETAIL
 *
 * BROWSE      — multi-tier challenge cards from /prop/challenges
 * MY ACCOUNTS — list with live equity (balance + floating P&L)
 * DETAIL      — clicked account → dashboard summary + insights
 *               (equity curve, objectives table, daily breakdown,
 *                stats: win-rate / profit factor / Sharpe / RRR /
 *                expectancy / consistency) + withdraw button
 */

import { useState, useEffect, useCallback } from 'react'
import { propApi } from '../../services/dashboard'

export default function PropChallenges() {
  const [tab, setTab] = useState('browse')
  const [status, setStatus] = useState({ enabled: true, display_name: 'Prop Trading Challenge', description: '' })
  const [challenges, setChallenges] = useState([])
  const [accounts, setAccounts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const flash = useCallback((kind, text) => {
    setMessage(''); setError('')
    if (kind === 'ok') setMessage(text); else setError(text)
    setTimeout(() => { setMessage(''); setError('') }, 4000)
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const [s, c, a] = await Promise.all([
        propApi.status().catch(() => ({ data: { enabled: true } })),
        propApi.challenges().catch(() => ({ data: { challenges: [] } })),
        propApi.myAccounts().catch(() => ({ data: { accounts: [] } })),
      ])
      setStatus(s.data)
      setChallenges(c.data.challenges || [])
      setAccounts(a.data.accounts || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) return <div className="dash-loading">Loading...</div>

  if (status && status.enabled === false) {
    return (
      <div className="dash-page">
        <div className="dash-empty">
          <h3>Challenge mode is currently off</h3>
          <p>Prop challenges are not available right now. Please check back later.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dash-page">
      <div className="dash-page__header">
        <div>
          <h2 className="dash-page__title">{(status?.display_name || 'PROP CHALLENGES').toUpperCase()}</h2>
          <p className="dash-page__subtitle">{status?.description || 'Get funded to trade with our capital'}</p>
        </div>
      </div>

      {message && <div className="dash-success">{message}</div>}
      {error && <div className="auth-form__error">{error}</div>}

      <div className="dash-tabs">
        <button className={`dash-tab ${tab === 'browse' ? 'dash-tab--active' : ''}`} onClick={() => { setTab('browse'); setSelectedId(null) }}>BROWSE</button>
        <button className={`dash-tab ${tab === 'my' ? 'dash-tab--active' : ''}`} onClick={() => { setTab('my'); setSelectedId(null) }}>MY ACCOUNTS ({accounts.length})</button>
        {selectedId && <button className={`dash-tab ${tab === 'detail' ? 'dash-tab--active' : ''}`} onClick={() => setTab('detail')}>ACCOUNT DETAIL</button>}
      </div>

      {tab === 'browse' && <BrowseTab challenges={challenges} flash={flash} reload={loadAll} setTab={setTab} />}
      {tab === 'my' && (
        <MyAccountsTab
          accounts={accounts}
          openDetail={(id) => { setSelectedId(id); setTab('detail') }}
        />
      )}
      {tab === 'detail' && selectedId && (
        <AccountDetailTab
          propId={selectedId}
          flash={flash}
          back={() => { setSelectedId(null); setTab('my'); loadAll() }}
        />
      )}
    </div>
  )
}

/* ---------- BROWSE ------------------------------------------------------- */
function BrowseTab({ challenges, flash, reload, setTab }) {
  const [busy, setBusy] = useState(null)

  const buy = async (challenge, tierIndex) => {
    const tier = tierIndex !== null ? challenge.tiers[tierIndex] : { account_size: challenge.account_size, price: challenge.price }
    if (!confirm(`Buy "${challenge.name}"\n\nFund size: $${tier.account_size?.toLocaleString()}\nPrice: $${tier.price}\n\nFee will be deducted from your wallet. Continue?`)) return
    setBusy(`${challenge.id}-${tierIndex}`)
    try {
      await propApi.buy(challenge.id, tierIndex)
      flash('ok', 'Challenge purchased!')
      await reload()
      setTab('my')
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Purchase failed')
    } finally { setBusy(null) }
  }

  if (!challenges.length) {
    return <div className="dash-empty"><p>No challenges available right now.</p></div>
  }

  return (
    <div className="dash-prop-grid">
      {challenges.map(c => {
        const tiers = (c.tiers && c.tiers.length > 0)
          ? c.tiers.map((t, i) => ({ ...t, _idx: i }))
          : [{ account_size: c.account_size, price: c.price, label: '', _idx: null }]
        return (
          <div key={c.id} className="dash-prop-card">
            <div className="dash-prop-card__header">
              <span className="dash-prop-card__type">{c.prop_type.replace('_', ' ').toUpperCase()}</span>
              <span className="dash-prop-card__phases">{c.steps_count} STEP{c.steps_count !== 1 ? 'S' : ''}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{c.name}</div>
            {c.description && <div style={{ fontSize: 12, opacity: 0.7, margin: '4px 0 12px' }}>{c.description}</div>}

            <div className="dash-prop-card__rules">
              <div>Daily DD: {c.rules.max_daily_loss_pct}%</div>
              <div>Total DD: {c.rules.max_total_loss_pct}%</div>
              <div>Target P1: {c.rules.profit_target_phase1_pct ?? '—'}%</div>
              <div>Target P2: {c.rules.profit_target_phase2_pct ?? '—'}%</div>
              <div>Lev: {c.rules.max_leverage}x</div>
              <div>Days: {c.rules.challenge_expiry_days}</div>
              <div>Split: {c.funded_settings.profit_split_pct}%</div>
              <div>Cooldown: {c.funded_settings.withdrawal_cooldown_days}d</div>
            </div>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tiers.map(t => {
                const key = `${c.id}-${t._idx}`
                return (
                  <button
                    key={key}
                    className="laser-btn"
                    disabled={busy === key}
                    onClick={() => buy(c, t._idx)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', position: 'relative',
                      borderColor: t.is_popular ? '#ff7a00' : undefined,
                    }}
                  >
                    <span>
                      {t.label && <strong style={{ marginRight: 8 }}>{t.label}</strong>}
                      ${(t.account_size || 0).toLocaleString()} fund
                    </span>
                    <span>
                      {busy === key ? '...' : `BUY $${t.price}`}
                    </span>
                    {t.is_popular && (
                      <span style={{ position: 'absolute', top: -8, right: 12, background: '#ff7a00', color: '#000', padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4 }}>★ POPULAR</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- MY ACCOUNTS -------------------------------------------------- */
function MyAccountsTab({ accounts, openDetail }) {
  if (!accounts.length) return <div className="dash-empty"><p>No active prop accounts. Buy a challenge to get started.</p></div>
  return (
    <div className="dash-prop-grid">
      {accounts.map(a => {
        const pnlColor = (a.total_pnl || 0) >= 0 ? '#10b981' : '#ef4444'
        return (
          <div key={a.id} className={`dash-prop-card dash-prop-card--${a.status}`} onClick={() => openDetail(a.id)} style={{ cursor: 'pointer' }}>
            <div className="dash-prop-card__header">
              <span className="dash-prop-card__type">{a.challenge?.name || a.prop_type.replace('_', ' ').toUpperCase()}</span>
              <StatusBadge status={a.status} />
            </div>
            <div className="dash-prop-card__size">${(a.account_size || 0).toLocaleString()}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10, fontSize: 13 }}>
              <div>
                <div style={miniLabel}>BALANCE</div>
                <div style={miniValue}>${(a.balance || 0).toFixed(2)}</div>
              </div>
              <div>
                <div style={miniLabel}>EQUITY</div>
                <div style={miniValue}>${(a.live_equity || 0).toFixed(2)}</div>
              </div>
              <div>
                <div style={miniLabel}>FLOATING</div>
                <div style={{ ...miniValue, color: a.floating_pnl >= 0 ? '#10b981' : '#ef4444' }}>
                  ${(a.floating_pnl || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div style={miniLabel}>TOTAL P/L</div>
                <div style={{ ...miniValue, color: pnlColor }}>${(a.total_pnl || 0).toFixed(2)}</div>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              Phase {a.current_phase}/{a.total_phases} · {a.open_count} open
              · DD {(a.current_daily_drawdown_pct || 0).toFixed(1)}%/{(a.current_overall_drawdown_pct || 0).toFixed(1)}%
            </div>

            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>
              Click to view dashboard →
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- ACCOUNT DETAIL  (dashboard + insights + withdraw) ------------ */
function AccountDetailTab({ propId, flash, back }) {
  const [dashboard, setDashboard] = useState(null)
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, i] = await Promise.all([
        propApi.dashboard(propId),
        propApi.insights(propId),
      ])
      setDashboard(d.data)
      setInsights(i.data)
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Failed to load')
    } finally { setLoading(false) }
  }, [propId, flash])

  useEffect(() => { load() }, [load])

  const withdraw = async () => {
    if (!confirm('Request a profit payout for admin approval?')) return
    setWithdrawing(true)
    try {
      const { data } = await propApi.withdraw(propId)
      flash('ok', data.message)
      load()
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Withdraw failed')
    } finally { setWithdrawing(false) }
  }

  if (loading) return <div className="dash-loading">Loading...</div>
  if (!dashboard) return <div className="dash-empty"><p>Account not found.</p><button className="laser-btn laser-btn--sm" onClick={back}>BACK</button></div>

  const d = dashboard
  const i = insights || {}
  const ov = i.overview || {}
  const stats = i.stats || {}
  const cons = i.consistency || {}

  return (
    <div style={{ marginTop: 16 }}>
      <button className="laser-btn laser-btn--sm" onClick={back} style={{ marginBottom: 12 }}>← BACK</button>

      {/* Top summary */}
      <div className="dash-create-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{(i.meta?.challenge_name || '').toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>${(d.balance.initial || 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Phase {d.account.current_phase}/{d.account.total_phases} · {d.time.remaining_days} days left</div>
          </div>
          <StatusBadge status={d.account.status} large />
          {d.account.status === 'funded' && (d.funded.withdrawable || 0) > 0 && (
            <button className="laser-btn" disabled={withdrawing} onClick={withdraw}>
              {withdrawing ? '...' : `WITHDRAW $${d.funded.withdrawable.toFixed(2)}`}
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        <Cell label="BALANCE" value={`$${(d.balance.current || 0).toFixed(2)}`} />
        <Cell label="EQUITY" value={`$${(d.balance.equity || 0).toFixed(2)}`} />
        <Cell label="UNREALIZED" value={`$${(ov.unrealized_pnl || 0).toFixed(2)}`} color={ov.unrealized_pnl >= 0 ? '#10b981' : '#ef4444'} />
        <Cell label="TODAY P/L" value={`$${(ov.todays_pnl || 0).toFixed(2)}`} color={ov.todays_pnl >= 0 ? '#10b981' : '#ef4444'} />
        <Cell label="TOTAL P/L" value={`$${(ov.total_pnl || 0).toFixed(2)} (${(ov.total_pnl_pct || 0).toFixed(2)}%)`} color={ov.total_pnl >= 0 ? '#10b981' : '#ef4444'} />
      </div>

      {/* Drawdown + profit progress bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <ProgressBar
          label="DAILY DRAWDOWN"
          used={d.drawdown.daily_used} max={d.drawdown.daily_max}
        />
        <ProgressBar
          label="OVERALL DRAWDOWN"
          used={d.drawdown.overall_used} max={d.drawdown.overall_max}
        />
        <ProgressBar
          label="PROFIT TARGET"
          used={d.profit.current_pct} max={d.profit.target_pct || 1}
          good
        />
      </div>

      {/* Objectives table */}
      {i.objectives && i.objectives.length > 0 && (
        <div className="dash-create-card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>OBJECTIVES</h3>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}>
                <th style={th2}>Objective</th>
                <th style={th2}>Target</th>
                <th style={th2}>Current</th>
                <th style={th2}>Status</th>
              </tr>
            </thead>
            <tbody>
              {i.objectives.map(o => (
                <tr key={o.key} style={{ borderBottom: '1px solid #222' }}>
                  <td style={td2}>{o.label}</td>
                  <td style={td2}>{o.target}{o.unit !== 'days' && o.unit !== '% used' ? o.unit : ` ${o.unit}`}</td>
                  <td style={td2}>{typeof o.actual === 'number' ? o.actual.toFixed(2) : o.actual}{o.unit !== 'days' && o.unit !== '% used' ? o.unit : ` ${o.unit}`}</td>
                  <td style={td2}>{o.passed ? <span style={{ color: '#10b981' }}>✓ PASSED</span> : <span style={{ color: '#f59e0b' }}>○ IN PROGRESS</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Performance stats */}
      <div className="dash-create-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>PERFORMANCE</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          <Cell label="WIN RATE" value={`${(stats.win_rate || 0).toFixed(1)}%`} />
          <Cell label="TRADES" value={stats.num_trades || 0} />
          <Cell label="AVG WIN" value={`$${(stats.avg_profit || 0).toFixed(2)}`} />
          <Cell label="AVG LOSS" value={`$${(stats.avg_loss || 0).toFixed(2)}`} />
          <Cell label="PROFIT FACTOR" value={(stats.profit_factor === 999 ? '∞' : (stats.profit_factor || 0).toFixed(2))} />
          <Cell label="EXPECTANCY" value={`$${(stats.expectancy || 0).toFixed(2)}`} />
          <Cell label="AVG RRR" value={(stats.avg_rrr || 0).toFixed(2)} />
          <Cell label="SHARPE" value={(stats.sharpe || 0).toFixed(2)} />
          <Cell label="AVG DURATION" value={formatDuration(stats.avg_duration_sec)} />
          <Cell label="CONSISTENCY" value={cons.score !== null ? `${cons.score}/100` : '—'} />
        </div>
      </div>

      {/* Equity curve (simple inline SVG) */}
      {i.equity_curve && i.equity_curve.length > 1 && (
        <div className="dash-create-card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>EQUITY CURVE</h3>
          <EquitySparkline points={i.equity_curve} initial={ov.initial_balance || 0} />
        </div>
      )}

      {/* Daily breakdown */}
      {i.daily_breakdown && i.daily_breakdown.length > 0 && (
        <div className="dash-create-card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>DAILY BREAKDOWN</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}>
                  <th style={th2}>Date</th>
                  <th style={th2}>Trades</th>
                  <th style={th2}>Wins</th>
                  <th style={th2}>Losses</th>
                  <th style={th2}>Volume</th>
                  <th style={th2}>P/L</th>
                </tr>
              </thead>
              <tbody>
                {i.daily_breakdown.slice(-30).reverse().map(day => (
                  <tr key={day.date} style={{ borderBottom: '1px solid #222' }}>
                    <td style={td2}>{day.date}</td>
                    <td style={td2}>{day.trades}</td>
                    <td style={td2}>{day.wins}</td>
                    <td style={td2}>{day.losses}</td>
                    <td style={td2}>{(day.volume || 0).toFixed(2)}</td>
                    <td style={{ ...td2, color: day.pnl >= 0 ? '#10b981' : '#ef4444' }}>${day.pnl.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Violations log */}
      {d.violations && d.violations.length > 0 && (
        <div className="dash-create-card">
          <h3 style={{ marginTop: 0 }}>VIOLATIONS / NOTES</h3>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
            {d.violations.map((v, i) => (
              <li key={i} style={{ color: v.severity === 'fail' ? '#ef4444' : '#f59e0b', marginBottom: 4 }}>
                <strong>{v.rule}</strong> — {v.description}
                {v.timestamp && <span style={{ opacity: 0.5, fontSize: 11, marginLeft: 8 }}>{new Date(v.timestamp).toLocaleString()}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ---------- helpers ------------------------------------------------------ */
function StatusBadge({ status, large }) {
  const colors = {
    active: '#3b82f6', passed: '#10b981', funded: '#22c55e',
    blown: '#ef4444', expired: '#6b7280',
    pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444',
  }
  return (
    <span style={{
      display: 'inline-block', padding: large ? '6px 14px' : '2px 8px',
      fontSize: large ? 14 : 10, fontWeight: 700, letterSpacing: 1,
      borderRadius: 4, background: colors[status] || '#444', color: '#fff',
    }}>{(status || '').toUpperCase()}</span>
  )
}

function Cell({ label, value, color }) {
  return (
    <div className="dash-prop-card" style={{ padding: 12 }}>
      <div style={miniLabel}>{label}</div>
      <div style={{ ...miniValue, color: color || undefined }}>{value}</div>
    </div>
  )
}

function ProgressBar({ label, used, max, good }) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (used / max) * 100 : 0))
  const fill = good ? '#10b981' : (pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#3b82f6')
  return (
    <div className="dash-prop-card" style={{ padding: 12 }}>
      <div style={miniLabel}>{label}</div>
      <div style={{ ...miniValue, fontSize: 16 }}>{(used || 0).toFixed(2)}% / {(max || 0).toFixed(2)}%</div>
      <div style={{ height: 6, background: '#222', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: fill, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

function EquitySparkline({ points, initial }) {
  const w = 800, h = 160, pad = 8
  const ys = points.map(p => p.equity)
  const min = Math.min(...ys, initial), max = Math.max(...ys, initial)
  const range = (max - min) || 1
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - 2 * pad))
  const yPx = (v) => pad + (1 - (v - min) / range) * (h - 2 * pad)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${yPx(p.equity)}`).join(' ')
  const last = ys[ys.length - 1]
  const stroke = last >= initial ? '#10b981' : '#ef4444'
  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 160, display: 'block' }}>
        <line x1={pad} y1={yPx(initial)} x2={w - pad} y2={yPx(initial)} stroke="#444" strokeDasharray="4 4" />
        <path d={path} stroke={stroke} strokeWidth="2" fill="none" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.7, marginTop: 4 }}>
        <span>Initial: ${initial.toFixed(2)}</span>
        <span>Current: ${last.toFixed(2)}</span>
      </div>
    </div>
  )
}

function formatDuration(sec) {
  if (!sec || sec === 0) return '—'
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
  return `${Math.floor(sec / 86400)}d`
}

const miniLabel = { fontSize: 10, opacity: 0.6, letterSpacing: 1, marginBottom: 4 }
const miniValue = { fontSize: 18, fontWeight: 700 }
const th2 = { padding: '8px 6px', fontSize: 11, fontWeight: 600, opacity: 0.7, letterSpacing: 1 }
const td2 = { padding: '8px 6px' }
