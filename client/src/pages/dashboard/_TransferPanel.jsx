/**
 * Modal-style internal transfer panel for the Accounts page.
 * Direction: wallet ↔ account. Uses the existing /wallet/transfer endpoint.
 */

import { useState } from 'react'
import { walletApi } from '../../services/dashboard'

export default function TransferPanel({ account, wallet, onClose, onDone }) {
  const [direction, setDirection] = useState('wallet_to_account')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fmt = (n) =>
    Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const walletBal = wallet?.balance ?? 0
  const accountFree = (account?.balance ?? 0) - (account?.margin_used ?? 0)
  const sourceBal = direction === 'wallet_to_account' ? walletBal : accountFree
  const sourceLabel = direction === 'wallet_to_account' ? 'Wallet balance' : 'Account free margin'

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (amt > sourceBal) {
      setError(`Insufficient ${direction === 'wallet_to_account' ? 'wallet balance' : 'free margin'}`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await walletApi.transfer({ amount: amt, direction, account_id: account.id })
      onDone?.()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Transfer failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="liq-transfer-overlay" onClick={onClose}>
      <div className="liq-transfer" onClick={(e) => e.stopPropagation()}>
        <div className="liq-transfer__head">
          <div>
            <span className="mono-label">INTERNAL TRANSFER</span>
            <h3 className="liq-transfer__title">
              {direction === 'wallet_to_account' ? 'Fund account' : 'Withdraw to wallet'}
            </h3>
            <p className="liq-transfer__sub">{account.account_number}</p>
          </div>
          <button className="liq-transfer__close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="liq-transfer__dir">
          <button
            type="button"
            className={`liq-transfer__dir-btn ${direction === 'wallet_to_account' ? 'liq-transfer__dir-btn--active' : ''}`}
            onClick={() => setDirection('wallet_to_account')}
          >
            <strong>WALLET → ACCOUNT</strong>
            <span>Add funds to trade</span>
          </button>
          <button
            type="button"
            className={`liq-transfer__dir-btn ${direction === 'account_to_wallet' ? 'liq-transfer__dir-btn--active' : ''}`}
            onClick={() => setDirection('account_to_wallet')}
          >
            <strong>ACCOUNT → WALLET</strong>
            <span>Return free margin</span>
          </button>
        </div>

        <div className="liq-transfer__row">
          <span className="liq-transfer__row-label">{sourceLabel}</span>
          <span className="liq-transfer__row-value">${fmt(sourceBal)}</span>
        </div>
        <div className="liq-transfer__row">
          <span className="liq-transfer__row-label">Account balance</span>
          <span className="liq-transfer__row-value">${fmt(account.balance)}</span>
        </div>

        <form onSubmit={handleSubmit} className="liq-transfer__form">
          <label className="liq-transfer__label">AMOUNT (USD)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={sourceBal}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="liq-transfer__input"
            required
          />
          <div className="liq-transfer__quick">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                type="button"
                className="liq-transfer__quick-btn"
                onClick={() => setAmount((sourceBal * p / 100).toFixed(2))}
              >
                {p}%
              </button>
            ))}
          </div>

          {error && <div className="liq-transfer__error">{error}</div>}

          <button
            type="submit"
            className="laser-btn"
            disabled={submitting}
            style={{ width: '100%', marginTop: 8 }}
          >
            {submitting ? 'TRANSFERRING…' : 'CONFIRM TRANSFER'}
          </button>
        </form>
      </div>
    </div>
  )
}
