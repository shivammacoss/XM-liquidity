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
    title: 'LIGHTNING-FAST EXECUTION',
    desc: 'Trades executed in milliseconds with optimized routing direct to deep tier-1 liquidity.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'ENTERPRISE-GRADE SECURITY',
    desc: 'Encrypted APIs, HMAC-SHA256 signed requests, and granular access control on every endpoint.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'REAL-TIME ANALYTICS',
    desc: 'Live P&L, exposure, trade flow, and broker performance monitoring out of the box.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
    title: 'GLOBAL INFRASTRUCTURE',
    desc: 'Distributed execution servers for ultra-low latency from any region — Europe, US, Asia.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: 'COMPLIANCE-READY',
    desc: 'Audit logs, full execution history, and regulator-friendly architecture from day one.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    title: '24/7 BROKER SUPPORT',
    desc: 'Dedicated integration engineers and execution desk available around the clock.',
  },
]

const assets = [
  { title: 'FOREX', desc: 'MAJORS · MINORS · EXOTICS' },
  { title: 'CRYPTOCURRENCY', desc: 'BTC · ETH · TOP ALTCOINS' },
  { title: 'COMMODITIES', desc: 'GOLD · SILVER · OIL · ENERGY' },
  { title: 'US STOCKS', desc: 'NYSE · NASDAQ EQUITIES' },
  { title: 'INDICES', desc: 'US30 · NAS100 · GLOBAL' },
]

const pricing = [
  { value: '$4', label: 'PER LOT (MINIMUM)' },
  { value: '0.06', label: 'FIXED SPREAD FROM' },
  { value: '$0', label: 'BRIDGING COST' },
  { value: '$0', label: 'FIXED MONTHLY FEE' },
]

const integration = [
  { title: 'REST APIs', desc: 'Trade open, close, modify, positions & history endpoints.' },
  { title: 'WEBSOCKET STREAMS', desc: 'Real-time orders, trades, and tick-level price updates.' },
  { title: 'HMAC-SHA256 AUTH', desc: 'Every request signed and verified end-to-end.' },
  { title: 'SDK-READY', desc: 'Plug your broker platform into our webhook in minutes.' },
]

