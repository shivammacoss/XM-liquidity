/**
 * SwisTrade — Admin Prop Challenge (bharat_funded parity)
 * Tabs: Settings · Challenges · Accounts · Payouts · Dashboard
 *
 * Settings   — master toggle, display name, description, T&C
 * Challenges — CRUD with multi-tier pricing
 * Accounts   — list + force-pass / force-fail / extend / reset
 * Payouts    — pending queue with approve (custom amount + cooldown override) / reject
 * Dashboard  — top-line counters
 */

import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../../services/admin'

const EMPTY_CHALLENGE = {
  name: '',
  description: '',
  prop_type: 'two_step',
  steps_count: 2,
  currency: 'USD',
  account_size: 10000,
  price: 99,
  tiers: [],
  rules: {
    max_daily_loss_pct: 5,
    max_total_loss_pct: 10,
    profit_target_phase1_pct: 8,
    profit_target_phase2_pct: 5,
    profit_target_instant_pct: 0,
    max_one_day_profit_pct_of_target: null,
    consistency_rule_pct: null,
    min_lot_size: 0.01,
    max_lot_size: 100,
    allow_fractional_lots: true,
    min_trades_required: 1,
    max_trades_per_day: null,
    max_concurrent_trades: null,
    stop_loss_required: false,
    take_profit_required: false,
    max_leverage: 100,
    challenge_expiry_days: 30,
    trading_days_required: null,
  },
  funded_settings: { profit_split_pct: 80, withdrawal_cooldown_days: 14 },
  is_active: true,
  sort_order: 0,
}

export default function AdminProp() {
  const [tab, setTab] = useState('dashboard')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const flash = useCallback((kind, text) => {
    setMessage(''); setError('')
    if (kind === 'ok') setMessage(text); else setError(text)
    setTimeout(() => { setMessage(''); setError('') }, 4000)
  }, [])

  return (
    <div className="dash-page">
      <div className="dash-page__header">
        <div>
          <h2 className="dash-page__title">PROP CHALLENGES</h2>
          <p className="dash-page__subtitle">Settings · Catalog · Accounts · Payouts</p>
        </div>
      </div>

      {message && <div className="dash-success">{message}</div>}
      {error && <div className="auth-form__error">{error}</div>}

      <div className="dash-tabs">
        {['dashboard', 'settings', 'challenges', 'accounts', 'payouts'].map(t => (
          <button
            key={t}
            className={`dash-tab ${tab === t ? 'dash-tab--active' : ''}`}
            onClick={() => setTab(t)}
          >{t.toUpperCase()}</button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab flash={flash} />}
      {tab === 'settings' && <SettingsTab flash={flash} />}
      {tab === 'challenges' && <ChallengesTab flash={flash} />}
      {tab === 'accounts' && <AccountsTab flash={flash} />}
      {tab === 'payouts' && <PayoutsTab flash={flash} />}
    </div>
  )
}

/* ---------- Dashboard tab ------------------------------------------------ */
function DashboardTab({ flash }) {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    adminApi.prop.dashboard()
      .then(({ data }) => setStats(data))
      .catch(err => flash('err', err.response?.data?.detail || 'Failed to load stats'))
  }, [flash])

  if (!stats) return <div className="dash-loading">Loading...</div>
  const cells = [
    ['Mode', stats.challenge_mode_enabled ? 'ON' : 'OFF'],
    ['Total Challenges', stats.total_challenges],
    ['Total Accounts', stats.total_accounts],
    ['Active', stats.active_accounts],
    ['Passed', stats.passed_accounts],
    ['Failed', stats.failed_accounts],
    ['Funded', stats.funded_accounts],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
      {cells.map(([label, val]) => (
        <div key={label} className="dash-prop-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: 1 }}>{label.toUpperCase()}</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{val}</div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Settings tab ------------------------------------------------- */
function SettingsTab({ flash }) {
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminApi.prop.getSettings()
      .then(({ data }) => setS(data))
      .catch(err => flash('err', err.response?.data?.detail || 'Failed to load'))
  }, [flash])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await adminApi.prop.updateSettings(s)
      flash('ok', 'Settings saved')
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  if (!s) return <div className="dash-loading">Loading...</div>
  return (
    <form onSubmit={save} className="dash-create-card" style={{ marginTop: 16, maxWidth: 720 }}>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '8px 0 16px', fontSize: 14 }}>
        <input type="checkbox" checked={!!s.challenge_mode_enabled}
               onChange={e => setS({ ...s, challenge_mode_enabled: e.target.checked })} />
        <strong>Challenge Mode Enabled</strong>
      </label>
      <div className="auth-form__group">
        <label className="auth-form__label">DISPLAY NAME</label>
        <input className="auth-form__input" value={s.display_name || ''}
               onChange={e => setS({ ...s, display_name: e.target.value })} />
      </div>
      <div className="auth-form__group">
        <label className="auth-form__label">DESCRIPTION</label>
        <input className="auth-form__input" value={s.description || ''}
               onChange={e => setS({ ...s, description: e.target.value })} />
      </div>
      <div className="auth-form__group">
        <label className="auth-form__label">TERMS & CONDITIONS</label>
        <textarea className="auth-form__input" rows={4} value={s.terms_and_conditions || ''}
                  onChange={e => setS({ ...s, terms_and_conditions: e.target.value })} />
      </div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '12px 0', fontSize: 13 }}>
        <input type="checkbox" checked={!!s.auto_close_at_market_close}
               onChange={e => setS({ ...s, auto_close_at_market_close: e.target.checked })} />
        Auto-close all positions at market close
      </label>
      <button type="submit" className="laser-btn" disabled={saving}>
        {saving ? 'SAVING...' : 'SAVE SETTINGS'}
      </button>
    </form>
  )
}

