import { Link } from 'react-router-dom'
import ScrollReveal from '../components/ScrollReveal'

const reviews = [
  {
    text: '"The 0.06 pip spreads on XAU/USD transformed my scalping strategy. Execution is flawless even during NFP releases."',
    initials: 'AK',
    name: 'Alex K.',
    role: 'Forex Scalper, London',
  },
  {
    text: '"The 1-hour crypto withdrawal guarantee is a game changer. XMLiquidity\'s speed on digital assets is unmatched in the industry."',
    initials: 'MV',
    name: 'Marco V.',
    role: 'Crypto Trader, Dubai',
  },
  {
    text: '"We launched our brokerage using their white-label. The setup was minimal compared to the institutional-grade tech we received."',
    initials: 'SJ',
    name: 'Sarah J.',
    role: 'White-Label Partner',
  },
]

export default function Reviews() {
  return (
    <>
      <section className="page-hero">
        <span className="mono-label">TESTIMONIALS</span>
        <h1 className="section-title">TRUSTED BY TRADERS WORLDWIDE</h1>
        <p className="section-subtitle">
          See what our community has to say about trading with XMLiquidity.
        </p>
      </section>

      <section className="reviews-section" style={{ borderTop: 'none', paddingTop: 0 }}>
        <div className="reviews-grid">
          {reviews.map((r) => (
            <ScrollReveal key={r.name}>
              <div className="review-card">
                <p className="review-card__text">{r.text}</p>
                <div className="review-card__author">
                  <div className="review-card__avatar">{r.initials}</div>
                  <div>
                    <div className="review-card__name">{r.name}</div>
                    <div className="review-card__role">{r.role}</div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div className="final-cta__inner">
          <h2 className="section-title">READY TO TRADE WITH INSTITUTIONAL SPEED?</h2>
          <p className="section-subtitle">
            Join thousands of traders who trust XMLiquidity for lightning-fast execution, ultra-low spreads, and reliable crypto payouts.
          </p>
          <div className="final-cta__actions">
            <a href="#" className="laser-btn">OPEN LIVE ACCOUNT</a>
            <Link to="/" className="laser-btn laser-btn--outline">SIGN IN</Link>
          </div>
        </div>
      </section>
    </>
  )
}
