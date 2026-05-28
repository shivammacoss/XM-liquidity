import { useState } from 'react'
import { Link } from 'react-router-dom'
import AnimatedGradient from '../components/ui/AnimatedGradient'
import api from '../services/api'

export default function SignUp() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const formData = new FormData(e.target)
    try {
      await api.post('/auth/signup-request', {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone') || undefined,
        message: formData.get('message') || undefined,
      })
      setSuccess(true)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__form-side">
        <div className="auth-page__form-container">
          <div className="auth-page__header">
            <Link to="/" className="auth-page__logo">
              XM<span className="auth-page__logo-accent">LIQUIDITY</span>
            </Link>
          </div>

          {success ? (
            <div className="auth-page__title-group">
              <h1 className="auth-page__title">REQUEST SUBMITTED</h1>
              <p className="auth-page__subtitle" style={{ marginTop: 12, lineHeight: 1.6 }}>
                Your signup request has been submitted successfully. Our team will review your application and send your login credentials via email once approved.
              </p>
              <Link to="/signin" className="laser-btn auth-form__submit" style={{ marginTop: 32, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                GO TO SIGN IN
              </Link>
            </div>
          ) : (
            <>
              <div className="auth-page__title-group">
                <h1 className="auth-page__title">REQUEST AN ACCOUNT</h1>
                <p className="auth-page__subtitle">Submit your details and our team will set up your broker account</p>
              </div>

              {error && (
                <div className="auth-form__error">{error}</div>
              )}

              <form className="auth-form" onSubmit={handleSubmit} autoComplete="on">
                <div className="auth-form__group">
                  <label className="auth-form__label" htmlFor="signup-name">FULL NAME</label>
                  <input
                    id="signup-name"
                    name="name"
                    type="text"
                    className="auth-form__input"
                    placeholder="John Doe"
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="auth-form__group">
                  <label className="auth-form__label" htmlFor="signup-email">EMAIL</label>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    className="auth-form__input"
                    placeholder="broker@example.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="auth-form__group">
                  <label className="auth-form__label" htmlFor="signup-phone">PHONE NUMBER</label>
                  <input
                    id="signup-phone"
                    name="phone"
                    type="tel"
                    className="auth-form__input"
                    placeholder="+1 (908) 228-0305"
                    autoComplete="tel"
                  />
                </div>

                <div className="auth-form__group">
                  <label className="auth-form__label" htmlFor="signup-message">MESSAGE (OPTIONAL)</label>
                  <textarea
                    id="signup-message"
                    name="message"
                    className="auth-form__input"
                    placeholder="Tell us about your brokerage needs..."
                    rows={3}
                    style={{ resize: 'vertical', minHeight: 60 }}
                  />
                </div>

                <div className="auth-form__agreement">
                  <span className="auth-form__agreement-text">
                    By submitting, you agree to our{' '}
                    <Link to="/terms">Terms of Service</Link> and{' '}
                    <Link to="/privacy">Privacy Policy</Link>
                  </span>
                </div>

                <button type="submit" className="laser-btn auth-form__submit" disabled={isLoading}>
                  {isLoading ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
                </button>
              </form>

              <p className="auth-form__toggle">
                Already have credentials?{' '}
                <Link to="/signin" className="auth-form__toggle-link">SIGN IN</Link>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="auth-page__visual-side">
        <AnimatedGradient
          config={{
            preset: 'custom',
            color1: '#050505',
            color2: '#BFFF00',
            color3: '#0a0a0a',
            rotation: 30,
            proportion: 25,
            scale: 0.5,
            speed: 10,
            distortion: 4,
            swirl: 60,
            swirlIterations: 6,
            softness: 95,
            offset: -300,
            shape: 'Checks',
            shapeSize: 30,
          }}
          noise={{ opacity: 0.15, scale: 1.5 }}
        />
        <div className="auth-page__visual-content">
          <div className="auth-page__visual-quote">
            <p className="auth-page__visual-quote-text">
              &ldquo;A new chapter in trading awaits. Join 50K+ traders worldwide.&rdquo;
            </p>
            <span className="mono-label">XMLIQUIDITY PLATFORM</span>
          </div>
          <div className="auth-page__visual-features">
            <div className="auth-page__visual-feature">
              <span className="auth-page__visual-feature-dot" />
              SEGREGATED CLIENT FUNDS
            </div>
            <div className="auth-page__visual-feature">
              <span className="auth-page__visual-feature-dot" />
              256-BIT SSL ENCRYPTION
            </div>
            <div className="auth-page__visual-feature">
              <span className="auth-page__visual-feature-dot" />
              NEGATIVE BALANCE PROTECTION
            </div>
            <div className="auth-page__visual-feature">
              <span className="auth-page__visual-feature-dot" />
              24/7 EXPERT SUPPORT
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
