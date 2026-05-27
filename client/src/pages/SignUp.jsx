import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AnimatedGradient from '../components/ui/AnimatedGradient'
import { useAuth } from '../hooks/useAuth'

export default function SignUp() {
  const [showPassword, setShowPassword] = useState(false)
  const { register, isLoading, error, clearAuthError } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearAuthError()
    const formData = new FormData(e.target)
    const result = await register({
      email: formData.get('email'),
      password: formData.get('password'),
      name: formData.get('name'),
      phone: formData.get('phone') || undefined,
    })
    if (!result.error) {
      navigate('/dashboard')
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

          <div className="auth-page__title-group">
            <h1 className="auth-page__title">CREATE YOUR ACCOUNT</h1>
            <p className="auth-page__subtitle">Start trading in minutes with institutional-grade tools</p>
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
                placeholder="trader@example.com"
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
              <label className="auth-form__label" htmlFor="signup-password">PASSWORD</label>
              <div className="auth-form__password-wrap">
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-form__input"
                  placeholder="Create a strong password"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-form__eye-btn"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="auth-form__agreement">
              <span className="auth-form__agreement-text">
                By creating an account, you agree to our{' '}
                <Link to="/terms">Terms of Service</Link> and{' '}
                <Link to="/privacy">Privacy Policy</Link>
              </span>
            </div>

            <button type="submit" className="laser-btn auth-form__submit" disabled={isLoading}>
              {isLoading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
            </button>
          </form>

          <div className="auth-form__divider">
            <span className="auth-form__divider-line" />
            <span className="auth-form__divider-text">OR CONTINUE WITH</span>
            <span className="auth-form__divider-line" />
          </div>

          <button type="button" className="auth-form__social-btn" onClick={() => console.log('Google sign-up')}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            CONTINUE WITH GOOGLE
          </button>

          <p className="auth-form__toggle">
            Already have an account?{' '}
            <Link to="/signin" className="auth-form__toggle-link">SIGN IN</Link>
          </p>
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
