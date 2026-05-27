/**
 * XMLiquidity — Profile Page
 * Edit profile, avatar, KYC upload, change password, read-only ID.
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { profileApi } from '../../services/dashboard'

const AVATARS = ['happy', 'focused', 'determined', 'zen', 'fire', 'rocket', 'diamond', 'crown']

export default function Profile() {
  const { user, fetchUser } = useAuth()
  const [tab, setTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Profile form
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [avatar, setAvatar] = useState(user?.avatar_type || '')

  // Password form
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')

  // Read-only form
  const [readOnlyPw, setReadOnlyPw] = useState('')

  // KYC
  const [kycStatus, setKycStatus] = useState(null)

  useEffect(() => { loadKyc() }, [])

  const loadKyc = async () => {
    try { const { data } = await profileApi.kycStatus(); setKycStatus(data) } catch { /* empty */ }
  }

  const handleProfile = async (e) => {
    e.preventDefault(); setLoading(true); setError(''); setMessage('')
    try {
      await profileApi.update({ name, phone, avatar_type: avatar })
      setMessage('Profile updated!'); fetchUser()
    } catch (err) { setError(err.response?.data?.detail || 'Failed') }
    finally { setLoading(false) }
  }

  const handlePassword = async (e) => {
    e.preventDefault(); setLoading(true); setError(''); setMessage('')
    try {
      const { data } = await profileApi.changePassword({ current_password: currentPw, new_password: newPw })
      setMessage(data.message); setCurrentPw(''); setNewPw('')
    } catch (err) { setError(err.response?.data?.detail || 'Failed') }
    finally { setLoading(false) }
  }

  const handleReadOnly = async (e) => {
    e.preventDefault(); setLoading(true); setError(''); setMessage('')
    try {
      const { data } = await profileApi.createReadOnlyId(readOnlyPw)
      setMessage(data.message); setReadOnlyPw('')
    } catch (err) { setError(err.response?.data?.detail || 'Failed') }
    finally { setLoading(false) }
  }

  const handleKycUpload = async (docType, file) => {
    setError(''); setMessage('')
    try {
      await profileApi.kycUpload(docType, file)
      setMessage(`${docType} uploaded!`); loadKyc()
    } catch (err) { setError(err.response?.data?.detail || 'Upload failed') }
  }

  return (
    <div className="dash-page">
      <div className="dash-page__header">
        <div>
          <h2 className="dash-page__title">PROFILE</h2>
          <p className="dash-page__subtitle">Manage your account settings</p>
        </div>
      </div>

      {message && <div className="dash-success">{message}</div>}
      {error && <div className="auth-form__error">{error}</div>}

      <div className="dash-tabs">
        {['profile', 'kyc', 'password', 'readonly'].map((t) => (
          <button key={t} className={`dash-tab ${tab === t ? 'dash-tab--active' : ''}`}
            onClick={() => { setTab(t); setError(''); setMessage('') }}>
            {t === 'readonly' ? 'READ-ONLY ID' : t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="dash-create-card">
          <h3 className="dash-create-card__title">EDIT PROFILE</h3>
          <form onSubmit={handleProfile} className="auth-form" style={{ maxWidth: 500 }}>
            <div className="auth-form__group">
              <label className="auth-form__label">NAME</label>
              <input className="auth-form__input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="auth-form__group">
              <label className="auth-form__label">PHONE</label>
              <input className="auth-form__input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="auth-form__group">
              <label className="auth-form__label">AVATAR</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {AVATARS.map((a) => (
                  <button key={a} type="button" onClick={() => setAvatar(a)}
                    className={`dash-avatar-btn ${avatar === a ? 'dash-avatar-btn--active' : ''}`}>
                    {a.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="laser-btn" disabled={loading}>{loading ? 'SAVING...' : 'SAVE PROFILE'}</button>
          </form>
        </div>
      )}

      {tab === 'kyc' && (
        <div className="dash-create-card">
          <h3 className="dash-create-card__title">KYC VERIFICATION</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            Upload your documents to verify your identity. Status: <strong style={{ color: 'var(--accent)' }}>
              {kycStatus?.overall_status?.toUpperCase() || 'NOT SUBMITTED'}
            </strong>
          </p>
          {['government_id', 'address_proof', 'selfie'].map((docType) => {
            const doc = kycStatus?.documents?.find(d => d.doc_type === docType)
            return (
              <div key={docType} className="dash-kyc-item">
                <div className="dash-kyc-item__info">
                  <span className="dash-kyc-item__type">{docType.replace('_', ' ').toUpperCase()}</span>
                  {doc && <span className={`dash-status dash-status--${doc.status}`}>{doc.status.toUpperCase()}</span>}
                </div>
                <input type="file" accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => e.target.files?.[0] && handleKycUpload(docType, e.target.files[0])} />
              </div>
            )
          })}
        </div>
      )}

      {tab === 'password' && (
        <div className="dash-create-card">
          <h3 className="dash-create-card__title">CHANGE PASSWORD</h3>
          <form onSubmit={handlePassword} className="auth-form" style={{ maxWidth: 500 }}>
            <div className="auth-form__group">
              <label className="auth-form__label">CURRENT PASSWORD</label>
              <input type="password" className="auth-form__input" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
            </div>
            <div className="auth-form__group">
              <label className="auth-form__label">NEW PASSWORD</label>
              <input type="password" className="auth-form__input" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} />
            </div>
            <button type="submit" className="laser-btn" disabled={loading}>{loading ? 'CHANGING...' : 'CHANGE PASSWORD'}</button>
          </form>
        </div>
      )}

      {tab === 'readonly' && (
        <div className="dash-create-card">
          <h3 className="dash-create-card__title">READ-ONLY ACCESS</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            Create a read-only password to share your dashboard with others. They can view everything but cannot trade or transfer funds.
          </p>
          <form onSubmit={handleReadOnly} className="auth-form" style={{ maxWidth: 500 }}>
            <div className="auth-form__group">
              <label className="auth-form__label">READ-ONLY PASSWORD</label>
              <input type="text" className="auth-form__input" value={readOnlyPw} onChange={(e) => setReadOnlyPw(e.target.value)} required minLength={4} placeholder="Create a simple password to share" />
            </div>
            <button type="submit" className="laser-btn" disabled={loading}>{loading ? 'CREATING...' : 'CREATE READ-ONLY ID'}</button>
          </form>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 16 }}>
            Share your email ({user?.email}) + this read-only password with whoever you want to give view access to.
          </p>
        </div>
      )}
    </div>
  )
}
