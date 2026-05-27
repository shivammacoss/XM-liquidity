import { Link } from 'react-router-dom'
import ScrollReveal from '../components/ScrollReveal'

const stats = [
  { label: 'UPTIME SLA', value: '99.99', unit: '%' },
  { label: 'AVG LATENCY', value: '<10', unit: 'MS' },
  { label: 'TRADES PROCESSED', value: '1M+', unit: 'EXECUTED' },
  { label: 'BROKER SUPPORT', value: '24/7', unit: 'ON CALL' },
]

const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: 'TRUE A-BOOK ROUTING',
    desc: 'Every client trade routed directly to tier-1 liquidity — zero conflict of interest, zero dealer intervention.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
    title: 'GLOBAL EXECUTION GRID',
    desc: 'Distributed servers across Europe, US, and Asia keep your brokers and their clients close to the market.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'MULTI-ASSET LIQUIDITY',
    desc: 'Forex, Crypto, Metals, Energy, Indices, and US Stocks — one connection, one pricing logic, one settlement.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: 'REST + WEBSOCKET APIS',
    desc: 'Trade open, close, modify, positions, history, and real-time order/trade/price streams.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'HMAC-SHA256 SECURITY',
    desc: 'Every request signed. Encrypted in transit. Role-based access control for every API key.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    title: 'DEDICATED BROKER DESK',
    desc: 'Integration engineers and an execution desk on call 24/7 for every broker partner.',
  },
]

const pricing = [
  { value: '$4', label: 'PER LOT (MINIMUM)' },
  { value: '0.06', label: 'FIXED SPREAD FROM' },
  { value: '$0', label: 'BRIDGING COST' },
  { value: '$0', label: 'FIXED MONTHLY FEE' },
]

export default function Features() {
  return (
    <>
      <section className="page-hero">
        <span className="mono-label">PLATFORM FEATURES</span>
        <h1 className="section-title">EVERYTHING YOU NEED TO RUN A BROKERAGE</h1>
        <p className="section-subtitle">
          Enterprise-grade liquidity, execution, and infrastructure designed specifically for brokers, prop firms, and white-labels.
        </p>
      </section>

      <ScrollReveal>
        <div className="stats">
          <div className="stats__grid">
            {stats.map((s) => (
              <div key={s.label} className="stats__item">
                <div className="stats__label">{s.label}</div>
                <div className="stats__value">{s.value}</div>
                <div className="stats__unit">{s.unit}</div>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>

      <section className="why-section">
        <div className="bento-grid">
          {features.map((f) => (
            <ScrollReveal key={f.title}>
              <div className="bento-card">
                <div className="bento-card__icon">{f.icon}</div>
                <h3 className="bento-card__title">{f.title}</h3>
                <p className="bento-card__desc">{f.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="why-section">
        <div className="why-section__header">
          <span className="mono-label">PRICING</span>
          <h2 className="section-title">SIMPLE &amp; TRANSPARENT PRICING</h2>
          <p className="section-subtitle">
            Same pricing across every instrument. No bridging fee. No fixed monthly cost.
          </p>
        </div>
        <div className="pricing-grid">
          {pricing.map((p) => (
            <ScrollReveal key={p.label}>
              <div className="pricing-card">
                <div className="pricing-card__value">{p.value}</div>
                <div className="pricing-card__label">{p.label}</div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div className="final-cta__inner">
          <h2 className="section-title">READY TO PLUG IN?</h2>
          <p className="section-subtitle">
            Direct liquidity for brokers. No fixed cost, no bridging cost — only the spread and the lot fee.
          </p>
          <div className="final-cta__actions">
            <Link to="/signin" className="laser-btn">BROKER LOGIN</Link>
            <Link to="/contact" className="laser-btn laser-btn--outline">TALK TO OUR TEAM</Link>
          </div>
        </div>
      </section>
    </>
  )
}
