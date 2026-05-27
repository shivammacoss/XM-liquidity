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
          XM<span className="header__logo-accent">LIQUIDITY</span>
        </Link>
        <nav className="header__nav">
          <Link to="/" className={isActive('/')}>HOME</Link>
          <Link to="/features" className={isActive('/features')}>LIQUIDITY</Link>
          <Link to="/markets" className={isActive('/markets')}>MARKETS</Link>
          <Link to="/about" className={isActive('/about')}>ABOUT</Link>
          <Link to="/contact" className={isActive('/contact')}>CONTACT</Link>
        </nav>
        <div className="header__actions">
          <Link to="/signin" className="header__signin">BROKER LOGIN</Link>
          <Link to="/contact" className="laser-btn laser-btn--sm">TALK TO TEAM</Link>
        </div>
      </div>
    </header>
  )
}
