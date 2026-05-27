/**
 * XMLiquidity — Account Logs & Performance
 * Shows: performance stats, trade history, P&L, transactions
 */

import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { accountsApi, tradesApi, walletApi } from '../../services/dashboard'

export default function AccountLogs() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const accountId = searchParams.get('account')

  const [account, setAccount] = useState(null)
  const [trades, setTrades] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('performance')
  const [tradePage, setTradePage] = useState(1)
  const [tradeTotal, setTradeTotal] = useState(0)

  useEffect(() => { if (accountId) loadAll() }, [accountId])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [acctRes, tradeRes, txnRes] = await Promise.allSettled([
        accountsApi.get(accountId),
        tradesApi.getHistory({ account_id: accountId, per_page: 50, page: tradePage }),
        walletApi.transactions({ per_page: 50 }),
      ])
      if (acctRes.status === 'fulfilled') setAccount(acctRes.value.data)
      if (tradeRes.status === 'fulfilled') {
        const d = tradeRes.value.data
        setTrades(d.trades || (Array.isArray(d) ? d : []))
        setTradeTotal(d.total || 0)
      }
      if (txnRes.status === 'fulfilled') {
        setTransactions(txnRes.value.data.transactions || [])
      }
    } catch {} finally { setLoading(false) }
  }

  if (loading) return <div className="dash-loading">Loading account logs...</div>
  if (!account) return <div className="dash-empty"><p>Account not found. <button className="dash-btn-sm" onClick={() => navigate('/dashboard/accounts')}>Back to Accounts</button></p></div>

  // Calculate performance stats
  const totalTrades = account.total_trades
  const winTrades = account.win_count
  const lossTrades = account.loss_count
  const winRate = totalTrades > 0 ? ((winTrades / totalTrades) * 100).toFixed(1) : '0.0'
  const totalPnl = account.total_pnl
  const avgWin = winTrades > 0 ? (trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / winTrades).toFixed(2) : '0.00'
  const avgLoss = lossTrades > 0 ? (trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0) / lossTrades).toFixed(2) : '0.00'
  const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.pnl || 0)).toFixed(2) : '0.00'
  const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.pnl || 0)).toFixed(2) : '0.00'
  const profitFactor = Math.abs(parseFloat(avgLoss)) > 0 ? (parseFloat(avgWin) / Math.abs(parseFloat(avgLoss))).toFixed(2) : '0.00'
  const totalLots = trades.reduce((s, t) => s + (t.original_lot_size || t.lot_size || 0), 0).toFixed(2)

  return (
    <div className="dash-page">
      <div className="dash-page__header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <button className="dash-btn-sm" onClick={() => navigate('/dashboard/accounts')}>← BACK</button>
            <h2 className="dash-page__title" style={{ margin: 0 }}>{account.account_number}</h2>
            <span className="dash-account-card__type">{account.account_type.toUpperCase()}</span>
            <span className={`dash-account-card__status ${(account.is_funded || account.is_prop_account) && account.equity <= 0 ? 'dash-account-card__status--blown' : account.is_funded ? 'dash-account-card__status--funded' : ''}`}>
              {(account.is_funded || account.is_prop_account) && account.equity <= 0 ? 'BLOWN' : account.is_funded ? 'LIVE' : 'DEMO'}
            </span>
          </div>
          <p className="dash-page__subtitle">Account Logs & Performance</p>
        </div>
        {account.is_funded && !(account.equity <= 0 && account.status !== 'active') && (
          <button className="laser-btn laser-btn--sm" onClick={() => navigate(`/trade/${account.id}`)}>TRADE</button>
        )}
      </div>

      {/* Tabs */}
      <div className="dash-tabs">
        {['performance', 'trades', 'transactions'].map(t => (
          <button key={t} className={`dash-tab ${tab === t ? 'dash-tab--active' : ''}`} onClick={() => setTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* === PERFORMANCE TAB === */}
      {tab === 'performance' && (
        <>
          {/* Balance & Equity Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="logs-big-card">
              <span className="logs-big-card__label">BALANCE</span>
              <span className="logs-big-card__value">${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="logs-big-card">
              <span className="logs-big-card__label">EQUITY</span>
              <span className="logs-big-card__value">${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="logs-stats-grid">
            <div className="logs-stat">
              <span className="logs-stat__label">NET P&L</span>
              <span className={`logs-stat__value ${totalPnl >= 0 ? 'text-green' : 'text-red'}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </span>
              <span className="logs-stat__sub">{totalTrades} trades</span>
            </div>
            <div className="logs-stat">
              <span className="logs-stat__label">PROFIT FACTOR</span>
              <span className="logs-stat__value">{profitFactor}</span>
              <span className="logs-stat__sub">{parseFloat(profitFactor) >= 1.5 ? 'Strong' : parseFloat(profitFactor) >= 1 ? 'Average' : 'Weak'}</span>
            </div>
            <div className="logs-stat">
              <span className="logs-stat__label">LOTS TRADED</span>
              <span className="logs-stat__value">{totalLots}</span>
              <span className="logs-stat__sub">{totalTrades} trades</span>
            </div>
            <div className="logs-stat">
              <span className="logs-stat__label">TOTAL TRADES</span>
              <span className="logs-stat__value">{totalTrades}</span>
              <span className="logs-stat__sub">{winTrades} wins, {lossTrades} losses</span>
            </div>
          </div>

          {/* Win Rate + More Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
            {/* Win Rate Card */}
            <div className="logs-card">
              <h3 className="logs-card__title">TRADE WIN %</h3>
              <div className="logs-winrate">
                <div className="logs-winrate__bar">
                  <div className="logs-winrate__fill" style={{ width: `${winRate}%` }} />
                </div>
                <div className="logs-winrate__labels">
                  <span className="text-green">{winTrades} won</span>
                  <span className="logs-winrate__pct">{winRate}%</span>
                  <span className="text-red">{lossTrades} lost</span>
                </div>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="logs-card">
              <h3 className="logs-card__title">PERFORMANCE</h3>
              <div className="logs-perf-list">
                <div className="logs-perf-row"><span>Avg Win</span><span className="text-green">+${avgWin}</span></div>
                <div className="logs-perf-row"><span>Avg Loss</span><span className="text-red">${avgLoss}</span></div>
                <div className="logs-perf-row"><span>Best Trade</span><span className="text-green">+${bestTrade}</span></div>
                <div className="logs-perf-row"><span>Worst Trade</span><span className="text-red">${worstTrade}</span></div>
                <div className="logs-perf-row"><span>Win Rate</span><span>{winRate}%</span></div>
                <div className="logs-perf-row"><span>Leverage</span><span>1:{account.leverage}</span></div>
              </div>
            </div>
          </div>

          {/* Account Details */}
          <div className="logs-card" style={{ marginTop: 16 }}>
            <h3 className="logs-card__title">ACCOUNT DETAILS</h3>
            <div className="logs-perf-list">
              <div className="logs-perf-row"><span>Account Number</span><span>{account.account_number}</span></div>
              <div className="logs-perf-row"><span>Account Type</span><span>{account.account_type.toUpperCase()}</span></div>
              <div className="logs-perf-row"><span>Currency</span><span>{account.currency}</span></div>
              <div className="logs-perf-row"><span>Free Margin</span><span>${(account.equity - account.margin_used).toFixed(2)}</span></div>
              <div className="logs-perf-row"><span>Margin Used</span><span>${account.margin_used.toFixed(2)}</span></div>
              <div className="logs-perf-row"><span>Status</span><span>{account.is_funded ? 'LIVE' : 'UNFUNDED'}</span></div>
              <div className="logs-perf-row"><span>Created</span><span>{new Date(account.created_at).toLocaleDateString()}</span></div>
            </div>
          </div>
        </>
      )}

      {/* === TRADES TAB === */}
      {tab === 'trades' && (
        <>
          <div style={{ marginBottom: 12, fontFamily: 'Geist Mono', fontSize: 11, color: 'var(--text-secondary)' }}>
            {tradeTotal} total closed trades
          </div>
          {trades.length === 0 ? (
            <div className="dash-empty"><p>No closed trades yet.</p></div>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>INSTRUMENT</th><th>SIDE</th><th>LOT</th><th>OPEN</th><th>CLOSE</th><th>P&L</th><th>SPREAD</th><th>SWAP</th><th>COMM</th><th>OPENED</th><th>CLOSED</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map(t => (
                    <tr key={t.id}>
                      <td><strong>{t.instrument}</strong></td>
                      <td><span className={`dash-direction dash-direction--${t.direction}`}>{t.direction.toUpperCase()}</span></td>
                      <td>{t.lot_size}</td>
                      <td>{t.open_price}</td>
                      <td>{t.close_price || '-'}</td>
                      <td className={t.pnl >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: 700 }}>
                        {t.pnl >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}
                      </td>
                      <td>${t.spread_charged?.toFixed(2)}</td>
                      <td>${t.swap_charged?.toFixed(2)}</td>
                      <td>${t.commission_charged?.toFixed(2)}</td>
                      <td style={{ fontSize: 10 }}>{new Date(t.open_time).toLocaleString()}</td>
                      <td style={{ fontSize: 10 }}>{t.close_time ? new Date(t.close_time).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tradeTotal > 50 && (
            <div className="dash-pagination">
              <button disabled={tradePage <= 1} onClick={() => { setTradePage(p => p - 1); loadAll() }}>PREV</button>
              <span className="mono-label">PAGE {tradePage}</span>
              <button disabled={tradePage >= Math.ceil(tradeTotal / 50)} onClick={() => { setTradePage(p => p + 1); loadAll() }}>NEXT</button>
            </div>
          )}
        </>
      )}

      {/* === TRANSACTIONS TAB === */}
      {tab === 'transactions' && (
        <>
          {transactions.length === 0 ? (
            <div className="dash-empty"><p>No transactions.</p></div>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr><th>TYPE</th><th>METHOD</th><th>AMOUNT</th><th>STATUS</th><th>DATE</th></tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td><span className="dash-badge">{t.type.toUpperCase()}</span></td>
                      <td>{t.method.replace(/_/g, ' ').toUpperCase()}</td>
                      <td style={{ fontWeight: 700 }}>${t.amount.toFixed(2)}</td>
                      <td><span className={`dash-status dash-status--${t.status}`}>{t.status.toUpperCase()}</span></td>
                      <td>{new Date(t.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
