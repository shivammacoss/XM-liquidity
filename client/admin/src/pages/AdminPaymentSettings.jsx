/**
 * Admin — Platform Payment Settings
 *
 * Set the TRC20 + BEP20 USDT deposit addresses brokers send funds to.
 * Stored as a singleton document on the server. Live preview shows the
 * exact same QR + address the broker sees on their Wallet → Deposit tab.
 */

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { adminApi } from '../services/admin'

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace(/\/api\/v1\/?$/, '')

export default function AdminPaymentSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    trc20_address: '',
    trc20_label: 'USDT (TRC20)',
    trc20_network_note: '',
    trc20_qr_url: '',
    bep20_address: '',
    bep20_label: 'USDT (BEP20)',
    bep20_network_note: '',
    bep20_qr_url: '',
  })

  const load = async () => {
    try {
      const { data } = await adminApi.paymentSettings()
      setForm({
        trc20_address: data.trc20_address || '',
        trc20_label: data.trc20_label || 'USDT (TRC20)',
        trc20_network_note: data.trc20_network_note || '',
        trc20_qr_url: data.trc20_qr_url || '',
        bep20_address: data.bep20_address || '',
        bep20_label: data.bep20_label || 'USDT (BEP20)',
        bep20_network_note: data.bep20_network_note || '',
        bep20_qr_url: data.bep20_qr_url || '',
      })
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await adminApi.updatePaymentSettings(form)
      setMessage('Payment addresses updated. Brokers will see the new values immediately.')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="dash-loading">Loading payment settings…</div>

  return (
    <div className="dash-page">
      <div className="dash-page__header">
        <div>
          <h2 className="dash-page__title">PLATFORM DEPOSIT ADDRESSES</h2>
          <p className="dash-page__subtitle">
            TRC20 and BEP20 addresses brokers send USDT to. Singleton config —
            updates take effect immediately on the broker Wallet page.
          </p>
        </div>
      </div>

      {message && <div className="dash-success">{message}</div>}
      {error && <div className="auth-form__error">{error}</div>}

      <form onSubmit={handleSave}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            marginTop: 8,
          }}
        >
          <NetworkCard
            title="USDT · TRC20 (TRON)"
            address={form.trc20_address}
            label={form.trc20_label}
            note={form.trc20_network_note}
            qrUrl={form.trc20_qr_url}
            onChange={(patch) => setForm({ ...form, ...patch })}
            keyPrefix="trc20"
          />
          <NetworkCard
            title="USDT · BEP20 (BSC)"
            address={form.bep20_address}
            label={form.bep20_label}
            note={form.bep20_network_note}
            qrUrl={form.bep20_qr_url}
            onChange={(patch) => setForm({ ...form, ...patch })}
            keyPrefix="bep20"
          />
        </div>

        <button
          type="submit"
          className="laser-btn"
          disabled={saving}
          style={{ marginTop: 18 }}
        >
          {saving ? 'SAVING…' : 'SAVE BOTH ADDRESSES'}
        </button>
      </form>
    </div>
  )
}

function NetworkCard({ title, address, label, note, qrUrl, onChange, keyPrefix }) {
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadErr('')
    setUploading(true)
    try {
      const { data } = await adminApi.uploadPaymentQr(keyPrefix, file)
      // Server persists immediately; reflect new URL in the form too.
      onChange({ [`${keyPrefix}_qr_url`]: data.url })
    } catch (err) {
      setUploadErr(err?.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = '' // allow re-selecting the same file
    }
  }

  const clearCustom = () => onChange({ [`${keyPrefix}_qr_url`]: '' })

  return (
    <div
      style={{
        padding: 22,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
      }}
    >
      <h3
        style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontWeight: 800,
          fontSize: 15,
          letterSpacing: '-0.02em',
          color: '#FFFFFF',
          marginBottom: 14,
        }}
      >
        {title}
      </h3>

      <label className="auth-form__label">DEPOSIT ADDRESS</label>
      <input
        type="text"
        className="auth-form__input"
        value={address}
        onChange={(e) => onChange({ [`${keyPrefix}_address`]: e.target.value })}
        placeholder={keyPrefix === 'trc20' ? 'T...' : '0x...'}
      />

      <label className="auth-form__label" style={{ marginTop: 12 }}>LABEL</label>
      <input
        type="text"
        className="auth-form__input"
        value={label}
        onChange={(e) => onChange({ [`${keyPrefix}_label`]: e.target.value })}
      />

      <label className="auth-form__label" style={{ marginTop: 12 }}>NETWORK NOTE</label>
      <input
        type="text"
        className="auth-form__input"
        value={note}
        onChange={(e) => onChange({ [`${keyPrefix}_network_note`]: e.target.value })}
        placeholder="Visible to broker, e.g. confirmation time"
      />

      {/* QR preview — custom uploaded image takes priority over auto-generated */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.5)' }}>
            {qrUrl ? 'CUSTOM QR (UPLOADED)' : address ? 'AUTO-GENERATED QR' : 'QR PREVIEW'}
          </span>
          {qrUrl && (
            <button type="button" onClick={clearCustom} className="dash-btn-sm dash-btn-sm--red" style={{ fontSize: 10 }}>
              USE AUTO QR
            </button>
          )}
        </div>

        {qrUrl ? (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ padding: 10, background: '#FFFFFF', borderRadius: 10 }}>
              <img src={`${API_ORIGIN}${qrUrl}`} alt="Custom QR" style={{ width: 140, height: 140, objectFit: 'contain', display: 'block' }} />
            </div>
            <div style={{ flex: 1, fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.7)', wordBreak: 'break-all' }}>
              <span style={{ display: 'block', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>BROKER SEES THIS IMAGE:</span>
              {address || <em style={{ color: 'rgba(255,255,255,0.4)' }}>No address text set</em>}
            </div>
          </div>
        ) : address ? (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ padding: 10, background: '#FFFFFF', borderRadius: 10 }}>
              <QRCodeSVG value={address} size={140} bgColor="#FFFFFF" fgColor="#000000" level="M" includeMargin />
            </div>
            <div style={{ flex: 1, fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.7)', wordBreak: 'break-all' }}>
              <span style={{ display: 'block', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>BROKER SEES:</span>
              {address}
            </div>
          </div>
        ) : (
          <div style={{ padding: 14, fontSize: 12, color: 'rgba(255,255,255,0.5)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 10 }}>
            QR preview appears once you enter an address or upload a custom image.
          </div>
        )}

        {/* Upload control */}
        <label className="wallet-upload" style={{ marginTop: 12 }}>
          <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
          {uploading ? <span>Uploading…</span> : <span>{qrUrl ? '↺ REPLACE QR IMAGE' : '+ UPLOAD CUSTOM QR IMAGE'}</span>}
        </label>
        {uploadErr && (
          <div className="auth-form__error" style={{ marginTop: 8 }}>{uploadErr}</div>
        )}
        <p style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
          Upload a PNG/JPG/SVG to override the auto-generated QR. Useful when you want to embed
          your own wallet's QR (with logo, network label, etc.) that the broker can scan directly.
        </p>
      </div>
    </div>
  )
}
