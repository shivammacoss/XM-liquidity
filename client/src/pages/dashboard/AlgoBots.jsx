/**
 * XMLiquidity — Algo Bots Page
 * Create bots, get webhook URLs, view signal history.
 */

import { useState, useEffect } from 'react'
import { botsApi, accountsApi } from '../../services/dashboard'

export default function AlgoBots() {
  const [bots, setBots] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedBot, setSelectedBot] = useState(null)
  const [signals, setSignals] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  /** Right after CREATE — full webhook + secret + JSON (shown once here) */
  const [createSuccess, setCreateSuccess] = useState(null)

  // Create form
  const [botName, setBotName] = useState('')
  const [botAccount, setBotAccount] = useState('')
  const [botLotSize, setBotLotSize] = useState(0.01)
  const [botMaxLot, setBotMaxLot] = useState(1)
  const [botRiskPct, setBotRiskPct] = useState(0)
  const [botUseSl, setBotUseSl] = useState(true)
  const [botUseTp, setBotUseTp] = useState(true)
  const [botDefaultAction, setBotDefaultAction] = useState('') // '' | buy | sell — for price alerts without \"action\"
  const [botFixedSymbol, setBotFixedSymbol] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [b, a] = await Promise.all([botsApi.list(), accountsApi.list()])
      setBots(b.data); setAccounts(a.data.accounts.filter(ac => ac.is_funded))
    } catch { /* empty */ } finally { setLoading(false) }
  }

  const copyText = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage(`${label} copied`)
      setTimeout(() => setMessage(''), 2500)
    } catch { /* ignore */ }
  }

  const handleCreate = async (e) => {
    e.preventDefault(); setCreating(true); setError(''); setCreateSuccess(null)
    try {
      const { data } = await botsApi.create({
        account_id: botAccount,
        name: botName,
        default_lot_size: botLotSize,
        max_lot_size: botMaxLot,
        risk_per_trade_pct: botRiskPct,
        use_sl: botUseSl,
        use_tp: botUseTp,
        default_order_action: botDefaultAction || undefined,
        fixed_symbol: botFixedSymbol.trim() || undefined,
      })
      setCreateSuccess({
        name: data.name,
        webhook_url: data.webhook_url,
        webhook_secret: data.webhook_secret,
        message_minimal_json: data.message_minimal_json,
        message_full_json: data.message_full_json,
        hint: data.hint,
      })
      setMessage('')
      setShowCreate(false)
      setBotName('')
      setBotAccount('')
      loadData()
    } catch (err) { setError(err.response?.data?.detail || 'Failed') }
    finally { setCreating(false) }
  }

  const loadSignals = async (botId) => {
    const { data } = await botsApi.signals(botId)
    setSignals(data.signals)
    setSelectedBot(botId)
  }

  const toggleBot = async (botId) => {
    await botsApi.toggle(botId); loadData()
  }

  if (loading) return <div className="dash-loading">Loading...</div>

  return (
    <div className="dash-page">
      <div className="dash-page__header">
        <div>
          <h2 className="dash-page__title">ALGO BOTS</h2>
          <p className="dash-page__subtitle">Connect TradingView strategies for auto-execution</p>
        </div>
        <button className="laser-btn laser-btn--sm" onClick={() => { setShowCreate(!showCreate); setError('') }}>
          {showCreate ? 'CANCEL' : '+ NEW BOT'}
        </button>
      </div>

      {message && <div className="dash-success">{message}</div>}
      {error && <div className="auth-form__error">{error}</div>}

      <div
        className="dash-create-card"
        style={{
          maxWidth: 720,
          marginBottom: 20,
          borderColor: '#c9a227',
          background: 'rgba(201, 162, 39, 0.08)',
        }}
      >
        <h3 className="dash-create-card__title" style={{ fontSize: 14, marginBottom: 10 }}>
          TradingView webhook — localhost error fix
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
          <strong>TradingView servers cannot reach</strong> <code>http://localhost:8000</code> or your PC.
          The red message <strong>&quot;Only port 80 is allowed for HTTP&quot;</strong> appears because HTTP on port{' '}
          <strong>8000</strong> is blocked — use <strong>HTTPS</strong> with a <strong>public</strong> URL.
        </p>
        <ol style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>
            Install <a href="https://ngrok.com/download" target="_blank" rel="noopener noreferrer">ngrok</a>, run:{' '}
            <code style={{ fontSize: 11 }}>ngrok http 8000</code>
          </li>
          <li>
            Copy the <strong>https://…ngrok-free.app</strong> URL (must start with <code>https://</code>)
          </li>
          <li>
            In <code>server/.env</code> set: <code>PUBLIC_API_BASE_URL=https://YOUR-subdomain.ngrok-free.app</code> (no trailing slash)
          </li>
          <li>Restart the API (uvicorn). Refresh this page — webhook URLs update automatically.</li>
          <li>Paste the <strong>new</strong> webhook URL into TradingView → Alert → Notifications.</li>
        </ol>
      </div>

      <div
        className="dash-create-card"
        style={{
          maxWidth: 720,
          marginBottom: 20,
          borderColor: 'rgba(80, 220, 120, 0.45)',
          background: 'rgba(80, 220, 120, 0.06)',
        }}
      >
        <h3 className="dash-create-card__title" style={{ fontSize: 14, marginBottom: 10 }}>
          Alert fire ho → turant trade (auto execution)
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
          Ye flow <strong>already backend par wired hai</strong>: TradingView alert POST → webhook → account par{' '}
          <strong>buy/sell order</strong>. Tumhe sirf neeche checklist follow karni hai.
        </p>
        <ul style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, paddingLeft: 18, lineHeight: 1.65 }}>
          <li><strong>Bot ACTIVE</strong> ho (PAUSE mat rakho). Linked account <strong>funded</strong> ho.</li>
          <li>Jo symbol trade karna hai (jaise <strong>XAUUSD</strong>), wo <strong>Admin → Instruments</strong> par active ho / seed mein ho.</li>
          <li>TradingView alert: <strong>Webhook URL</strong> = dashboard / bot card se <strong>https://…ngrok…/api/v1/bots/webhook/…</strong></li>
          <li>Alert <strong>Message</strong> = bot card se copy kiya hua <strong>minimal JSON</strong> (tickersymbol + price + lot).</li>
          <li>Agar JSON mein <code>action</code> nahi hai → bot create karte waqt <strong>Default order Buy/Sell</strong> set karo, ya JSON mein <code>&quot;action&quot;:&quot;buy&quot;</code> likho.</li>
          <li><strong>ngrok</strong> chalti rahe jab test karo; <code>PUBLIC_API_BASE_URL</code> same ngrok HTTPS ho.</li>
          <li>Execution history: <strong>VIEW SIGNALS</strong> yahan, trades <strong>Orders</strong> page par.</li>
        </ul>
      </div>

      {createSuccess && (
        <div className="dash-create-card" style={{ maxWidth: 720, borderColor: 'var(--accent)', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h3 className="dash-create-card__title" style={{ marginBottom: 8 }}>BOT CREATED — WEBHOOK &amp; TRADINGVIEW</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                <strong>{createSuccess.name}</strong> — paste these into TradingView → Create alert → Notifications.
              </p>
            </div>
            <button type="button" className="dash-btn-sm" onClick={() => setCreateSuccess(null)}>DISMISS</button>
          </div>
          <ol style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '16px 0', paddingLeft: 20 }}>
            <li>Webhook URL → TradingView &quot;Webhook URL&quot; field</li>
            <li>Alert message → paste <strong>minimal JSON</strong> below (secret is already inside the URL path)</li>
            <li>Use <strong>PUBLIC_API_BASE_URL</strong> in server .env so this URL is reachable from the internet (ngrok/production)</li>
          </ol>
          <div className="auth-form__group" style={{ marginBottom: 8 }}>
            <label className="auth-form__label">WEBHOOK URL</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <code style={{ flex: 1, minWidth: 200, fontSize: 11, wordBreak: 'break-all', padding: 8, background: 'rgba(0,0,0,0.25)', borderRadius: 4 }}>{createSuccess.webhook_url}</code>
              <button type="button" className="dash-btn-sm" onClick={() => copyText('Webhook URL', createSuccess.webhook_url)}>COPY</button>
            </div>
          </div>
          <div className="auth-form__group" style={{ marginBottom: 8 }}>
            <label className="auth-form__label">WEBHOOK SECRET (PATH TOKEN — SAME AS IN URL)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <code style={{ flex: 1, minWidth: 200, fontSize: 11, wordBreak: 'break-all', padding: 8, background: 'rgba(0,0,0,0.25)', borderRadius: 4 }}>{createSuccess.webhook_secret}</code>
              <button type="button" className="dash-btn-sm" onClick={() => copyText('Secret', createSuccess.webhook_secret)}>COPY</button>
            </div>
          </div>
          <div className="auth-form__group" style={{ marginBottom: 8 }}>
            <label className="auth-form__label">ALERT MESSAGE (MINIMAL JSON)</label>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, padding: 12, background: 'rgba(0,0,0,0.25)', borderRadius: 4, fontSize: 11 }}>
              {createSuccess.message_minimal_json}
            </pre>
            <button type="button" className="dash-btn-sm" style={{ marginTop: 8 }} onClick={() => copyText('Alert JSON', createSuccess.message_minimal_json)}>COPY JSON</button>
          </div>
          {createSuccess.hint && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>{createSuccess.hint}</p>
          )}
        </div>
      )}

      {showCreate && (
        <div className="dash-create-card">
          <h3 className="dash-create-card__title">CREATE BOT</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
            Yahan se tumhara logic create hota hai: submit ke baad <strong>Webhook URL</strong>, <strong>secret</strong>, aur TradingView ke liye <strong>JSON</strong> screen par dikhega.
            Pehle funded account select karna zaroori hai.
          </p>
          <form onSubmit={handleCreate} className="auth-form" style={{ maxWidth: 500 }}>
            <div className="auth-form__group">
              <label className="auth-form__label">BOT NAME</label>
              <input className="auth-form__input" value={botName} onChange={(e) => setBotName(e.target.value)} required placeholder="My EURUSD Bot" />
            </div>
            <div className="auth-form__group">
              <label className="auth-form__label">TRADING ACCOUNT</label>
              <select className="auth-form__input" value={botAccount} onChange={(e) => setBotAccount(e.target.value)} required>
                <option value="">Select funded account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_number} - ${a.balance.toFixed(2)}</option>
                ))}
              </select>
            </div>
            <div className="auth-form__group">
              <label className="auth-form__label">DEFAULT LOT SIZE</label>
              <input type="number" className="auth-form__input" value={botLotSize} onChange={(e) => setBotLotSize(parseFloat(e.target.value))} step="0.01" min="0.01" />
            </div>
            <div className="auth-form__group">
              <label className="auth-form__label">MAX LOT (CAP)</label>
              <input type="number" className="auth-form__input" value={botMaxLot} onChange={(e) => setBotMaxLot(parseFloat(e.target.value))} step="0.01" min="0.01" />
            </div>
            <div className="auth-form__group">
              <label className="auth-form__label">RISK % PER TRADE (0 = FIXED LOTS ONLY)</label>
              <input type="number" className="auth-form__input" value={botRiskPct} onChange={(e) => setBotRiskPct(parseFloat(e.target.value))} step="0.1" min="0" max="100" />
            </div>
            <div className="auth-form__group" style={{ flexDirection: 'row', gap: 24, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={botUseSl} onChange={(e) => setBotUseSl(e.target.checked)} />
                USE STOP LOSS FROM ALERT
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={botUseTp} onChange={(e) => setBotUseTp(e.target.checked)} />
                USE TAKE PROFIT FROM ALERT
              </label>
            </div>
            <div className="auth-form__group">
              <label className="auth-form__label">DEFAULT ORDER (PRICE ALERTS — IF JSON HAS NO &quot;action&quot;)</label>
              <select className="auth-form__input" value={botDefaultAction} onChange={(e) => setBotDefaultAction(e.target.value)}>
                <option value="">NONE — MUST PUT buy/sell IN ALERT JSON</option>
                <option value="buy">BUY</option>
                <option value="sell">SELL</option>
              </select>
            </div>
            <div className="auth-form__group">
              <label className="auth-form__label">FIXED SYMBOL (OPTIONAL, E.G. XAUUSD IF TICKER MISSING)</label>
              <input className="auth-form__input" value={botFixedSymbol} onChange={(e) => setBotFixedSymbol(e.target.value.toUpperCase())} placeholder="XAUUSD" maxLength={32} />
            </div>
            <button type="submit" className="laser-btn" disabled={creating}>{creating ? 'CREATING...' : 'CREATE BOT'}</button>
          </form>
        </div>
      )}

      <div className="dash-accounts-grid">
        {bots.length === 0 ? <div className="dash-empty"><p>No bots created yet.</p></div> : bots.map((b) => (
          <div key={b.id} className="dash-account-card">
            <div className="dash-account-card__header">
              <span className="dash-account-card__type">{b.status.toUpperCase()}</span>
              <button className="dash-btn-sm" onClick={() => toggleBot(b.id)}>{b.status === 'active' ? 'PAUSE' : 'ACTIVATE'}</button>
            </div>
            <div className="dash-account-card__number">{b.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all', margin: '8px 0' }}>
              Webhook: <span style={{ color: 'var(--accent)' }}>{b.webhook_url}</span>
            </div>
            {(b.default_order_action || b.fixed_symbol) && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                {b.default_order_action && <>Default order: <strong>{b.default_order_action}</strong>{' '}</>}
                {b.fixed_symbol && <>Fixed symbol: <strong>{b.fixed_symbol}</strong></>}
              </div>
            )}
            {b.message_minimal_json && (
              <details style={{ fontSize: 10, marginBottom: 8 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--accent)' }}>TradingView alert JSON (copy)</summary>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.25)', borderRadius: 4 }}>
                  {b.message_minimal_json}
                </pre>
                <button type="button" className="dash-btn-sm" style={{ marginTop: 4 }} onClick={() => { navigator.clipboard.writeText(b.message_minimal_json); setMessage('Alert JSON copied') }}>
                  COPY JSON
                </button>
              </details>
            )}
            <div className="dash-account-card__meta">
              <div><span className="dash-account-card__label">SIGNALS</span><span>{b.total_signals}</span></div>
              <div><span className="dash-account-card__label">TRADES</span><span>{b.total_trades_executed}</span></div>
              <div><span className="dash-account-card__label">P&L</span><span className={b.total_pnl >= 0 ? 'text-green' : 'text-red'}>${b.total_pnl}</span></div>
              {typeof b.risk_per_trade_pct === 'number' && b.risk_per_trade_pct > 0 && (
                <div><span className="dash-account-card__label">RISK %</span><span>{b.risk_per_trade_pct}%</span></div>
              )}
            </div>
            <button className="dash-btn-sm" onClick={() => loadSignals(b.id)}>VIEW SIGNALS</button>
          </div>
        ))}
      </div>

      {selectedBot && signals.length > 0 && (
        <>
          <h3 className="dash-home__section-title" style={{ marginTop: 32 }}>SIGNAL HISTORY</h3>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead><tr><th>ACTION</th><th>INSTRUMENT</th><th>LOT</th><th>PRICE</th><th>STATUS</th><th>TIME</th></tr></thead>
              <tbody>
                {signals.map((s) => (
                  <tr key={s.id}>
                    <td><span className={`dash-direction dash-direction--${s.action}`}>{s.action.toUpperCase()}</span></td>
                    <td>{s.instrument}</td><td>{s.lot_size}</td><td>{s.price}</td>
                    <td><span className={`dash-status dash-status--${s.status}`}>{s.status.toUpperCase()}</span></td>
                    <td>{new Date(s.created_at).toLocaleString()}</td>
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
