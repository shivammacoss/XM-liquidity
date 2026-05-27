/**
 * XMLiquidity — Broker Liquidity Account (single-account, single-balance model)
 *
 *  - One liquidity account per broker
 *  - One balance (no separate wallet/internal transfer)
 *  - Locked capital is the protected baseline (set at provisioning)
 *  - If equity drops below 80% of locked capital → trades are blocked
 *    and the broker is prompted to refund the account.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { accountsApi, walletApi } from '../../services/dashboard'

const LOCKED_CAPITAL_FIXED = 5000        // fixed $5,000 floor for every broker
const LOCKED_CAPITAL_BUFFER = 0.80       // trades stop below 80% of locked capital

const fmtUSD = (n) =>
  Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export default function Accounts() {
  const navigate = useNavigate()
  const user = useSelector((s) => s.auth.user)
  const brokerName = user?.name || 'Broker'

  const [account, setAccount] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [locking, setLocking] = useState(false)
  const [lockMessage, setLockMessage] = useState('')

  const loadAll = async () => {
    try {
      const [accRes, walletRes] = await Promise.all([
        accountsApi.list().catch(() => ({ data: { accounts: [] } })),
        walletApi.get().catch(() => ({ data: null })),
      ])
      const nonProp = (accRes.data.accounts || []).filter((a) => !a.is_prop_account)
      setAccount(nonProp[0] || null)
      setWallet(walletRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const lockedCapital = LOCKED_CAPITAL_FIXED
  const equity = account?.equity ?? 0
  const balance = account?.balance ?? 0
  const walletBalance = wallet?.balance ?? 0
  const threshold = lockedCapital * LOCKED_CAPITAL_BUFFER
  const fullyLocked = balance >= lockedCapital
  const lockShortfall = Math.max(0, lockedCapital - balance)  // still need to deposit
  const canTopUpFromWallet = Math.min(lockShortfall, walletBalance)
  const belowThreshold = fullyLocked && equity < threshold
  const shortfall = Math.max(0, threshold - equity)
  const drawdownPct = lockedCapital > 0
    ? ((lockedCapital - equity) / lockedCapital) * 100
    : 0

  const handleLockFromWallet = async () => {
    setLocking(true)
    setLockMessage('')
    try {
      const { data } = await walletApi.lockFunds()
      setLockMessage(data?.message || 'Locked capital topped up.')
      await loadAll()
    } catch (err) {
      setLockMessage(err?.response?.data?.detail || 'Could not lock funds')
    } finally {
      setLocking(false)
      setTimeout(() => setLockMessage(''), 4000)
    }
  }

  return (
    <div className="dash-page">
      {/* Header */}
      <div className="liq-account__header">
        <div>
          <span className="mono-label">LIQUIDITY ACCOUNT</span>
          <h2 className="liq-account__title">{brokerName.toUpperCase()}</h2>
          <p className="liq-account__sub">
            One account · One balance · Trades stream in from your broker via API
          </p>
        </div>
        <div className="liq-account__header-right">
          <div
            className={`liq-account__badge ${
              !fullyLocked || belowThreshold ? 'liq-account__badge--warn' : ''
            }`}
          >
            <span className="status-dot" />
            {!fullyLocked ? 'LOCK PENDING' : belowThreshold ? 'TRADING PAUSED' : 'ACTIVE'}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="dash-loading">Loading liquidity account…</div>
      ) : !account ? (
        <div className="liq-empty">
          <p>
            Your liquidity account hasn't been provisioned yet. The XMLiquidity admin
            team will set it up shortly with your initial locked capital. Once provisioned,
            you'll be able to connect your broker platform from here.
          </p>
        </div>
      ) : (
        <>
          {lockMessage && <div className="dash-success">{lockMessage}</div>}

          {/* Lock-pending notification — broker hasn't locked the $5,000 floor yet */}
          {!fullyLocked && (
            <div className="liq-alert" role="alert">
              <div className="liq-alert__icon">$</div>
              <div className="liq-alert__body">
                <strong>LOCK CAPITAL PENDING — TRADE EXECUTION DISABLED</strong>
                <p>
                  XMLiquidity locks the first <strong>${fmtUSD(lockedCapital)}</strong> of
                  every deposit as protected trading capital. You've locked{' '}
                  <strong>${fmtUSD(balance)}</strong> so far — deposit{' '}
                  <strong>${fmtUSD(lockShortfall)}</strong> more (or top up from your wallet
                  if it has balance) to enable incoming API trades.
                </p>
              </div>
              {canTopUpFromWallet > 0 ? (
                <button
                  className="laser-btn laser-btn--sm"
                  onClick={handleLockFromWallet}
                  disabled={locking}
                >
                  {locking ? 'LOCKING…' : `LOCK $${fmtUSD(canTopUpFromWallet)} FROM WALLET`}
                </button>
              ) : (
                <button
                  className="laser-btn laser-btn--sm"
                  onClick={() => navigate('/dashboard/wallet?action=deposit')}
                >
                  DEPOSIT
                </button>
              )}
            </div>
          )}

          {/* Drawdown notification — broker IS fully locked but lost >20% */}
          {fullyLocked && belowThreshold && (
            <div className="liq-alert" role="alert">
              <div className="liq-alert__icon">!</div>
              <div className="liq-alert__body">
                <strong>FUND YOUR ACCOUNT — TRADE EXECUTION PAUSED</strong>
                <p>
                  Your equity (<strong>${fmtUSD(equity)}</strong>) has dropped more than 20% below
                  your locked capital of <strong>${fmtUSD(lockedCapital)}</strong>.
                  Incoming API trades will be rejected until you top up at least{' '}
                  <strong>${fmtUSD(shortfall)}</strong> to restore the minimum threshold of
                  <strong> ${fmtUSD(threshold)}</strong>.
                </p>
              </div>
              <button
                className="laser-btn laser-btn--sm"
                onClick={() => navigate('/dashboard/wallet?action=deposit')}
              >
                FUND ACCOUNT
              </button>
            </div>
          )}

          {/* Account card */}
          <div
            className="liq-sub liq-sub--api"
            style={{ marginTop: !fullyLocked || belowThreshold ? 16 : 0 }}
          >
            <div className="liq-sub__head">
              <div>
                <span className="mono-label">YOUR LIQUIDITY ACCOUNT</span>
                <h3 className="liq-sub__title">
                  {account.account_number} · 1:{account.leverage}
                </h3>
              </div>
              <div className="liq-sub__kind liq-sub__kind--api">API FEED</div>
            </div>

            <p className="liq-sub__desc">
              Trades arrive via authenticated webhook from your broker platform.
              XMLiquidity executes against tier-1 liquidity and deducts the configured
              spread, commission, and overnight swap per fill.
            </p>

            {/* Big single-balance row */}
            <div className="liq-balance">
              <div className="liq-balance__main">
                <span className="liq-balance__label">CURRENT BALANCE</span>
                <span className="liq-balance__value">${fmtUSD(balance)}</span>
              </div>
              <div className="liq-balance__divider" />
              <div className="liq-balance__locked">
                <span className="liq-balance__label">LOCKED CAPITAL</span>
                <span className="liq-balance__locked-value">${fmtUSD(lockedCapital)}</span>
                <span className="liq-balance__hint">
                  {fullyLocked
                    ? `Threshold $${fmtUSD(threshold)} (80% of locked)`
                    : `Locked $${fmtUSD(balance)} of $${fmtUSD(lockedCapital)}`}
                </span>
              </div>
              <div className={`liq-balance__drawdown ${drawdownPct > 0 ? 'liq-balance__drawdown--neg' : ''}`}>
                <span className="liq-balance__label">DRAWDOWN</span>
                <span className="liq-balance__value">
                  {drawdownPct > 0 ? '-' : ''}{Math.abs(drawdownPct).toFixed(2)}%
                </span>
                <span className="liq-balance__hint">
                  {drawdownPct > 20 ? 'Above limit · trades paused' : `Of locked capital (limit 20%)`}
                </span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="liq-sub__stats">
              <div className="liq-sub__stat">
                <span className="liq-sub__stat-label">EQUITY</span>
                <span className="liq-sub__stat-value">${fmtUSD(equity)}</span>
              </div>
              <div className="liq-sub__stat">
                <span className="liq-sub__stat-label">FREE MARGIN</span>
                <span className="liq-sub__stat-value">${fmtUSD(account.free_margin)}</span>
              </div>
              <div className="liq-sub__stat">
                <span className="liq-sub__stat-label">MARGIN USED</span>
                <span className="liq-sub__stat-value">${fmtUSD(account.margin_used)}</span>
              </div>
              <div className="liq-sub__stat">
                <span className="liq-sub__stat-label">P&amp;L</span>
                <span
                  className={`liq-sub__stat-value ${
                    (account.total_pnl ?? 0) >= 0 ? 'liq-pos' : 'liq-neg'
                  }`}
                >
                  {(account.total_pnl ?? 0) >= 0 ? '+' : ''}${fmtUSD(account.total_pnl)}
                </span>
              </div>
              <div className="liq-sub__stat">
                <span className="liq-sub__stat-label">OPEN TRADES</span>
                <span className="liq-sub__stat-value">{account.open_trades ?? 0}</span>
              </div>
              <div className="liq-sub__stat">
                <span className="liq-sub__stat-label">TOTAL TRADES</span>
                <span className="liq-sub__stat-value">{account.total_trades ?? 0}</span>
              </div>
            </div>

            <div className="liq-sub__actions">
              <button
                className="laser-btn laser-btn--sm"
                onClick={() => navigate(`/dashboard/liquidity/${account.id}`)}
              >
                VIEW POSITIONS &amp; HISTORY
              </button>
              <button
                className="laser-btn laser-btn--sm laser-btn--outline"
                onClick={() => navigate('/dashboard/api-access')}
              >
                CONNECT BROKER (API DOCS)
              </button>
              <button
                className="laser-btn laser-btn--sm laser-btn--outline"
                onClick={() => navigate('/dashboard/wallet?action=deposit')}
              >
                DEPOSIT
              </button>
            </div>
          </div>

          {/* How-it-works strip */}
          <div className="liq-howto">
            <div className="liq-howto__step">
              <div className="liq-howto__num">1</div>
              <div className="liq-howto__body">
                <div className="liq-howto__title">DEPOSIT</div>
                <div className="liq-howto__desc">Fund your account via crypto (BTC / ETH / USDT).</div>
              </div>
            </div>
            <div className="liq-howto__step">
              <div className="liq-howto__num">2</div>
              <div className="liq-howto__body">
                <div className="liq-howto__title">CONNECT</div>
                <div className="liq-howto__desc">Connect your broker into our webhook.</div>
              </div>
            </div>
            <div className="liq-howto__step">
              <div className="liq-howto__num">3</div>
              <div className="liq-howto__body">
                <div className="liq-howto__title">TRADE</div>
                <div className="liq-howto__desc">Signals stream in. We execute &amp; deduct charges.</div>
              </div>
            </div>
            <div className="liq-howto__step">
              <div className="liq-howto__num">4</div>
              <div className="liq-howto__body">
                <div className="liq-howto__title">PROTECT</div>
                <div className="liq-howto__desc">20% drawdown limit on locked capital. Refund to resume.</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
