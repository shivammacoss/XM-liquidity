import ScrollReveal from '../components/ScrollReveal'

const solutions = [
  { title: 'CUSTOM BRANDING', desc: 'Your logo, colors, and domain. Fully customized client experience.' },
  { title: 'FAST LAUNCH', desc: 'Go live in 72 hours with our streamlined setup process.' },
  { title: 'DEDICATED SUPPORT', desc: '24/7 technical support and account management for your business.' },
  { title: 'REGULATORY COMPLIANCE', desc: 'Built-in compliance tools and documentation for major jurisdictions.' },
  { title: 'REVENUE SHARING', desc: 'Competitive revenue split with transparent reporting.' },
  { title: 'REAL-TIME REPORTING', desc: 'Comprehensive analytics and reporting dashboard.' },
]

const techStack = [
  'Trading Platform (Web, Desktop, Mobile)',
  'CRM & Client Management',
  'Payment Processing Gateway',
  'Risk Management System',
  'Reporting & Analytics Dashboard',
  'Admin Back Office',
]

const businessServices = [
  'Tier-1 Liquidity Access',
  'Multi-Bank Payment Processing',
  'Regulatory Documentation',
  'Marketing Materials',
  'Training & Onboarding',
  'Ongoing Technical Support',
]

const steps = [
  { num: '1', title: 'CONSULTATION', desc: 'We discuss your requirements and business goals.' },
  { num: '2', title: 'CUSTOMIZATION', desc: 'Brand customization and feature configuration.' },
  { num: '3', title: 'INTEGRATION', desc: 'Technical setup and testing.' },
  { num: '4', title: 'LAUNCH', desc: 'Go live with training and support.' },
]

export default function WhiteLabel() {
  return (
    <>
      <section className="page-hero">
        <span className="mono-label">ENTERPRISE SOLUTIONS</span>
        <h1 className="section-title">LAUNCH YOUR BRAND IN 72 HOURS</h1>
        <p className="section-subtitle">
          Build your own branded brokerage with XMLiquidity's institutional-grade white-label solution. Full technology stack, liquidity, and 24/7 support included.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 32 }}>
          <a href="#" className="laser-btn">REQUEST DEMO</a>
          <a href="#" className="laser-btn laser-btn--outline">CONTACT SALES</a>
        </div>
      </section>

      <section className="why-section">
        <div className="why-section__header">
          <span className="mono-label">WHAT WE OFFER</span>
          <h2 className="section-title">COMPLETE WHITE-LABEL SOLUTION</h2>
          <p className="section-subtitle">Everything you need to launch and scale your brokerage business.</p>
        </div>
        <div className="bento-grid">
          {solutions.map((s) => (
            <ScrollReveal key={s.title}>
              <div className="bento-card">
                <h3 className="bento-card__title">{s.title}</h3>
                <p className="bento-card__desc">{s.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="included-section">
        <h2 className="section-title" style={{ textAlign: 'center', marginBottom: 48 }}>WHAT'S INCLUDED</h2>
        <div className="included-grid">
          <div className="included-card">
            <h3 className="included-card__title">TECHNOLOGY STACK</h3>
            <ul className="included-card__list">
              {techStack.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="included-card">
            <h3 className="included-card__title">BUSINESS SERVICES</h3>
            <ul className="included-card__list">
              {businessServices.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="process-section">
        <div style={{ textAlign: 'center' }}>
          <span className="mono-label">HOW IT WORKS</span>
          <h2 className="section-title" style={{ marginTop: 16 }}>LAUNCH PROCESS</h2>
        </div>
        <div className="process-grid">
          {steps.map((s) => (
            <ScrollReveal key={s.num}>
              <div className="process-step">
                <div className="process-step__num">{s.num}</div>
                <h3 className="process-step__title">{s.title}</h3>
                <p className="process-step__desc">{s.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div className="final-cta__inner">
          <h2 className="section-title">READY TO LAUNCH YOUR BROKERAGE?</h2>
          <p className="section-subtitle">
            Join successful brokers using our white-label solution. Schedule a consultation today.
          </p>
          <div className="final-cta__actions">
            <a href="#" className="laser-btn">SCHEDULE CONSULTATION</a>
            <a href="#" className="laser-btn laser-btn--outline">LEARN MORE</a>
          </div>
        </div>
      </section>
    </>
  )
}
