import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__grid">
          <div>
            <div className="footer__brand-name">
              XM<span>LIQUIDITY</span>
            </div>
            <p className="footer__brand-desc">
              Direct liquidity for brokers. No fixed cost, no bridging cost — only the spread and per-lot fee.
            </p>
            <p className="footer__brand-desc">
              <strong style={{ color: 'var(--text-primary)' }}>Trusted infrastructure for startup and growing brokers worldwide.</strong>
            </p>
          </div>

          <div>
            <div className="footer__col-title">LIQUIDITY</div>
            <ul className="footer__col-links">
              <li><Link to="/features">A-Book Execution</Link></li>
              <li><Link to="/features">Multi-Asset Access</Link></li>
              <li><Link to="/features">Pricing</Link></li>
              <li><Link to="/features">API &amp; Integration</Link></li>
            </ul>
          </div>

          <div>
            <div className="footer__col-title">RESOURCES</div>
            <ul className="footer__col-links">
              <li><a href="#">Documentation</a></li>
              <li><a href="#">API Reference</a></li>
              <li><a href="#">Status</a></li>
              <li><Link to="/about">About</Link></li>
            </ul>
          </div>

          <div>
            <div className="footer__col-title">BROKER SUPPORT</div>
            <ul className="footer__col-links">
              <li><Link to="/signin">Broker Login</Link></li>
              <li><Link to="/contact">Contact Support</Link></li>
              <li><Link to="/contact">Talk to Our Team</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <span className="mono-label">&copy; 2026 XMLIQUIDITY. ALL RIGHTS RESERVED.</span>
          <div className="footer__bottom-links">
            <Link to="/privacy">PRIVACY POLICY</Link>
            <Link to="/terms">TERMS OF SERVICE</Link>
            <Link to="/risk-disclosure">RISK DISCLOSURE</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