const brokerTypes = [
  'Forex Brokers — startup to enterprise',
  'Crypto Exchanges & Hybrid Brokers',
  'Prop Trading Firms',
  'CFD & Multi-Asset Platforms',
  'White-Label Brokerages',
]

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="hero__content">
          <div className="hero__meta-top">
            <span className="hero__badge">
              <span className="status-dot" />
              TRUE A-BOOK EXECUTION
            </span>
            <span className="hero__badge">NO BRIDGING COST</span>
            <span className="hero__badge">
              <span className="status-dot" />
              LIVE LIQUIDITY
            </span>
          </div>

          <h1 className="hero__headline">
            LIQUIDITY <span className="accent">FOR BROKERS</span>
            <span className="hero__typing-cursor" />
          </h1>

          <p className="hero__desc">
            Launch and scale your brokerage with enterprise-level execution, transparent pricing, and ultra-low latency connectivity — built for Forex, Crypto, Commodities, US Stocks &amp; Indices. Trusted infrastructure for startup and growing brokers worldwide.
          </p>

          <div className="hero__actions">
            <Link to="/signin" className="laser-btn">BROKER LOGIN</Link>
            <Link to="/contact" className="laser-btn laser-btn--outline">TALK TO OUR TEAM</Link>
          </div>
        </div>
      </section>

      {/* Slogan banner */}
      <ScrollReveal>
        <div style={{ padding: '40px 24px 0' }}>
          <div className="slogan-banner">
            DIRECT LIQUIDITY FOR BROKERS. <strong>NO FIXED COST, NO BRIDGING COST</strong> THE BROKER NEEDS TO PAY.
          </div>
        </div>
      </ScrollReveal>

      {/* Stats */}
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

      {/* True A-Book */}
      <section className="why-section">
        <div className="why-section__header">
          <span className="mono-label">A-BOOK MODEL</span>
          <h2 className="section-title">TRUE A-BOOK TRADE EXECUTION FOR BROKERS</h2>
          <p className="section-subtitle">
            Pure A-Book liquidity management. Every trade routed directly to liquidity — zero conflict of interest, zero dealer intervention.
          </p>
        </div>

        <div className="bento-grid">
          <ScrollReveal>
            <div className="bento-card">
              <h3 className="bento-card__title">NO DEALER INTERVENTION</h3>
              <p className="bento-card__desc">Trades flow straight from your broker to the LP — never touched, never delayed.</p>
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <div className="bento-card">
              <h3 className="bento-card__title">NO TRADE MANIPULATION</h3>
              <p className="bento-card__desc">Pure pass-through execution. No requotes, no slippage games, no markups.</p>
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <div className="bento-card">
              <h3 className="bento-card__title">NO INTERNAL RISK EXPOSURE</h3>
              <p className="bento-card__desc">You never take the other side of a client trade — full risk transfer to the market.</p>
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <div className="bento-card">
              <h3 className="bento-card__title">100% TRANSPARENT EXECUTION</h3>
              <p className="bento-card__desc">Every fill, every spread, every timestamp auditable from the broker dashboard.</p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Multi-asset */}
      <section className="why-section">
        <div className="why-section__header">
          <span className="mono-label">GLOBAL MARKETS</span>
          <h2 className="section-title">MULTI-ASSET GLOBAL MARKET ACCESS</h2>
          <p className="section-subtitle">
            Trade every major asset class through a single unified infrastructure — consistent pricing and execution logic across the board.
          </p>
        </div>
        <div className="asset-grid">
          {assets.map((a) => (
            <ScrollReveal key={a.title}>
              <div className="asset-card">
                <div className="asset-card__title">{a.title}</div>
                <div className="asset-card__desc">{a.desc}</div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="why-section">
        <div className="why-section__header">
          <span className="mono-label">PRICING</span>
          <h2 className="section-title">SIMPLE &amp; TRANSPARENT PRICING</h2>
          <p className="section-subtitle">
            No hidden fees. No complex tiers. Same pricing across all instruments — perfect for startup brokers, prop firms, and scaling brokerages.
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

      {/* Integration */}
      <section className="why-section">
        <div className="why-section__header">
          <span className="mono-label">INTEGRATION</span>
          <h2 className="section-title">INTEGRATE IN MINUTES, NOT MONTHS</h2>
          <p className="section-subtitle">
            Clean API architecture, fast onboarding, seamless trade flow. Built for high-frequency, low-latency, and high-volume execution.
          </p>
        </div>
        <div className="bento-grid">
          {integration.map((f) => (
            <ScrollReveal key={f.title}>
              <div className="bento-card">
                <h3 className="bento-card__title">{f.title}</h3>
                <p className="bento-card__desc">{f.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Why XMLiquidity (infrastructure) */}
      <section className="why-section">
        <div className="why-section__header">
          <span className="mono-label">INFRASTRUCTURE</span>
          <h2 className="section-title">EVERYTHING YOU NEED TO RUN A BROKERAGE</h2>
          <p className="section-subtitle">
            Designed for real-world broker operations — battle-tested across multiple regions and asset classes.
          </p>
        </div>
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

      {/* Built for broker types */}
      <section className="why-section">
        <div className="why-section__header">
          <span className="mono-label">WHO IT'S FOR</span>
          <h2 className="section-title">BUILT FOR MODERN BROKERAGE MODELS</h2>
          <p className="section-subtitle">
            If you need reliable execution and transparent A-Book routing, XMLiquidity is built for you.
          </p>
        </div>
        <div className="broker-types">
          {brokerTypes.map((t) => (
            <ScrollReveal key={t}>
              <div className="broker-types__item">{t}</div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta">
        <div className="final-cta__inner">
          <h2 className="section-title">READY TO LAUNCH OR SCALE YOUR BROKERAGE?</h2>
          <p className="section-subtitle">
            Join brokers who trust XMLiquidity for execution, liquidity, and infrastructure.
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
