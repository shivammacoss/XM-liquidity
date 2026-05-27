import ScrollReveal from '../components/ScrollReveal'

const values = [
  { title: 'BROKER-FIRST', desc: 'Every decision starts with what helps brokers grow — execution quality, transparency, and cost.' },
  { title: 'NO HIDDEN COST', desc: 'No bridging fees. No fixed monthly minimums. Brokers only pay the spread and per-lot fee.' },
  { title: 'TRANSPARENCY', desc: 'Pure A-Book routing. Every fill, spread, and timestamp auditable from the broker dashboard.' },
  { title: 'GLOBAL ACCESS', desc: 'Multi-region execution and 24/7 support so brokers in any time zone get equal speed.' },
]

const numbers = [
  { value: '99.99%', label: 'UPTIME SLA' },
  { value: '<10MS', label: 'AVG LATENCY' },
  { value: '1M+', label: 'TRADES PROCESSED' },
  { value: '24/7', label: 'BROKER SUPPORT' },
]

export default function About() {
  return (
    <>
      <section className="page-hero">
        <span className="mono-label">ABOUT XMLIQUIDITY</span>
        <h1 className="section-title">LIQUIDITY INFRASTRUCTURE FOR MODERN BROKERS</h1>
        <p className="section-subtitle">
          XMLiquidity gives brokers direct access to tier-1 liquidity with transparent pricing, ultra-low latency, and zero bridging cost.
        </p>
      </section>

      <section className="about-story">
        <div className="about-story__content">
          <h2 className="section-title" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: 32 }}>OUR STORY</h2>
          <p>
            XMLiquidity was built to solve a simple problem: brokers were paying too much for liquidity, too much for bridges, and getting too little transparency on how their flow was being handled.
          </p>
          <p>
            We started with a pure A-Book model, direct connectivity to deep liquidity, and a transparent per-lot fee. No internal dealing desk. No conflict of interest. No fixed monthly minimums forcing small brokers out of the market.
          </p>
          <p>
            Today XMLiquidity powers Forex brokers, crypto exchanges, prop firms, CFD platforms, and white-label brokerages across the globe — from startup brokerages writing their first trades to enterprise platforms processing millions of orders per month.
          </p>
        </div>

        <div style={{ textAlign: 'center', marginTop: 80 }}>
          <span className="mono-label">OUR SLOGAN</span>
          <h2 className="section-title" style={{ fontSize: 'clamp(1.2rem, 2.5vw, 1.8rem)', marginTop: 16 }}>
            DIRECT LIQUIDITY FOR BROKERS. NO FIXED COST, NO BRIDGING COST.
          </h2>
        </div>

        <div className="values-grid">
          {values.map((v) => (
            <ScrollReveal key={v.title}>
              <div className="value-card">
                <h3 className="value-card__title">{v.title}</h3>
                <p className="value-card__desc">{v.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <div className="numbers-grid">
          {numbers.map((n) => (
            <ScrollReveal key={n.label}>
              <div className="number-item">
                <div className="number-item__value">{n.value}</div>
                <div className="number-item__label">{n.label}</div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>
    </>
  )
}
