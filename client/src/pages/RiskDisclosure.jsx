export default function RiskDisclosure() {
  return (
    <>
      <section className="page-hero">
        <span className="mono-label">LEGAL</span>
        <h1 className="section-title">RISK DISCLOSURE</h1>
        <p className="section-subtitle">Last updated: March 2026</p>
      </section>

      <div className="legal-page">
        <div className="warning-box">
          <p><strong>Important Risk Warning:</strong> Trading foreign exchange, cryptocurrencies, and other leveraged instruments carries a high level of risk and may not be suitable for all investors. You may lose some or all of your invested capital. Past performance is not indicative of future results.</p>
        </div>

        <h2>1. Leverage Risk</h2>
        <p>XMLiquidity offers leverage up to 1:500 on certain instruments. Leverage amplifies both gains and losses. A small adverse price movement can result in substantial losses or even the complete loss of your deposit.</p>
        <p><strong style={{ color: 'var(--text-primary)' }}>Example:</strong> With 1:100 leverage, a 1% adverse price movement results in a 100% loss of your margin.</p>

        <h2>2. Market Risk</h2>
        <p>Financial markets are volatile and unpredictable. Prices can move rapidly due to:</p>
        <ul>
          <li>Economic data releases and central bank announcements</li>
          <li>Geopolitical events and political instability</li>
          <li>Market sentiment shifts and investor behavior</li>
          <li>Supply and demand imbalances</li>
          <li>Regulatory changes and policy decisions</li>
          <li>Cryptocurrency volatility and technological changes</li>
        </ul>

        <h2>3. Liquidity Risk</h2>
        <p>While major currency pairs are highly liquid, some instruments may have limited liquidity. During periods of low liquidity, you may experience:</p>
        <ul>
          <li>Wider bid-ask spreads</li>
          <li>Slippage on order execution</li>
          <li>Difficulty closing positions at desired prices</li>
          <li>Increased trading costs</li>
        </ul>

        <h2>4. Counterparty Risk</h2>
        <p>Your trades are executed through XMLiquidity's liquidity providers. If a liquidity provider defaults or experiences financial difficulties, your funds may be at risk despite our segregated account structure.</p>

        <h2>5. Technology Risk</h2>
        <p>Trading platforms are subject to technical failures, including:</p>
        <ul>
          <li>Server outages and connectivity issues</li>
          <li>Platform bugs and software errors</li>
          <li>Cyber attacks and security breaches</li>
          <li>Internet connection failures on your end</li>
          <li>Mobile app crashes and malfunctions</li>
        </ul>
        <p>While we maintain redundant systems and backups, we cannot guarantee 100% uptime. Trading during periods of technical difficulty may result in losses.</p>

        <h2>6. Cryptocurrency Risk</h2>
        <p>Cryptocurrency trading carries additional risks:</p>
        <ul>
          <li>Extreme price volatility (50%+ daily moves are possible)</li>
          <li>Regulatory uncertainty and potential bans</li>
          <li>Wallet and exchange security risks</li>
          <li>Blockchain network congestion and delays</li>
          <li>Limited historical data and price discovery</li>
          <li>Potential for total loss of investment</li>
        </ul>

        <h2>7. Operational Risk</h2>
        <p>Risks related to our operations include:</p>
        <ul>
          <li>Human error in order processing</li>
          <li>System failures and data loss</li>
          <li>Fraud and unauthorized access</li>
          <li>Regulatory enforcement actions</li>
          <li>Changes in business operations</li>
        </ul>

        <h2>8. Regulatory Risk</h2>
        <p>Financial regulations are subject to change. Changes in regulations could:</p>
        <ul>
          <li>Restrict trading in certain instruments</li>
          <li>Reduce maximum leverage available</li>
          <li>Increase trading costs through new fees</li>
          <li>Require account closure for certain jurisdictions</li>
          <li>Affect platform availability in your country</li>
        </ul>

        <h2>9. Negative Balance Protection</h2>
        <p>While XMLiquidity offers negative balance protection, meaning your account cannot go below zero, this protection may not apply in all circumstances, including:</p>
        <ul>
          <li>Extreme market gaps and flash crashes</li>
          <li>System failures during market volatility</li>
          <li>Violations of our terms of service</li>
        </ul>

        <h2>10. Risk Management Best Practices</h2>
        <p>To manage trading risks:</p>
        <ul>
          <li>Only trade with capital you can afford to lose</li>
          <li>Use stop-loss orders to limit potential losses</li>
          <li>Diversify your portfolio across multiple instruments</li>
          <li>Avoid over-leveraging your account</li>
          <li>Keep up with economic news and market developments</li>
          <li>Develop and follow a trading plan</li>
          <li>Avoid emotional decision-making</li>
          <li>Start with a demo account to practice</li>
          <li>Educate yourself about markets and trading</li>
        </ul>

        <h2>11. Acknowledgment</h2>
        <p>By opening an account with XMLiquidity, you acknowledge that you have read and understood this Risk Disclosure, and you accept all risks associated with trading on our platform. You confirm that you are trading at your own risk and that XMLiquidity is not responsible for any losses incurred.</p>

        <h2>12. Contact Information</h2>
        <div className="contact-info">
          <p><strong style={{ color: 'var(--text-primary)' }}>XMLiquidity Risk Management Team</strong></p>
          <p>Email: risk@xmliquidity.com</p>
          <p>Phone: +1 (908) 228-0305</p>
          <p>Address: Office 9364hn, 3 Fitzroy Place, Glasgow City Centre, UK, G3 7RH</p>
        </div>
      </div>
    </>
  )
}
