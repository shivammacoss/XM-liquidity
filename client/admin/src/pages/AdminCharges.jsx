/**
 * Admin Charges — single global config for the liquidity account.
 *
 * One row applies to every broker, every instrument:
 *   - Spread markup (pips)
 *   - Commission per standard lot (USD)
 *   - Swap long  (USD per lot per night)
 *   - Swap short (USD per lot per night)
 *
 * Stored as a DEFAULT-level ChargeSettings record with no instrument_id
 * and no segment, so charge_calculator.get_charges() falls through to it
 * for every trade unless a more specific row exists (none, by design).
 */

import { useEffect, useState } from 'react'
import { adminApi } from '../services/admin'

const fmt = (n, d = 2) =>
  Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

export default function AdminCharges() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [config, setConfig] = useState({
    spread_markup: 0,
    commission_per_lot: 0,
    swap_long: 0,
    swap_short: 0,
  })
  const [legacyCount, setLegacyCount] = useState(0)

  const loadConfig = async () => {
    try {
      const { data } = await adminApi.charges()
      const list = Array.isArray(data) ? data : []
      // Look for the single default-level, all-instruments row.
      const globalRow =
        list.find(
          (c) =>
            c.level === 'default' &&
            !c.instrument_id &&
            !c.segment &&
            !c.target_id
        ) || null
      if (globalRow) {
        setConfig({
          spread_markup: globalRow.spread_markup,
          commission_per_lot: globalRow.commission_per_lot,
          swap_long: globalRow.swap_long,
          swap_short: globalRow.swap_short,
        })
      }
      // Count anything else as "legacy" — a hint that there's leftover
      // per-account-type charges from the previous model.
      setLegacyCount(list.length - (globalRow ? 1 : 0))
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load charges')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadConfig() }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await adminApi.setCharge({
        level: 'default',
        spread_markup: Number(config.spread_markup) || 0,
        commission_per_lot: Number(config.commission_per_lot) || 0,
        swap_long: Number(config.swap_long) || 0,
        swap_short: Number(config.swap_short) || 0,
      })
      setMessage('Liquidity-account charges saved.')
      loadConfig()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dash-page">
      <div className="dash-page__header">
        <div>
          <h2 className="dash-page__title">LIQUIDITY ACCOUNT CHARGES</h2>
          <p className="dash-page__subtitle">
            Single global config applied to every broker on every instrument.
          </p>
        </div>
      </div>

      {message && <div className="dash-success">{message}</div>}
      {error && <div className="auth-form__error">{error}</div>}

      {loading ? (
        <div className="dash-loading">Loading charge config…</div>
      ) : (
        <>
          {/* Live snapshot */}
          <div
            className="dash-create-card"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}
          >
            <Stat label="SPREAD MARKUP" value={`${fmt(config.spread_markup, 2)} pips`} />
            <Stat label="COMMISSION / LOT" value={`$${fmt(config.commission_per_lot, 2)}`} />
            <Stat label="SWAP LONG" value={`$${fmt(config.swap_long, 2)} /lot/night`} />
            <Stat label="SWAP SHORT" value={`$${fmt(config.swap_short, 2)} /lot/night`} />
          </div>

          {/* Editor */}
          <div className="dash-create-card">
            <h3 className="dash-create-card__title">EDIT CHARGES</h3>
            <form onSubmit={handleSave} className="auth-form" style={{ maxWidth: 720 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field
                  label="SPREAD MARKUP (PIPS)"
                  value={config.spread_markup}
                  onChange={(v) => setConfig({ ...config, spread_markup: v })}
                  step="0.01"
                  hint="Added to the raw market spread on every fill. 1 pip = 0.0001 for forex."
                />
                <Field
                  label="COMMISSION / STANDARD LOT ($)"
                  value={config.commission_per_lot}
                  onChange={(v) => setConfig({ ...config, commission_per_lot: v })}
                  step="0.1"
                  hint="Charged per side, per lot. Standard lot = 100,000 base units (forex)."
                />
                <Field
                  label="SWAP LONG ($ / LOT / NIGHT)"
                  value={config.swap_long}
                  onChange={(v) => setConfig({ ...config, swap_long: v })}
                  step="0.01"
                  hint="Charged at rollover for positions held long overnight. Use a negative number to debit the broker."
                />
                <Field
                  label="SWAP SHORT ($ / LOT / NIGHT)"
                  value={config.swap_short}
                  onChange={(v) => setConfig({ ...config, swap_short: v })}
                  step="0.01"
                  hint="Charged at rollover for positions held short overnight."
                />
              </div>
              <button
                type="submit"
                className="laser-btn"
                style={{ marginTop: 18 }}
                disabled={saving}
              >
                {saving ? 'SAVING…' : 'SAVE CHARGES'}
              </button>
            </form>
          </div>

          {legacyCount > 0 && (
            <div className="dash-create-card" style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                <strong style={{ color: '#FFB4B4' }}>HEADS UP:</strong>{' '}
                {legacyCount} legacy per-account-type charge row{legacyCount === 1 ? '' : 's'} still
                exist in the database from the previous model. They take priority over this global
                config. To enforce a single global rate, those legacy rows should be deleted.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontFamily: 'Geist Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.16em',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontWeight: 800,
          fontSize: '1.3rem',
          color: '#FFFFFF',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, step, hint }) {
  return (
    <div className="auth-form__group">
      <label className="auth-form__label">{label}</label>
      <input
        type="number"
        step={step || '0.01'}
        className="auth-form__input"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
      />
      {hint && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 11,
            color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.5,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
