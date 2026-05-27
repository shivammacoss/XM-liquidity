/**
 * XMLiquidity — Broker Dashboard Home
 *
 * Layout:
 *   Section A — Account Equity Snapshot (10 KPI tiles)
 *   Section B — Today's Summary (7 tiles + live clock + refresh)
 *   Section C — Lifetime Stats (4 tiles)
 *
 * All metrics derived from accountsApi + tradesApi.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { accountsApi, tradesApi } from '../../services/dashboard'

// $4 minimum per-trade charge concept — used to backstop the "Total Charges" label.
const MIN_CHARGE_PER_TRADE = 4

const fmt = (n, d = 2) =>
  Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
const sign = (n) => (Number(n ?? 0) >= 0 ? '+' : '-')
const abs = (n) => Math.abs(Number(n ?? 0))
const fmtSigned = (n, d = 2) => `${sign(n)}$${fmt(abs(n), d)}`

const startOfTodayMs = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const tsMs = (v) => {
  if (!v) return 0
  const t = Date.parse(v)
  return Number.isNaN(t) ? 0 : t
}

export default function DashboardHome() {
  const { user } = useAuth()

  const [account, setAccount] = useState(null)
  const [openTrades, setOpenTrades] = useState([])
  const [closedTrades, setClosedTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshAt, setRefreshAt] = useState(new Date())
  const [now, setNow] = useState(new Date())

  const loadAll = useCallback(async () => {
    try {
      const accRes = await accountsApi.list().catch(() => ({ data: { accounts: [] } }))
      const nonProp = (accRes.data.accounts || []).filter((a) => !a.is_prop_account)
      const acc = nonProp[0] || null
      setAccount(acc)
      if (acc?.id) {
        const [openRes, histRes] = await Promise.all([
          tradesApi.getOpen({ account_id: acc.id }).catch(() => ({ data: [] })),
          tradesApi
            .getHistory({ account_id: acc.id, page: 1, per_page: 100 })
            .catch(() => ({ data: { trades: [], total: 0 } })),
        ])
        setOpenTrades(openRes.data || [])
        setClosedTrades(histRes.data.trades || [])
      } else {
        setOpenTrades([])
        setClosedTrades([])
      }
    } finally {
      setLoading(false)
      setRefreshAt(new Date())
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // --- Derived metrics -----------------------------------------------------
  const m = useMemo(() => {
    const equity = account?.equity ?? 0
    const balance = account?.balance ?? 0
    const freeMargin = account?.free_margin ?? 0
    const marginUsed = account?.margin_used ?? 0
    const lockedCapital = account?.initial_deposit ?? 0
    const lifetimeTrades = account?.total_trades ?? 0
    const lifetimeVolume = account?.total_volume ?? 0
    const accountStatus = account?.status ?? '—'

    const rawPnL = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0)
    const closedChargesSum = closedTrades.reduce(
      (s, t) =>
        s + Math.max(MIN_CHARGE_PER_TRADE, (t.spread_charged ?? 0) + (t.commission_charged ?? 0)),
      0
    )
    const netPnL = rawPnL - closedChargesSum
    const floatingPnL = openTrades.reduce((s, t) => s + (t.pnl ?? 0), 0)

    const profitWallet = Math.max(0, equity - lockedCapital)
    const withdrawable = Math.max(0, balance - lockedCapital - marginUsed)

    const todayStart = startOfTodayMs()
    const openedToday = [...openTrades, ...closedTrades].filter(
      (t) => tsMs(t.open_time) >= todayStart
    )
    const closedToday = closedTrades.filter((t) => tsMs(t.close_time) >= todayStart)

    const todayVolume = openedToday.reduce((s, t) => s + (t.lot_size ?? 0), 0)
    const todayCommission = closedToday.reduce(
      (s, t) => s + (t.commission_charged ?? 0) + (t.spread_charged ?? 0),
      0
    )
    const todayNet = closedToday.reduce(
      (s, t) => s + (t.pnl ?? 0) - (t.spread_charged ?? 0) - (t.commission_charged ?? 0),
      0
    )

    return {
      equity, balance, freeMargin, marginUsed, lockedCapital,
      rawPnL, netPnL, floatingPnL, closedChargesSum,
      profitWallet, withdrawable,
      tradesReceivedToday: openedToday.length,
      tradesClosedToday: closedToday.length,
      openTradesNow: openTrades.length,
      todayVolume, todayCommission, todayNet,
      lifetimeTrades, lifetimeVolume, accountStatus,
    }
  }, [account, openTrades, closedTrades])

  const equityTiles = [
    { label: 'TOTAL EQUITY', value: `$${fmt(m.equity)}`, sub: 'USD' },
    { label: 'TOTAL CHARGES', value: `-$${fmt(m.closedChargesSum)}`, sub: 'Min $4/trade', tone: 'neg' },
    { label: 'RAW P&L', value: fmtSigned(m.rawPnL), sub: 'From closed trades', tone: m.rawPnL >= 0 ? 'pos' : 'neg' },
    { label: 'NET P&L', value: fmtSigned(m.netPnL), sub: 'After Charges', tone: m.netPnL >= 0 ? 'pos' : 'neg' },
    { label: 'FLOATING P&L', value: fmtSigned(m.floatingPnL), sub: 'Open positions', tone: m.floatingPnL >= 0 ? 'pos' : 'neg' },
    { label: 'FREE MARGIN', value: `$${fmt(m.freeMargin)}`, sub: 'Available for trading' },
    { label: 'LOCKED CAPITAL', value: `$${fmt(m.lockedCapital)}`, sub: 'Minimum required' },
    { label: 'BALANCE', value: `$${fmt(m.balance)}`, sub: 'Total funds' },
    { label: 'PROFIT WALLET', value: `$${fmt(m.profitWallet)}`, sub: 'Above locked capital', tone: 'pos' },
    { label: 'WITHDRAWABLE', value: `$${fmt(m.withdrawable)}`, sub: 'Available to withdraw' },
  ]

  const todayTiles = [
    { label: 'TRADES RECEIVED', value: m.tradesReceivedToday },
    { label: 'TRADES CLOSED', value: m.tradesClosedToday },
    { label: 'OPEN TRADES', value: m.openTradesNow },
    { label: 'TODAY VOLUME', value: fmt(m.todayVolume) },
    { label: 'COMMISSION', value: `$${fmt(m.todayCommission)}`, tone: 'neg' },
    { label: 'FLOATING P/L', value: fmtSigned(m.floatingPnL), tone: m.floatingPnL >= 0 ? 'pos' : 'neg' },
    { label: 'NET REVENUE', value: fmtSigned(m.todayNet), tone: m.todayNet >= 0 ? 'pos' : 'neg' },
  ]

  const lifetimeTiles = [
    { label: 'TOTAL TRADES', value: m.lifetimeTrades },
    { label: 'OPEN TRADES', value: m.openTradesNow },
    { label: 'TOTAL VOLUME', value: fmt(m.lifetimeVolume) },
    {
      label: 'ACCOUNT STATUS',
      value: String(m.accountStatus),
      valueClass: m.accountStatus === 'active' ? 'liq-pos' : '',
    },
  ]

  return (
    <div className="dash-home">
      <div className="dash-home__welcome">
        <h2 className="dash-home__greeting">
          WELCOME BACK, <span className="accent">{(user?.name || 'BROKER').toUpperCase()}</span>
        </h2>
        <p className="dash-home__subtitle">
          Live snapshot of your liquidity account. All figures derived from your trade flow.
        </p>
      </div>

      {loading ? (
        <div className="dash-loading">Loading account snapshot…</div>
      ) : (
        <>
          {/* Section A — equity */}
          <div className="kpi-grid kpi-grid--equity">
            {equityTiles.map((t) => (
              <KpiTile key={t.label} {...t} />
            ))}
          </div>

          {/* Section B — Today's Summary */}
          <div className="kpi-section-head">
            <div>
              <span className="mono-label">TODAY'S SUMMARY</span>
              <h3 className="kpi-section-title">{now.toLocaleTimeString('en-GB', { hour12: false })}</h3>
            </div>
            <button className="dash-btn-sm" onClick={loadAll}>
              ↻ REFRESH
            </button>
          </div>
          <div className="kpi-grid kpi-grid--today">
            {todayTiles.map((t) => (
              <KpiTile key={t.label} {...t} compact />
            ))}
          </div>

          {/* Section C — Lifetime */}
          <div className="kpi-section-head" style={{ marginTop: 28 }}>
            <span className="mono-label">LIFETIME</span>
          </div>
          <div className="kpi-grid kpi-grid--lifetime">
            {lifetimeTiles.map((t) => (
              <KpiTile key={t.label} {...t} compact />
            ))}
          </div>

          <p className="dash-home__footer-note">
            Last refresh {refreshAt.toLocaleTimeString('en-GB', { hour12: false })} ·
            Sample of the last 100 closed trades used for P&L &amp; charges.
          </p>
        </>
      )}
    </div>
  )
}

function KpiTile({ label, value, sub, tone, compact, valueClass }) {
  return (
    <div className={`kpi ${compact ? 'kpi--compact' : ''}`}>
      <span className="kpi__label">{label}</span>
      <span
        className={`kpi__value ${
          tone === 'pos' ? 'liq-pos' : tone === 'neg' ? 'liq-neg' : ''
        } ${valueClass || ''}`}
      >
        {value}
      </span>
      {sub && <span className="kpi__sub">{sub}</span>}
    </div>
  )
}
