import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import CanvasRevealEffect from '../components/ui/CanvasRevealEffect'
import { useAuth } from '../hooks/useAuth'

export default function SignIn() {
  const { login, isLoading, error, clearAuthError } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [reverseCanvasVisible, setReverseCanvasVisible] = useState(false)
  const [initialCanvasVisible, setInitialCanvasVisible] = useState(true)
  const [stage, setStage] = useState('form') // 'form' | 'success'

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearAuthError()
    const formData = new FormData(e.target)
    const result = await login({
      email: formData.get('email'),
      password: formData.get('password'),
    })
    if (!result.error) {
      // play reverse-canvas transition before navigating
      setReverseCanvasVisible(true)
      setTimeout(() => setInitialCanvasVisible(false), 50)
      setStage('success')
      setTimeout(() => navigate('/dashboard'), 1400)
    }
  }

  return (
    <div className="signin-shell">
      {/* Canvas backgrounds */}
      <div className="signin-shell__bg">
        {initialCanvasVisible && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <CanvasRevealEffect
              animationSpeed={3}
              colors={[
                [255, 255, 255],
                [255, 255, 255],
              ]}
              dotSize={6}
              reverse={false}
              showGradient={false}
            />
          </div>
        )}
        {reverseCanvasVisible && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <CanvasRevealEffect
              animationSpeed={4}
              colors={[
                [255, 255, 255],
                [255, 255, 255],
              ]}
              dotSize={6}
              reverse={true}
              showGradient={false}
            />
          </div>
        )}
        <div className="signin-shell__radial" />
        <div className="signin-shell__top-fade" />
      </div>

      {/* Mini top bar */}
      <header className="signin-topbar">
        <Link to="/" className="signin-topbar__logo">
          XM<span className="signin-topbar__logo-accent">LIQUIDITY</span>
        </Link>
        <Link to="/" className="signin-topbar__back">← BACK TO SITE</Link>
      </header>

      {/* Center stage */}
      <main className="signin-center">
        <AnimatePresence mode="wait">
          {stage === 'form' ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="signin-card"
            >
              <div className="signin-card__heading">
                <h1 className="signin-card__title">Welcome back</h1>
                <p className="signin-card__subtitle">Sign in to access your broker dashboard</p>
              </div>

              {error && <div className="signin-card__error">{error}</div>}

              <form className="signin-form" onSubmit={handleSubmit} autoComplete="on">
                <div className="signin-input-wrap">
                  <input
                    name="email"
                    type="email"
                    placeholder="broker@email.com"
                    autoComplete="email"
                    required
                    className="signin-input"
                  />
                </div>

                <div className="signin-input-wrap">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    autoComplete="current-password"
                    required
                    className="signin-input signin-input--with-action"
                  />
                  <button
                    type="button"
                    className="signin-input__action"
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

                <div className="signin-form__row">
                  <a href="#" className="signin-form__forgot">Forgot password?</a>
                </div>

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="signin-submit"
                >
                  {isLoading ? 'Signing in…' : 'Continue'}
                </motion.button>
              </form>

              <div className="signin-divider">
                <span /> <span className="signin-divider__text">or</span> <span />
              </div>

              <button type="button" className="signin-google">
                <span style={{ fontWeight: 700 }}>G</span> Continue with Google
              </button>

              <p className="signin-footer-link">
                New here?{' '}
                <Link to="/signup" className="signin-footer-link__a">
                  Create an account
                </Link>
              </p>

              <p className="signin-legal">
                By continuing, you agree to our{' '}
                <a href="#" className="signin-legal__a">Terms</a>,{' '}
                <a href="#" className="signin-legal__a">Privacy Notice</a>, and{' '}
                <a href="#" className="signin-legal__a">Cookie Notice</a>.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
              className="signin-card signin-card--success"
            >
              <div className="signin-card__heading">
                <h1 className="signin-card__title">You're in.</h1>
                <p className="signin-card__subtitle">Taking you to the dashboard…</p>
              </div>
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.45, delay: 0.35 }}
                className="signin-success-check"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
