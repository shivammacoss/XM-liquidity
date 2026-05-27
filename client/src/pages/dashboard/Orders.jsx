/**
 * XMLiquidity — Orders Page
 * Live trades, pending orders, trade history with pagination.
 */

import { useState, useEffect } from 'react'
import { tradesApi, accountsApi } from '../../services/dashboard'

export default function Orders() {
  const [tab, setTab] = useState('open')
  const [trades, setTrades] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedAccount, setSelectedAccount] = useState('')

  useEffect(() => { loadAccounts() }, [])
  useEffect(() => { loadTrades() }, [tab, page, selectedAccount])

  const loadAccounts = async () => {
    try { const { data } = await accountsApi.list(); setAccounts(data.accounts) } catch { /* empty */ }
  }

  const loadTrades = async () => {
    setLoading(true)
    try {
      const params = selectedAccount ? { account_id: selectedAccount } : {}
      let res
      if (tab === 'open') res = await tradesApi.getOpen(params)
      else if (tab === 'pending') res = await tradesApi.getPending(params)
      else res = await tradesApi.getHistory({ ...params, page, per_page: 20 })

      if (tab === 'history') {
        setTrades(res.data.trades)
        setTotal(res.data.total)
      } else {
        setTrades(res.data)
        setTotal(res.data.length)
      }
    } catch { /* empty */ } finally { setLoading(false) }
  }

  const handleClose = async (tradeId, currentPrice) => {
    if (!confirm('Close this trade?')) return
    try {
      await tradesApi.close(tradeId, { close_price: currentPrice })
      loadTrades()
    } catch { /* empty */ }
  }

  const handleCancel = async (tradeId) => {
    try { await tradesApi.cancel(tradeId); loadTrades() } catch { /* empty */ }
  }

  return (
    <div className="dash-page">
      <div className="dash-page__header">
        <div>
          <h2 className="dash-page__title">ORDERS</h2>
          <p className="dash-page__subtitle">View and manage your trades</p>
        </div>
        <select className="auth-form__input" style={{ width: 'auto', minWidth: 200 }}
          value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
          <option value="">ALL ACCOUNTS</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.account_number} ({a.account_type.toUpperCase()})</option>
          ))}
        </select>
      </div>

      <div className="dash-tabs">
        {[{ key: 'open', label: 'OPEN TRADES' }, { key: 'pending', label: 'PENDING' }, { key: 'history', label: 'HISTORY' }].map((t) => (
          <button key={t.key} className={`dash-tab ${tab === t.key ? 'dash-tab--active' : ''}`}
            onClick={() => { setTab(t.key); setPage(1) }}>{t.label}</button>
        ))}
      </div>

      {loading ? <div className="dash-loading">Loading trades...</div> : trades.length === 0 ? (
        <div className="dash-empty"><p>No {tab} trades.</p></div>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>INSTRUMENT</th><th>TYPE</th><th>LOT</th><th>OPEN PRICE</th>
                {tab === 'open' && <><th>CURRENT</th><th>P&L</th><th>SL / TP</th></>}
                {tab === 'history' && <><th>CLOSE PRICE</th><th>P&L</th></>}
                <th>TIME</th><th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.instrument}</strong></td>
                  <td><span className={`dash-direction dash-direction--${t.direction}`}>{t.direction.toUpperCase()}</span></td>
                  <td>{t.lot_size}</td>
                  <td>{t.open_price}</td>
                  {tab === 'open' && (
                    <>
                      <td>{t.current_price}</td>
                      <td className={t.unrealized_pnl >= 0 ? 'text-green' : 'text-red'}>${t.unrealized_pnl?.toFixed(2)}</td>
                      <td>{t.stop_loss || '-'} / {t.take_profit || '-'}</td>
                    </>
                  )}
                  {tab === 'history' && (
                    <>
                      <td>{t.close_price || '-'}</td>
                      <td className={t.pnl >= 0 ? 'text-green' : 'text-red'}>${t.pnl?.toFixed(2)}</td>
                    </>
                  )}
                  <td>{new Date(t.open_time).toLocaleString()}</td>
                  <td>
                    {tab === 'open' && (
                      <button className="dash-btn-sm dash-btn-sm--red" onClick={() => handleClose(t.id, t.current_price)}>CLOSE</button>
                    )}
                    {tab === 'pending' && (
                      <button className="dash-btn-sm dash-btn-sm--red" onClick={() => handleCancel(t.id)}>CANCEL</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && total > 20 && (
        <div className="dash-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>PREV</button>
          <span className="mono-label">PAGE {page} OF {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>NEXT</button>
        </div>
      )}
    </div>
  )
}
