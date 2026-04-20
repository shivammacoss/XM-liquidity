import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isActive = (path) => location.pathname === path ? 'header__link active' : 'header__link'

  return (
    <header className={`header${scrolled ? ' scrolled' : ''}`}>
      <div className="header__inner">
        <Link to="/" className="header__logo">
          SWIS<span className="header__logo-accent">TRADE</span>
        </Link>
        <nav className="header__nav">
          <Link to="/" className={isActive('/')}>HOME</Link>
          <Link to="/features" className={isActive('/features')}>FEATURES</Link>
          <Link to="/markets" className={isActive('/markets')}>MARKETS</Link>
          <Link to="/reviews" className={isActive('/reviews')}>REVIEWS</Link>
        </nav>
        <div className="header__actions">
          <Link to="/signin" className="header__signin">SIGN IN</Link>
          <Link to="/signup" className="laser-btn laser-btn--sm">GET STARTED</Link>
        </div>
      </div>
    </header>
  )
}