/* ---------- Challenges tab (multi-tier CRUD) ----------------------------- */
function ChallengesTab({ flash }) {
  const [items, setItems] = useState([])
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(() => {
    adminApi.prop.listChallenges()
      .then(({ data }) => setItems(data.challenges || []))
      .catch(err => flash('err', err.response?.data?.detail || 'Load failed'))
  }, [flash])

  useEffect(() => { load() }, [load])

  const startNew = () => { setEditing({ ...EMPTY_CHALLENGE }); setShowForm(true) }
  const startEdit = (c) => {
    setEditing({
      ...EMPTY_CHALLENGE, ...c,
      rules: { ...EMPTY_CHALLENGE.rules, ...(c.rules || {}) },
      funded_settings: { ...EMPTY_CHALLENGE.funded_settings, ...(c.funded_settings || {}) },
      tiers: c.tiers || [],
    })
    setShowForm(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      if (editing.id) {
        await adminApi.prop.updateChallenge(editing.id, editing)
        flash('ok', 'Challenge updated')
      } else {
        await adminApi.prop.createChallenge(editing)
        flash('ok', 'Challenge created')
      }
      setShowForm(false); setEditing(null); load()
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Save failed')
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this challenge? Cannot delete if accounts exist.')) return
    try {
      await adminApi.prop.deleteChallenge(id)
      flash('ok', 'Deleted'); load()
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Delete failed')
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <button className="laser-btn laser-btn--sm" onClick={startNew}>+ NEW CHALLENGE</button>

      {showForm && editing && (
        <ChallengeForm
          value={editing}
          onChange={setEditing}
          onSubmit={submit}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      <div className="dash-prop-grid" style={{ marginTop: 16 }}>
        {items.length === 0 && (
          <div className="dash-empty"><p>No challenges yet. Click "NEW CHALLENGE" to create the first one.</p></div>
        )}
        {items.map(c => (
          <div key={c.id} className="dash-prop-card">
            <div className="dash-prop-card__header">
              <span className="dash-prop-card__type">{c.prop_type.replace('_', ' ').toUpperCase()}</span>
              <span className="dash-prop-card__phases">{c.steps_count} STEP{c.steps_count !== 1 ? 'S' : ''}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{c.name}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{c.description}</div>

            {c.tiers && c.tiers.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>TIERS</div>
                {c.tiers.map((t, i) => (
                  <div key={i} style={{ fontSize: 12, padding: '4px 0' }}>
                    {t.label || `Tier ${i + 1}`}: ${t.account_size?.toLocaleString()} fund @ ${t.price}
                    {t.is_popular && <span style={{ color: '#ff7a00', marginLeft: 6 }}>★ POPULAR</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                ${(c.account_size || 0).toLocaleString()} fund @ ${c.price}
              </div>
            )}

            <div className="dash-prop-card__rules" style={{ marginTop: 10 }}>
              <div>Daily DD: {c.rules.max_daily_loss_pct}%</div>
              <div>Total DD: {c.rules.max_total_loss_pct}%</div>
              <div>Target P1: {c.rules.profit_target_phase1_pct ?? '—'}%</div>
              <div>Target P2: {c.rules.profit_target_phase2_pct ?? '—'}%</div>
              <div>Lev: {c.rules.max_leverage}x</div>
              <div>Days: {c.rules.challenge_expiry_days}</div>
              <div>Split: {c.funded_settings.profit_split_pct}%</div>
              <div>Cooldown: {c.funded_settings.withdrawal_cooldown_days}d</div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="laser-btn laser-btn--sm" onClick={() => startEdit(c)}>EDIT</button>
              <button className="laser-btn laser-btn--sm" onClick={() => remove(c.id)} style={{ background: '#a02020' }}>DELETE</button>
              <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.6 }}>
                {c.is_active ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChallengeForm({ value, onChange, onSubmit, onCancel }) {
  const v = value
  const setRules = (patch) => onChange({ ...v, rules: { ...v.rules, ...patch } })
  const setFunded = (patch) => onChange({ ...v, funded_settings: { ...v.funded_settings, ...patch } })

  const addTier = () => onChange({ ...v, tiers: [...(v.tiers || []), { account_size: 10000, price: 99, label: '', is_popular: false }] })
  const updateTier = (i, patch) => {
    const tiers = [...(v.tiers || [])]; tiers[i] = { ...tiers[i], ...patch }; onChange({ ...v, tiers })
  }
  const removeTier = (i) => onChange({ ...v, tiers: (v.tiers || []).filter((_, idx) => idx !== i) })

  return (
    <form onSubmit={onSubmit} className="dash-create-card" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>{v.id ? 'EDIT CHALLENGE' : 'NEW CHALLENGE'}</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
        <Field label="NAME"><input className="auth-form__input" value={v.name} onChange={e => onChange({ ...v, name: e.target.value })} required /></Field>
        <Field label="TYPE">
          <select className="auth-form__input" value={v.prop_type}
                  onChange={e => {
                    const p = e.target.value
                    onChange({ ...v, prop_type: p, steps_count: p === 'two_step' ? 2 : p === 'one_step' ? 1 : 0 })
                  }}>
            <option value="instant_fund">INSTANT</option>
            <option value="one_step">ONE STEP</option>
            <option value="two_step">TWO STEP</option>
          </select>
        </Field>
        <Field label="CURRENCY"><input className="auth-form__input" value={v.currency} onChange={e => onChange({ ...v, currency: e.target.value })} /></Field>
      </div>

      <Field label="DESCRIPTION"><input className="auth-form__input" value={v.description} onChange={e => onChange({ ...v, description: e.target.value })} /></Field>

      <h4 style={{ marginTop: 16 }}>PRICING TIERS</h4>
      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 0 }}>
        Add multiple (fund size, price) options. Leave empty to use the legacy single-tier below.
      </p>
      {(v.tiers || []).map((t, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 8, alignItems: 'end', marginBottom: 8 }}>
          <Field label={`TIER ${i + 1} FUND`}><input type="number" className="auth-form__input" value={t.account_size} onChange={e => updateTier(i, { account_size: parseFloat(e.target.value) })} /></Field>
          <Field label="PRICE"><input type="number" className="auth-form__input" value={t.price} onChange={e => updateTier(i, { price: parseFloat(e.target.value) })} /></Field>
          <Field label="LABEL"><input className="auth-form__input" value={t.label} onChange={e => updateTier(i, { label: e.target.value })} placeholder="e.g. Starter" /></Field>
          <label style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center', paddingBottom: 8 }}>
            <input type="checkbox" checked={!!t.is_popular} onChange={e => updateTier(i, { is_popular: e.target.checked })} /> POPULAR
          </label>
          <button type="button" className="laser-btn laser-btn--sm" onClick={() => removeTier(i)} style={{ background: '#a02020' }}>X</button>
        </div>
      ))}
      <button type="button" className="laser-btn laser-btn--sm" onClick={addTier}>+ ADD TIER</button>

      {(!v.tiers || v.tiers.length === 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <Field label="LEGACY ACCOUNT SIZE"><input type="number" className="auth-form__input" value={v.account_size} onChange={e => onChange({ ...v, account_size: parseFloat(e.target.value) })} /></Field>
          <Field label="LEGACY PRICE"><input type="number" className="auth-form__input" value={v.price} onChange={e => onChange({ ...v, price: parseFloat(e.target.value) })} /></Field>
        </div>
      )}

      <h4 style={{ marginTop: 24 }}>RISK RULES</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="MAX DAILY LOSS %"><input type="number" className="auth-form__input" value={v.rules.max_daily_loss_pct ?? ''} onChange={e => setRules({ max_daily_loss_pct: parseFloat(e.target.value) })} /></Field>
        <Field label="MAX TOTAL LOSS %"><input type="number" className="auth-form__input" value={v.rules.max_total_loss_pct ?? ''} onChange={e => setRules({ max_total_loss_pct: parseFloat(e.target.value) })} /></Field>
        <Field label="MAX LEVERAGE"><input type="number" className="auth-form__input" value={v.rules.max_leverage ?? ''} onChange={e => setRules({ max_leverage: parseInt(e.target.value) })} /></Field>
        <Field label="TARGET PHASE 1 %"><input type="number" className="auth-form__input" value={v.rules.profit_target_phase1_pct ?? ''} onChange={e => setRules({ profit_target_phase1_pct: parseFloat(e.target.value) })} /></Field>
        <Field label="TARGET PHASE 2 %"><input type="number" className="auth-form__input" value={v.rules.profit_target_phase2_pct ?? ''} onChange={e => setRules({ profit_target_phase2_pct: parseFloat(e.target.value) })} /></Field>
        <Field label="TARGET INSTANT %"><input type="number" className="auth-form__input" value={v.rules.profit_target_instant_pct ?? ''} onChange={e => setRules({ profit_target_instant_pct: parseFloat(e.target.value) })} /></Field>
        <Field label="MAX 1-DAY % OF TARGET"><input type="number" className="auth-form__input" value={v.rules.max_one_day_profit_pct_of_target ?? ''} onChange={e => setRules({ max_one_day_profit_pct_of_target: e.target.value === '' ? null : parseFloat(e.target.value) })} /></Field>
        <Field label="CONSISTENCY %"><input type="number" className="auth-form__input" value={v.rules.consistency_rule_pct ?? ''} onChange={e => setRules({ consistency_rule_pct: e.target.value === '' ? null : parseFloat(e.target.value) })} /></Field>
        <Field label="EXPIRY DAYS"><input type="number" className="auth-form__input" value={v.rules.challenge_expiry_days ?? ''} onChange={e => setRules({ challenge_expiry_days: parseInt(e.target.value) })} /></Field>
        <Field label="MIN LOT"><input type="number" step="0.01" className="auth-form__input" value={v.rules.min_lot_size ?? ''} onChange={e => setRules({ min_lot_size: parseFloat(e.target.value) })} /></Field>
        <Field label="MAX LOT"><input type="number" className="auth-form__input" value={v.rules.max_lot_size ?? ''} onChange={e => setRules({ max_lot_size: parseFloat(e.target.value) })} /></Field>
        <Field label="MAX TRADES/DAY"><input type="number" className="auth-form__input" value={v.rules.max_trades_per_day ?? ''} onChange={e => setRules({ max_trades_per_day: e.target.value === '' ? null : parseInt(e.target.value) })} /></Field>
        <Field label="MAX CONCURRENT"><input type="number" className="auth-form__input" value={v.rules.max_concurrent_trades ?? ''} onChange={e => setRules({ max_concurrent_trades: e.target.value === '' ? null : parseInt(e.target.value) })} /></Field>
        <Field label="MIN TRADING DAYS"><input type="number" className="auth-form__input" value={v.rules.trading_days_required ?? ''} onChange={e => setRules({ trading_days_required: e.target.value === '' ? null : parseInt(e.target.value) })} /></Field>
        <Field label="MIN TRADES REQUIRED"><input type="number" className="auth-form__input" value={v.rules.min_trades_required ?? ''} onChange={e => setRules({ min_trades_required: parseInt(e.target.value) })} /></Field>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={!!v.rules.stop_loss_required} onChange={e => setRules({ stop_loss_required: e.target.checked })} /> SL Required
        </label>
        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={!!v.rules.take_profit_required} onChange={e => setRules({ take_profit_required: e.target.checked })} /> TP Required
        </label>
        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={!!v.rules.allow_fractional_lots} onChange={e => setRules({ allow_fractional_lots: e.target.checked })} /> Fractional Lots
        </label>
      </div>

      <h4 style={{ marginTop: 24 }}>FUNDED SETTINGS</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="PROFIT SPLIT %"><input type="number" className="auth-form__input" value={v.funded_settings.profit_split_pct ?? ''} onChange={e => setFunded({ profit_split_pct: parseFloat(e.target.value) })} /></Field>
        <Field label="WITHDRAWAL COOLDOWN (days)"><input type="number" className="auth-form__input" value={v.funded_settings.withdrawal_cooldown_days ?? ''} onChange={e => setFunded({ withdrawal_cooldown_days: parseInt(e.target.value) })} /></Field>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={!!v.is_active} onChange={e => onChange({ ...v, is_active: e.target.checked })} /> Active
        </label>
        <Field label="SORT ORDER" style={{ flex: '0 0 120px' }}>
          <input type="number" className="auth-form__input" value={v.sort_order} onChange={e => onChange({ ...v, sort_order: parseInt(e.target.value) })} />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button type="submit" className="laser-btn">{v.id ? 'SAVE' : 'CREATE'}</button>
        <button type="button" className="laser-btn" onClick={onCancel} style={{ background: '#444' }}>CANCEL</button>
      </div>
    </form>
  )
}

function Field({ label, children, style }) {
  return (
    <div className="auth-form__group" style={style}>
      <label className="auth-form__label">{label}</label>
      {children}
    </div>
  )
}

/* ---------- Accounts tab (list + force actions) -------------------------- */
function AccountsTab({ flash }) {
  const [accounts, setAccounts] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = statusFilter ? { status: statusFilter } : undefined
    adminApi.prop.listAccounts(params)
      .then(({ data }) => setAccounts(data.accounts || []))
      .catch(err => flash('err', err.response?.data?.detail || 'Load failed'))
      .finally(() => setLoading(false))
  }, [statusFilter, flash])

  useEffect(() => { load() }, [load])

  const action = async (fn, label, propId) => {
    if (!confirm(`${label} — confirm?`)) return
    try {
      await fn()
      flash('ok', `${label} done`)
      load()
    } catch (err) {
      flash('err', err.response?.data?.detail || `${label} failed`)
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select className="auth-form__input" style={{ maxWidth: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="passed">Passed</option>
          <option value="funded">Funded</option>
          <option value="blown">Blown</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {loading && <div className="dash-loading">Loading...</div>}
      {!loading && accounts.length === 0 && <div className="dash-empty"><p>No accounts.</p></div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>
              <th style={th}>USER</th>
              <th style={th}>CHALLENGE</th>
              <th style={th}>STATUS</th>
              <th style={th}>PHASE</th>
              <th style={th}>BALANCE</th>
              <th style={th}>P/L%</th>
              <th style={th}>DD DAY/TOT</th>
              <th style={th}>EXPIRES</th>
              <th style={th}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #222' }}>
                <td style={td}>{a.user?.name || '—'}<br /><span style={{ opacity: 0.6, fontSize: 11 }}>{a.user?.email}</span></td>
                <td style={td}>{a.challenge?.name || '—'}<br /><span style={{ opacity: 0.6, fontSize: 11 }}>${a.challenge?.account_size?.toLocaleString()}</span></td>
                <td style={td}><StatusBadge status={a.status} /></td>
                <td style={td}>{a.current_phase}/{a.total_phases}</td>
                <td style={td}>${(a.current_balance || 0).toFixed(2)}</td>
                <td style={td} className={a.current_profit_pct >= 0 ? 'pos' : 'neg'}>{(a.current_profit_pct || 0).toFixed(2)}%</td>
                <td style={td}>{(a.current_daily_drawdown_pct || 0).toFixed(1)}% / {(a.current_overall_drawdown_pct || 0).toFixed(1)}%</td>
                <td style={td}>{a.expires_at ? new Date(a.expires_at).toLocaleDateString() : '—'}</td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button style={mini} onClick={() => action(() => adminApi.prop.forcePass(a.id), 'Force pass', a.id)}>PASS</button>
                    <button style={miniRed} onClick={() => {
                      const reason = prompt('Fail reason?') || ''
                      action(() => adminApi.prop.forceFail(a.id, reason), 'Force fail', a.id)
                    }}>FAIL</button>
                    <button style={mini} onClick={() => {
                      const days = parseInt(prompt('Extend by how many days?') || '0')
                      if (days > 0) action(() => adminApi.prop.extendTime(a.id, days), `Extend ${days}d`, a.id)
                    }}>+TIME</button>
                    <button style={mini} onClick={() => action(() => adminApi.prop.resetAccount(a.id), 'Reset', a.id)}>RESET</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- Payouts tab -------------------------------------------------- */
function PayoutsTab({ flash }) {
  const [payouts, setPayouts] = useState([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    adminApi.prop.listPayouts(statusFilter)
      .then(({ data }) => setPayouts(data.payouts || []))
      .catch(err => flash('err', err.response?.data?.detail || 'Load failed'))
      .finally(() => setLoading(false))
  }, [statusFilter, flash])

  useEffect(() => { load() }, [load])

  const approve = async (tx) => {
    const customStr = prompt(`Approve payout for $${tx.requested_amount.toFixed(2)}\n\nLeave blank to approve as-is, or enter a custom amount:`)
    if (customStr === null) return
    const customAmount = customStr.trim() === '' ? undefined : parseFloat(customStr)
    const overrideCooldown = confirm('Override cooldown if not yet met?')
    const adminNote = prompt('Admin note (optional):') || ''
    try {
      await adminApi.prop.approvePayout(tx.id, { custom_amount: customAmount, override_cooldown: overrideCooldown, admin_note: adminNote })
      flash('ok', 'Payout approved'); load()
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Approve failed')
    }
  }

  const reject = async (tx) => {
    const reason = prompt('Rejection reason:')
    if (!reason || !reason.trim()) return
    try {
      await adminApi.prop.rejectPayout(tx.id, reason.trim())
      flash('ok', 'Payout rejected'); load()
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Reject failed')
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select className="auth-form__input" style={{ maxWidth: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading && <div className="dash-loading">Loading...</div>}
      {!loading && payouts.length === 0 && <div className="dash-empty"><p>No payouts.</p></div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>
              <th style={th}>WHEN</th>
              <th style={th}>USER</th>
              <th style={th}>ACCOUNT</th>
              <th style={th}>AMOUNT</th>
              <th style={th}>PROFIT × SPLIT</th>
              <th style={th}>STATUS</th>
              <th style={th}>NOTE</th>
              <th style={th}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #222' }}>
                <td style={td}>{new Date(p.created_at).toLocaleString()}</td>
                <td style={td}>{p.user?.name || '—'}<br /><span style={{ opacity: 0.6, fontSize: 11 }}>{p.user?.email}</span></td>
                <td style={td}>${(p.prop_account?.current_balance ?? 0).toFixed(2)}<br /><span style={{ opacity: 0.6, fontSize: 11 }}>init ${p.prop_account?.initial_balance?.toFixed(0)}</span></td>
                <td style={td}>${p.requested_amount.toFixed(2)}</td>
                <td style={td}>${(p.profit ?? 0).toFixed(2)} × {p.split_pct ?? 80}%</td>
                <td style={td}><StatusBadge status={p.status} /></td>
                <td style={td}>{p.user_note || ''}{p.rejection_reason && <div style={{ color: '#ff6060', fontSize: 11 }}>Rejected: {p.rejection_reason}</div>}</td>
                <td style={td}>
                  {p.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={mini} onClick={() => approve(p)}>APPROVE</button>
                      <button style={miniRed} onClick={() => reject(p)}>REJECT</button>
                    </div>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- helpers ------------------------------------------------------- */
function StatusBadge({ status }) {
  const colors = {
    active: '#3b82f6', passed: '#10b981', funded: '#22c55e',
    blown: '#ef4444', expired: '#6b7280',
    pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444',
  }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', fontSize: 10, fontWeight: 700,
      letterSpacing: 1, borderRadius: 4, background: colors[status] || '#444', color: '#fff',
    }}>{(status || '').toUpperCase()}</span>
  )
}

const th = { padding: '10px 8px', fontSize: 11, fontWeight: 600, opacity: 0.7, letterSpacing: 1 }
const td = { padding: '10px 8px', verticalAlign: 'top' }
const mini = { padding: '4px 8px', fontSize: 11, border: '1px solid #555', background: '#1a1a1a', color: '#fff', cursor: 'pointer', borderRadius: 3 }
const miniRed = { ...mini, borderColor: '#a02020', color: '#ff8080' }
