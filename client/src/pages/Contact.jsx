import ScrollReveal from '../components/ScrollReveal'

const contactMethods = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
      </svg>
    ),
    title: 'PHONE',
    value: '+1 (908) 228-0305',
    sub: 'AVAILABLE 24/7',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    title: 'EMAIL',
    value: 'support@xmliquidity.com',
    sub: 'RESPONSE WITHIN 1 HOUR',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    title: 'LIVE CHAT',
    value: 'Chat with us',
    sub: 'INSTANT SUPPORT',
  },
]

export default function Contact() {
  return (
    <>
      <section className="page-hero">
        <span className="mono-label">GET IN TOUCH</span>
        <h1 className="section-title">WE'RE HERE TO HELP</h1>
        <p className="section-subtitle">
          Have questions? Our support team is available 24/7 to assist you.
        </p>
      </section>

      <div className="contact-grid">
        {contactMethods.map((c) => (
          <ScrollReveal key={c.title}>
            <div className="contact-card">
              <div className="contact-card__icon">{c.icon}</div>
              <h3 className="contact-card__title">{c.title}</h3>
              <div className="contact-card__value">{c.value}</div>
              <div className="contact-card__sub">{c.sub}</div>
            </div>
          </ScrollReveal>
        ))}
      </div>

      <section className="contact-form-section">
        <h2>SEND US A MESSAGE</h2>
        <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
          <div className="contact-form__group">
            <label className="contact-form__label">FIRST NAME</label>
            <input type="text" className="contact-form__input" placeholder="John" />
          </div>
          <div className="contact-form__group">
            <label className="contact-form__label">LAST NAME</label>
            <input type="text" className="contact-form__input" placeholder="Doe" />
          </div>
          <div className="contact-form__group">
            <label className="contact-form__label">EMAIL</label>
            <input type="email" className="contact-form__input" placeholder="john@example.com" />
          </div>
          <div className="contact-form__group">
            <label className="contact-form__label">SUBJECT</label>
            <select className="contact-form__select">
              <option>General Inquiry</option>
              <option>Account Support</option>
              <option>Technical Issue</option>
              <option>Partnership</option>
            </select>
          </div>
          <div className="contact-form__group contact-form__group--full">
            <label className="contact-form__label">MESSAGE</label>
            <textarea className="contact-form__textarea" placeholder="How can we help you?" />
          </div>
          <div className="contact-form__submit">
            <button type="submit" className="laser-btn" style={{ width: '100%' }}>SEND MESSAGE</button>
          </div>
        </form>
      </section>

      <section className="offices-section">
        <div style={{ textAlign: 'center' }}>
          <span className="mono-label">LOCATIONS</span>
          <h2 className="section-title" style={{ marginTop: 16 }}>OUR OFFICES</h2>
        </div>
        <div className="offices-grid">
          <div className="office-card">
            <h3 className="office-card__title">UK OFFICE</h3>
            <p className="office-card__address">Office 9364hn, 3 Fitzroy Place, Glasgow City Centre, UK, G3 7RH</p>
            <span className="office-card__hours">MON-FRI: 9:00 AM - 6:00 PM GMT</span>
          </div>
          <div className="office-card">
            <h3 className="office-card__title">ST. LUCIA OFFICE</h3>
            <p className="office-card__address">Rodney Bay, Gros Islet, St. Lucia</p>
            <span className="office-card__hours">MON-FRI: 9:00 AM - 5:00 PM AST</span>
          </div>
        </div>
      </section>
    </>
  )
}
