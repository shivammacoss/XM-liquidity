import ScrollReveal from '../components/ScrollReveal'

const instruments = [
  { icon: '\u20AC$', pair: 'EUR/USD', spread: '0.06 pips', leverage: '1:500' },
  { icon: '\uD83E\uDD47', pair: 'XAU/USD', spread: '0.12 pips', leverage: '1:200' },
  { icon: '\u20BF', pair: 'BTC/USD', spread: '10 pips', leverage: '1:100' },
  { icon: '\u00A3$', pair: 'GBP/USD', spread: '0.08 pips', leverage: '1:500' },
]

export default function Markets() {
  return (
    <>
      <section className="page-hero">
        <span className="mono-label">GLOBAL MARKETS</span>
        <h1 className="section-title">TRADE GLOBAL MARKETS WITH COMPETITIVE CONDITIONS</h1>
        <p className="section-subtitle">
          Access deep liquidity across multiple asset classes. All strategies permitted including scalping, hedging, and algorithmic trading.
        </p>
      </section>

      <section className="markets-section" style={{ borderTop: 'none', paddingTop: 0 }}>
        <div className="markets-section__inner">
          <div>
            <h2 className="section-title" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)' }}>
              COMPETITIVE CONDITIONS
            </h2>
            <ul className="markets-section__list">
              <li>Leverage up to 1:500 on forex pairs</li>
              <li>No requotes, deep market depth</li>
              <li>Swap-free Islamic accounts available</li>
              <li>Minimum deposit from $25</li>
            </ul>
            <a href="#" className="laser-btn">START TRADING</a>
          </div>

          <div>
            <div className="mono-label" style={{ marginBottom: 24 }}>POPULAR INSTRUMENTS</div>
            <table className="instruments-table">
              <thead>
                <tr>
                  <th className="instruments-table__header">INSTRUMENT</th>
                  <th className="instruments-table__header">SPREAD</th>
                  <th className="instruments-table__header">LEVERAGE</th>
                </tr>
              </thead>
              <tbody>
                {instruments.map((inst) => (
                  <tr key={inst.pair} className="instruments-table__row">
                    <td className="instruments-table__cell">
                      <div className="instruments-table__pair">
                        <div className="instruments-table__pair-icon">{inst.icon}</div>
                        <div className="instruments-table__pair-name">{inst.pair}</div>
                      </div>
                    </td>
                    <td className="instruments-table__cell">{inst.spread}</td>
                    <td className="instruments-table__cell">{inst.leverage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <ScrollReveal>
        <div className="stats">
          <div className="stats__grid">
            <div className="stats__item">
              <div className="stats__label">RAW SPREADS FROM</div>
              <div className="stats__value">0.06</div>
              <div className="stats__unit">PIPS</div>
            </div>
            <div className="stats__item">
              <div className="stats__label">EXECUTION SPEED</div>
              <div className="stats__value">&lt;40</div>
              <div className="stats__unit">MS</div>
            </div>
            <div className="stats__item">
              <div className="stats__label">COMMISSION PER LOT</div>
              <div className="stats__value">$2</div>
              <div className="stats__unit">FLAT</div>
            </div>
            <div className="stats__item">
              <div className="stats__label">CRYPTO WITHDRAWALS</div>
              <div className="stats__value">{'\u2264'}1</div>
              <div className="stats__unit">HOUR</div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      <section className="final-cta">
        <div className="final-cta__inner">
          <h2 className="section-title">READY TO TRADE WITH INSTITUTIONAL SPEED?</h2>
          <p className="section-subtitle">
            Join thousands of traders who trust XMLiquidity for lightning-fast execution, ultra-low spreads, and reliable crypto payouts.
          </p>
          <div className="final-cta__actions">
            <a href="#" className="laser-btn">OPEN LIVE ACCOUNT</a>
            <a href="#" className="laser-btn laser-btn--outline">TRY DEMO</a>
          </div>
        </div>
      </section>
    </>
  )
}
