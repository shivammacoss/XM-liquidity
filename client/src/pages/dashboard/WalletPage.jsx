/**
 * XMLiquidity — Broker Wallet
 *
 * Three tabs:
 *   DEPOSIT   — pick TRC20 or BEP20, show address + QR + copy, upload proof
 *   WITHDRAW  — pick a saved payout address, submit amount; admin sends + approves
 *   HISTORY   — paginated transaction list
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { walletApi, bankingApi } from '../../services/dashboard'

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace(/\/api\/v1\/?$/, '')

const fmt = (n) =>
  Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

export default function WalletPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('action') === 'withdraw' ? 'withdraw' : 'deposit'
  const [tab, setTab] = useState(initialTab)
  const [wallet, setWallet] = useState(null)

  const loadWallet = useCallback(async () => {
    try {
      const { data } = await walletApi.get()
      setWallet(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadWallet() }, [loadWallet])

  return (
    <div className="dash-page">
      <div className="liq-account__header">
        <div>
          <span className="mono-label">WALLET</span>
          <h2 className="liq-account__title">${fmt(wallet?.balance)}</h2>
          <p className="liq-account__sub">
            Deposited ${fmt(wallet?.total_deposited)} · Withdrawn ${fmt(wallet?.total_withdrawn)}
          </p>
        </div>
      </div>

      <div className="liq-tabs">
        {[
          { k: 'deposit', label: 'DEPOSIT' },
          { k: 'withdraw', label: 'WITHDRAW' },
          { k: 'history', label: 'HISTORY' },
        ].map((t) => (
          <button
            key={t.k}
            className={`liq-tab ${tab === t.k ? 'liq-tab--active' : ''}`}
            onClick={() => {
              setTab(t.k)
              const next = new URLSearchParams(searchParams)
              if (t.k === 'deposit') next.delete('action')
              else next.set('action', t.k)
              setSearchParams(next, { replace: true })
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'deposit' && <DepositTab onSubmitted={loadWallet} />}
      {tab === 'withdraw' && <WithdrawTab wallet={wallet} onSubmitted={loadWallet} />}
      {tab === 'history' && <HistoryTab />}
    </div>
  )
}

// ---------- DEPOSIT TAB ----------------------------------------------------
function DepositTab({ onSubmitted }) {
  const [addresses, setAddresses] = useState(null)
  const [network, setNetwork] = useState('trc20')
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    walletApi
      .depositAddresses()
      .then(({ data }) => setAddresses(data))
      .catch(() => setError('Could not load deposit addresses. Ask admin to configure them.'))
  }, [])

  const selected = useMemo(() => {
    if (!addresses) return null
    return addresses.networks.find((n) => n.code === network) || null
  }, [addresses, network])

  const handleProofChange = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError('')
    setUploading(true)
    try {
      const { data } = await walletApi.uploadProof(f)
      setUploadedUrl(data.url)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage('Address copied to clipboard.')
      setTimeout(() => setMessage(''), 1800)
    } catch { /* clipboard blocked */ }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (parseFloat(amount) < 5000) {
      setError('Minimum deposit amount is $5,000')
      return
    }
    if (!uploadedUrl) {
      setError('Please upload a payment screenshot before submitting.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await walletApi.deposit({
        amount: parseFloat(amount),
        method: 'crypto_usdt',
        network,
        crypto_txn_hash: txHash || undefined,
        proof_image_url: uploadedUrl,
      })
      setMessage('Deposit request submitted. Admin will verify and credit your wallet.')
      setAmount('')
      setTxHash('')
      setUploadedUrl('')
      onSubmitted?.()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not submit deposit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {message && <div className="dash-success">{message}</div>}
      {error && <div className="auth-form__error">{error}</div>}

      <div className="wallet-deposit">
        <div className="wallet-deposit__left">
          <div className="wallet-deposit__net-tabs">
            {(addresses?.networks || []).map((n) => (
              <button
                key={n.code}
                className={`wallet-deposit__net-tab ${network === n.code ? 'wallet-deposit__net-tab--active' : ''}`}
                onClick={() => setNetwork(n.code)}
              >
                {n.label}
              </button>
            ))}
          </div>

          {selected && selected.address ? (
            <div className="wallet-deposit__qr-card">
              <div className="wallet-deposit__qr">
                {selected.qr_url ? (
                  <img
                    src={`${API_ORIGIN}${selected.qr_url}`}
                    alt={`${selected.label} QR`}
                    style={{ width: 196, height: 196, objectFit: 'contain', display: 'block' }}
                  />
                ) : (
                  <QRCodeSVG
                    value={selected.address}
                    size={196}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    level="M"
                    includeMargin
                  />
                )}
              </div>
              <div className="wallet-deposit__address-row">
                <span className="mono-label">ADDRESS</span>
                <div className="wallet-deposit__addr">
                  <code>{selected.address}</code>
                  <button
                    type="button"
                    className="api-copy-btn"
                    onClick={() => copyToClipboard(selected.address)}
                  >
                    COPY
                  </button>
                </div>
                {selected.note && <p className="wallet-deposit__net-note">{selected.note}</p>}
              </div>
            </div>
          ) : (
            <div className="liq-empty">
              <p>This deposit network isn't configured yet. Ask the admin to set the address.</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="wallet-deposit__form">
          <h3 className="wallet-deposit__form-title">SUBMIT DEPOSIT</h3>
          <p className="wallet-deposit__form-note">
            Send your USDT to the address on the left. Then upload a screenshot of the
            transaction and submit below — admin will verify and credit your wallet.
          </p>

          <label className="auth-form__label">AMOUNT (USDT) — MINIMUM $5,000</label>
          <input
            type="number"
            step="0.01"
            min="5000"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000.00"
            className="auth-form__input"
          />

          <label className="auth-form__label" style={{ marginTop: 14 }}>TXN HASH (OPTIONAL)</label>
          <input
            type="text"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0xabc… or T…"
            className="auth-form__input"
          />

          <label className="auth-form__label" style={{ marginTop: 14 }}>PAYMENT SCREENSHOT</label>
          <label className="wallet-upload">
            <input type="file" accept="image/*" onChange={handleProofChange} style={{ display: 'none' }} />
            {uploading
              ? <span>Uploading…</span>
              : uploadedUrl
                ? <span>✓ Uploaded · click to replace</span>
                : <span>+ Choose screenshot (PNG / JPG)</span>}
          </label>
          {uploadedUrl && (
            <a
              href={`${API_ORIGIN}${uploadedUrl}`}
              target="_blank"
              rel="noreferrer"
              className="wallet-upload__preview"
            >
              <img src={`${API_ORIGIN}${uploadedUrl}`} alt="Proof preview" />
            </a>
          )}

          <button
            type="submit"
            className="laser-btn"
            disabled={submitting || uploading}
            style={{ width: '100%', marginTop: 16 }}
          >
            {submitting ? 'SUBMITTING…' : 'SUBMIT DEPOSIT REQUEST'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ---------- WITHDRAW TAB ---------------------------------------------------
function WithdrawTab({ wallet, onSubmitted }) {
  const [bankingDetails, setBankingDetails] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [amount, setAmount] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newAddress, setNewAddress] = useState('')
  const [newNetwork, setNewNetwork] = useState('trc20')
  const [newLabel, setNewLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadBanking = useCallback(async () => {
    try {
      const { data } = await bankingApi.list()
      const cryptoOnly = (data || []).filter((b) =>
        ['crypto_usdt', 'crypto_btc', 'crypto_eth'].includes(b.type)
      )
      setBankingDetails(cryptoOnly)
      if (cryptoOnly[0]) setSelectedId((curr) => curr || cryptoOnly[0].id)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadBanking() }, [loadBanking])

  const handleAddAddress = async (e) => {
    e.preventDefault()
    if (!newAddress) return
    try {
      await bankingApi.add({
        type: 'crypto_usdt',
        wallet_address: newAddress,
        network: newNetwork,
        label: newLabel || `USDT (${newNetwork.toUpperCase()})`,
        is_default: bankingDetails.length === 0,
      })
      setNewAddress('')
      setNewLabel('')
      setShowAdd(false)
      await loadBanking()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save address')
    }
  }

  const handleWithdraw = async (e) => {
    e.preventDefault()
    setError('')
    const detail = bankingDetails.find((b) => b.id === selectedId)
    if (!detail) { setError('Pick a destination address'); return }
    setSubmitting(true)
    try {
      await walletApi.withdraw({
        amount: parseFloat(amount),
        method: 'crypto_usdt',
        network: detail.network || newNetwork,
        wallet_address: detail.wallet_address,
      })
      setMessage('Withdrawal requested. Admin will send funds and confirm.')
      setAmount('')
      onSubmitted?.()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not request withdrawal')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {message && <div className="dash-success">{message}</div>}
      {error && <div className="auth-form__error">{error}</div>}

      <div className="wallet-withdraw">
        <div className="wallet-withdraw__form">
          <h3 className="wallet-deposit__form-title">REQUEST WITHDRAWAL</h3>
          <p className="wallet-deposit__form-note">
            Available balance: <strong>${fmt(wallet?.balance)}</strong>. Admin will send
            funds to the address you choose, then approve to deduct from your wallet.
          </p>

          <form onSubmit={handleWithdraw}>
            <label className="auth-form__label">DESTINATION ADDRESS</label>
            {bankingDetails.length === 0 ? (
              <div className="liq-empty" style={{ marginTop: 8 }}>
                <p>No saved addresses yet. Add a TRC20 or BEP20 address below.</p>
              </div>
            ) : (
              <select
                className="auth-form__input"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {bankingDetails.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} · {(b.network || 'CRYPTO').toUpperCase()} · {b.wallet_address?.slice(0, 12)}…
                  </option>
                ))}
              </select>
            )}

            <label className="auth-form__label" style={{ marginTop: 14 }}>AMOUNT (USDT)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={wallet?.balance || undefined}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="auth-form__input"
            />

            <button
              type="submit"
              className="laser-btn"
              disabled={submitting || bankingDetails.length === 0}
              style={{ width: '100%', marginTop: 16 }}
            >
              {submitting ? 'SUBMITTING…' : 'SUBMIT WITHDRAWAL REQUEST'}
            </button>
          </form>
        </div>

        <div className="wallet-withdraw__addresses">
          <div className="wallet-withdraw__addresses-head">
            <h3 className="wallet-deposit__form-title">SAVED ADDRESSES</h3>
            <button type="button" className="dash-btn-sm" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? 'CANCEL' : '+ ADD'}
            </button>
          </div>

          {showAdd && (
            <form onSubmit={handleAddAddress} className="wallet-withdraw__add">
              <label className="auth-form__label">NETWORK</label>
              <div className="wallet-deposit__net-tabs" style={{ marginBottom: 10 }}>
                {['trc20', 'bep20'].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`wallet-deposit__net-tab ${newNetwork === n ? 'wallet-deposit__net-tab--active' : ''}`}
                    onClick={() => setNewNetwork(n)}
                  >
                    USDT ({n.toUpperCase()})
                  </button>
                ))}
              </div>

              <label className="auth-form__label">LABEL</label>
              <input
                className="auth-form__input"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={`USDT (${newNetwork.toUpperCase()})`}
              />

              <label className="auth-form__label" style={{ marginTop: 10 }}>WALLET ADDRESS</label>
              <input
                className="auth-form__input"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder={newNetwork === 'trc20' ? 'T...' : '0x...'}
                required
              />

              <button type="submit" className="laser-btn laser-btn--sm" style={{ marginTop: 12 }}>
                SAVE ADDRESS
              </button>
            </form>
          )}

          {bankingDetails.length > 0 && (
            <ul className="wallet-withdraw__list">
              {bankingDetails.map((b) => (
                <li key={b.id}>
                  <div>
                    <strong>{b.label}</strong>
                    <span className="wallet-withdraw__net">{(b.network || 'CRYPTO').toUpperCase()}</span>
                  </div>
                  <div><code>{b.wallet_address}</code></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- HISTORY TAB ---------------------------------------------------
function HistoryTab() {
  const [txns, setTxns] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const perPage = 20
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const { data } = await walletApi.transactions({ page: p, per_page: perPage })
      setTxns(data.transactions || [])
      setTotal(data.total || 0)
    } catch {
      setTxns([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load(1) }, []) // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  if (loading) return <div className="dash-loading">Loading transactions…</div>
  if (txns.length === 0) {
    return (
      <div className="liq-empty">
        <p>No transactions yet. Your deposits and withdrawals will appear here.</p>
      </div>
    )
  }

  return (
    <>
      <div className="liq-table-wrap">
        <table className="liq-table">
          <thead>
            <tr>
              <th>DATE</th>
              <th>TYPE</th>
              <th>METHOD</th>
              <th>NETWORK</th>
              <th>AMOUNT</th>
              <th>STATUS</th>
              <th>PROOF / DEST</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id}>
                <td>{fmtTime(t.created_at)}</td>
                <td>{t.type.toUpperCase()}</td>
                <td>{t.method.replace('crypto_', '').toUpperCase()}</td>
                <td>{(t.payment_details?.network || '—').toUpperCase()}</td>
                <td><strong>${fmt(t.amount)}</strong></td>
                <td>
                  <span className={`wallet-status wallet-status--${t.status}`}>
                    {t.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  {t.payment_details?.proof_image_url && (
                    <a
                      href={`${API_ORIGIN}${t.payment_details.proof_image_url}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      VIEW PROOF
                    </a>
                  )}
                  {t.payment_details?.to_address && (
                    <code style={{ fontSize: 10 }}>{t.payment_details.to_address}</code>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="liq-pagination">
        <span className="liq-pagination__info">
          Page {page} of {totalPages} · {total} total
        </span>
        <div className="liq-pagination__btns">
          <button
            className="dash-btn-sm"
            disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); load(p) }}
          >
            ← PREV
          </button>
          <button
            className="dash-btn-sm"
            disabled={page >= totalPages}
            onClick={() => { const p = page + 1; setPage(p); load(p) }}
          >
            NEXT →
          </button>
        </div>
      </div>
    </>
  )
}
