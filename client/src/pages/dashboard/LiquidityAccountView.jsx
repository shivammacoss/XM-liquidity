/**
 * Read-only view of the Liquidity / API-feed sub-account.
 *
 * Shows only: open positions, pending orders, trade history.
 * NO chart, NO instruments panel, NO manual close — trades flow in from
 * the broker's API and lifecycle is managed by the LP.
 * Pending orders CAN be cancelled here.
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { tradesApi, accountsApi } from '../../services/dashboard'

const fmt = (n, d = 2) =>
  Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

const fmtTime = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function LiquidityAccountView() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const [account, setAccount] = useState(null)
  const [tab, setTab] = useState('positions')
  const [openTrades, setOpenTrades] = useState([])
  const [pendingTrades, setPendingTrades] = useState([])
  const [history, setHistory] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage] = useState(20)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(null)

  const loadAccount = useCallback(async () => {
    try {
      const { data } = await accountsApi.get(accountId)
      setAccount(data)
    } catch { /* keep null */ }
  }, [accountId])

  const loadOpen = useCallback(async () => {
    try {
      const { data } = await tradesApi.getOpen({ account_id: accountId })
      setOpenTrades(data || [])
    } catch { setOpenTrades([]) }
  }, [accountId])

  const loadPending = useCallback(async () => {
    try {
      const { data } = await tradesApi.getPending({ account_id: accountId })
      setPendingTrades(data || [])
    } catch { setPendingTrades([]) }
  }, [accountId])

  const loadHistory = useCallback(
    async (p = page) => {
      try {
        const { data } = await tradesApi.getHistory({
          account_id: accountId,
          page: p,
          per_page: perPage,
        })
        setHistory(data.trades || [])
        setHistoryTotal(data.total || 0)
      } catch {
        setHistory([])
        setHistoryTotal(0)
      }
    },
    [accountId, page, perPage]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await Promise.all([loadAccount(), loadOpen(), loadPending(), loadHistory(1)])
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [accountId, loadAccount, loadOpen, loadPending, loadHistory])

  // Refresh open/pending every 4s while page is mounted
  useEffect(() => {
    const t = setInterval(() => {
      loadOpen()
      loadPending()
    }, 4000)
    return () => clearInterval(t)
  }, [loadOpen, loadPending])

  const cancelPending = async (id) => {
    if (!confirm('Cancel this pending order?')) return
    setCancelling(id)
    try {
      await tradesApi.cancel(id)
      await loadPending()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to cancel order')
    } finally {
      setCancelling(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(historyTotal / perPage))

  return (
    <div className="dash-page">
      {/* Header */}
      <div className="liq-account__header">
        <div>
          <span className="mono-label">LIQUIDITY · API FEED · READ-ONLY</span>
          <h2 className="liq-account__title">
            {account?.account_number || 'Broker Trades'}
          </h2>
          <p className="liq-account__sub">
            Trades flow in from your broker via API · No manual close on open positions
          </p>
        </div>
        <div className="liq-account__header-right">
          <Link to="/dashboard/accounts" className="laser-btn laser-btn--sm laser-btn--outline">
            ← BACK TO ACCOUNTS
          </Link>
        </div>
      </div>

      {/* Account snapshot strip */}
      {account && (
        <div className="liq-snapshot">
          <div className="liq-snapshot__item">
            <span className="liq-snapshot__label">BALANCE</span>
            <span className="liq-snapshot__value">${fmt(account.balance)}</span>
          </div>
          <div className="liq-snapshot__item">
            <span className="liq-snapshot__label">EQUITY</span>
            <span className="liq-snapshot__value">${fmt(account.equity)}</span>
          </div>
          <div className="liq-snapshot__item">
            <span className="liq-snapshot__label">MARGIN USED</span>
            <span className="liq-snapshot__value">${fmt(account.margin_used)}</span>
          </div>
          <div className="liq-snapshot__item">
            <span className="liq-snapshot__label">FREE MARGIN</span>
            <span className="liq-snapshot__value">${fmt(account.free_margin)}</span>
          </div>
          <div className="liq-snapshot__item">
            <span className="liq-snapshot__label">P&amp;L</span>
            <span className={`liq-snapshot__value ${account.total_pnl >= 0 ? 'liq-pos' : 'liq-neg'}`}>
              {account.total_pnl >= 0 ? '+' : ''}${fmt(account.total_pnl)}
            </span>
          </div>
          <div className="liq-snapshot__item">
            <span className="liq-snapshot__label">LEVERAGE</span>
            <span className="liq-snapshot__value">1:{account.leverage}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="liq-tabs">
        <button
          className={`liq-tab ${tab === 'positions' ? 'liq-tab--active' : ''}`}
          onClick={() => setTab('positions')}
        >
          POSITIONS <span className="liq-tab__count">{openTrades.length}</span>
        </button>
        <button
          className={`liq-tab ${tab === 'pending' ? 'liq-tab--active' : ''}`}
          onClick={() => setTab('pending')}
        >
          PENDING <span className="liq-tab__count">{pendingTrades.length}</span>
        </button>
        <button
          className={`liq-tab ${tab === 'history' ? 'liq-tab--active' : ''}`}
          onClick={() => setTab('history')}
        >
          HISTORY <span className="liq-tab__count">{historyTotal}</span>
        </button>
      </div>

      {loading ? (
        <div className="dash-loading">Loading…</div>
      ) : tab === 'positions' ? (
        <TradesTable
          rows={openTrades}
          empty="No open positions. Trades will appear here as soon as your broker API sends them."
          columns={['ticket', 'instrument', 'side', 'lot', 'open', 'current', 'sl', 'tp', 'pnl', 'opened']}
        />
      ) : tab === 'pending' ? (
        <TradesTable
          rows={pendingTrades}
          empty="No pending orders."
          columns={['ticket', 'instrument', 'side', 'type', 'lot', 'price', 'sl', 'tp', 'created', 'cancel']}
          onCancel={cancelPending}
          cancelling={cancelling}
        />
      ) : (
        <>
          <TradesTable
            rows={history}
            empty="No trade history yet."
            columns={['ticket', 'instrument', 'side', 'lot', 'open', 'close', 'pnl', 'spread', 'commission', 'closed']}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={historyTotal}
            onChange={(p) => {
              setPage(p)
              loadHistory(p)
            }}
          />
        </>
      )}
    </div>
  )
}

function TradesTable({ rows, empty, columns, onCancel, cancelling }) {
  if (rows.length === 0) {
    return <div className="liq-empty"><p>{empty}</p></div>
  }
  return (
    <div className="liq-table-wrap">
      <table className="liq-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{labelFor(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              {columns.map((c) => (
                <td key={c}>{renderCell(c, t, onCancel, cancelling)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function labelFor(c) {
  const map = {
    ticket: 'TICKET',
    instrument: 'INSTRUMENT',
    side: 'SIDE',
    type: 'TYPE',
    lot: 'LOT',
    price: 'PRICE',
    open: 'OPEN',
    current: 'CURRENT',
    close: 'CLOSE',
    sl: 'SL',
    tp: 'TP',
    pnl: 'P&L',
    spread: 'SPREAD',
    commission: 'COMM.',
    opened: 'OPENED',
    closed: 'CLOSED',
    created: 'CREATED',
    cancel: '',
  }
  return map[c] || c.toUpperCase()
}

function renderCell(col, t, onCancel, cancelling) {
  const fmt = (n, d = 5) =>
    n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  const f2 = (n) => (n == null ? '—' : Number(n).toFixed(2))
  switch (col) {
    case 'ticket':
      return <span style={{ fontFamily: 'Geist Mono', fontSize: 11 }}>{(t.id || '').slice(-8)}</span>
    case 'instrument':
      return <strong>{t.instrument}</strong>
    case 'side':
      return (
        <span style={{ color: t.direction === 'buy' ? '#5EE9A8' : '#FF6B6B', fontWeight: 600 }}>
          {(t.direction || '').toUpperCase()}
        </span>
      )
    case 'type':
      return (t.order_type || '').toUpperCase()
    case 'lot':
      return Number(t.lot_size || 0).toFixed(2)
    case 'price':
      return fmt(t.limit_price ?? t.trigger_price ?? t.open_price)
    case 'open':
      return fmt(t.open_price)
    case 'current':
      return fmt(t.current_price ?? t.open_price)
    case 'close':
      return fmt(t.close_price)
    case 'sl':
      return fmt(t.stop_loss)
    case 'tp':
      return fmt(t.take_profit)
    case 'pnl':
      return (
        <span style={{ color: (t.pnl ?? 0) >= 0 ? '#5EE9A8' : '#FF6B6B', fontWeight: 600 }}>
          {(t.pnl ?? 0) >= 0 ? '+' : ''}${f2(t.pnl)}
        </span>
      )
    case 'spread':
      return `$${f2(t.spread_charged)}`
    case 'commission':
      return `$${f2(t.commission_charged)}`
    case 'opened':
      return fmtTimeShort(t.open_time)
    case 'closed':
      return fmtTimeShort(t.close_time)
    case 'created':
      return fmtTimeShort(t.created_at)
    case 'cancel':
      return (
        <button
          className="dash-btn-sm dash-btn-sm--red"
          disabled={cancelling === t.id}
          onClick={() => onCancel?.(t.id)}
        >
          {cancelling === t.id ? '…' : 'CANCEL'}
        </button>
      )
    default:
      return '—'
  }
}

function fmtTimeShort(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function Pagination({ page, totalPages, total, onChange }) {
  if (total === 0) return null
  return (
    <div className="liq-pagination">
      <span className="liq-pagination__info">
        Page {page} of {totalPages} · {total} total trade{total === 1 ? '' : 's'}
      </span>
      <div className="liq-pagination__btns">
        <button
          className="dash-btn-sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          ← PREV
        </button>
        <button
          className="dash-btn-sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          NEXT →
        </button>
      </div>
    </div>
  )
}
