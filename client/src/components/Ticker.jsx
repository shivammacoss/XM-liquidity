const tickerItems = [
  { symbol: 'EUR/USD', price: '1.0850', change: '+0.17%', dir: 'up' },
  { symbol: 'GBP/USD', price: '1.2633', change: '-0.15%', dir: 'down' },
  { symbol: 'BTC/USD', price: '43,229.57', change: '+2.44%', dir: 'up' },
  { symbol: 'ETH/USD', price: '2,287.57', change: '+1.76%', dir: 'up' },
  { symbol: 'XAU/USD', price: '2,045.53', change: '+0.40%', dir: 'up' },
  { symbol: 'US30', price: '37,851.63', change: '+0.28%', dir: 'up' },
  { symbol: 'NAS100', price: '16,882.24', change: '+0.66%', dir: 'up' },
  { symbol: 'OIL', price: '72.45', change: '-1.21%', dir: 'down' },
]

export default function Ticker() {
  const loop = [...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems]
  return (
    <div className="ticker" aria-label="Live liquidity feed">
      <div className="ticker__track">
        {loop.map((it, i) => (
          <div key={`${it.symbol}-${i}`} className="ticker__item">
            <span className="ticker__symbol">{it.symbol}</span>
            <span className="ticker__price">{it.price}</span>
            <span className={`ticker__change ticker__change--${it.dir}`}>{it.change}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
