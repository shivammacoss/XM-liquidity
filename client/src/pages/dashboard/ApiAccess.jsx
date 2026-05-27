/**
 * XMLiquidity — Broker API / Webhook Access
 *
 * Documentation page where brokers see their unique API credentials and the
 * exact payload format XMLiquidity expects for inbound trade signals
 * (market / pending, buy / sell, open / close, SL / TP).
 *
 * NOTE: Until the server exposes a /users/me/api-key endpoint, the API key
 * is derived from the user's ID so the same broker always sees the same key.
 */

import { useState } from 'react'
import { useSelector } from 'react-redux'

const fakeKeyFromId = (id) => {
  if (!id) return 'xmlq_demo_PROVISIONING'
  const compact = id.replace(/[^a-f0-9]/gi, '').slice(0, 16)
  return `xmlq_live_${compact}`
}

const fakeSecretFromId = (id) => {
  if (!id) return '••••••••••••••••••••••••••••••••'
  const compact = id.replace(/[^a-f0-9]/gi, '').slice(0, 32).padEnd(32, '0')
  return `xmlqsec_${compact}`
}

function Copy({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="api-copy-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch { /* clipboard blocked */ }
      }}
    >
      {copied ? '✓ COPIED' : label}
    </button>
  )
}

function CodeBlock({ children }) {
  return (
    <pre className="api-code">
      <code>{children}</code>
    </pre>
  )
}

export default function ApiAccess() {
  const user = useSelector((s) => s.auth.user)
  const apiKey = fakeKeyFromId(user?.id)
  const apiSecret = fakeSecretFromId(user?.id)
  const webhookUrl = `https://api.xmliquidity.com/api/v1/webhooks/broker/${apiKey}`
  const wsUrl = `wss://stream.xmliquidity.com/v1/broker/${apiKey}`

  const samplePayload = `{
  "signal_id": "9f3c2b1a-7e4d",
  "timestamp": 1769734821,
  "client_account": "MT5-43928",
  "symbol": "EURUSD",
  "side": "buy",
  "order_type": "market",
  "quantity": 0.25,
  "price": null,
  "stop_loss": 1.0815,
  "take_profit": 1.0905,
  "comment": "MT5 EA – Strategy 14"
}`

  const closePayload = `{
  "signal_id": "9f3c2b1a-7e4d",
  "timestamp": 1769735410,
  "client_account": "MT5-43928",
  "symbol": "EURUSD",
  "close_ticket": "XMLQ-88421",
  "quantity": 0.25,
  "comment": "Manual close from MT5"
}`

  const pendingPayload = `{
  "signal_id": "47a91ce0-3f12",
  "timestamp": 1769736002,
  "client_account": "MT4-91244",
  "symbol": "XAUUSD",
  "side": "sell",
  "order_type": "limit",
  "quantity": 0.05,
  "price": 2055.40,
  "stop_loss": 2065.00,
  "take_profit": 2042.00,
  "expires_at": 1769822402
}`

  return (
    <div className="dash-page">
      <div className="api-hero">
        <span className="mono-label">CONNECTIVITY</span>
        <h2 className="api-hero__title">API &amp; Webhook Access</h2>
        <p className="api-hero__desc">
          Connect your broker into XMLiquidity. Push trade signals via webhook, stream
          live state over WebSocket, and rely on a single authenticated channel for buy,
          sell, pending, and close operations.
        </p>
      </div>

      {/* Credentials */}
      <section className="api-card">
        <div className="api-card__head">
          <div>
            <span className="mono-label">YOUR CREDENTIALS</span>
            <h3 className="api-card__title">Authenticated endpoints</h3>
          </div>
        </div>

        <div className="api-cred-row">
          <div className="api-cred-row__label">WEBHOOK URL (POST)</div>
          <div className="api-cred-row__value">
            <code>{webhookUrl}</code>
            <Copy text={webhookUrl} />
          </div>
        </div>

        <div className="api-cred-row">
          <div className="api-cred-row__label">REALTIME STREAM (WSS)</div>
          <div className="api-cred-row__value">
            <code>{wsUrl}</code>
            <Copy text={wsUrl} />
          </div>
        </div>

        <div className="api-cred-row">
          <div className="api-cred-row__label">API KEY</div>
          <div className="api-cred-row__value">
            <code>{apiKey}</code>
            <Copy text={apiKey} />
          </div>
        </div>

        <div className="api-cred-row">
          <div className="api-cred-row__label">API SECRET (HMAC-SHA256)</div>
          <div className="api-cred-row__value">
            <code>{apiSecret}</code>
            <Copy text={apiSecret} />
          </div>
        </div>

        <p className="api-card__note">
          Every webhook request must include an <code>X-XMLQ-Signature</code> header
          containing the HMAC-SHA256 of the raw request body, signed with your API secret.
          Replay attacks are rejected if <code>timestamp</code> is more than 30 seconds
          off from server clock.
        </p>
      </section>

      {/* Signal flow */}
      <section className="api-card">
        <div className="api-card__head">
          <span className="mono-label">SIGNAL FLOW</span>
          <h3 className="api-card__title">How XMLiquidity receives broker orders</h3>
        </div>

        <ol className="api-flow">
          <li>
            <strong>1. Capture</strong> the trade event on your broker side (your bridge,
            OMS, or custom EA).
          </li>
          <li>
            <strong>2. Sign</strong> the JSON payload with HMAC-SHA256 using your API secret.
          </li>
          <li>
            <strong>3. POST</strong> to the webhook URL above. Response is{' '}
            <code>200 OK</code> + assigned <code>ticket_id</code> on success.
          </li>
          <li>
            <strong>4. Mirror</strong>: XMLiquidity routes the trade to liquidity in A-Book.
            Stream fills, slippage, and lifecycle events back to you over the WSS channel.
          </li>
        </ol>
      </section>

      {/* Payload spec */}
      <section className="api-card">
        <div className="api-card__head">
          <span className="mono-label">PAYLOAD SCHEMA</span>
          <h3 className="api-card__title">Common fields</h3>
        </div>

        <div className="api-table-wrap">
          <table className="api-table">
            <thead>
              <tr>
                <th>FIELD</th>
                <th>TYPE</th>
                <th>REQUIRED</th>
                <th>DESCRIPTION</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><code>signal_id</code></td><td>string</td><td>yes</td><td>Idempotency key from your side. Duplicate IDs are rejected.</td></tr>
              <tr><td><code>timestamp</code></td><td>int (unix s)</td><td>yes</td><td>Used for replay protection.</td></tr>
              <tr><td><code>client_account</code></td><td>string</td><td>yes</td><td>The originating client account ID on your broker platform.</td></tr>
              <tr><td><code>symbol</code></td><td>string</td><td>yes</td><td>Instrument code (e.g. <code>EURUSD</code>, <code>BTCUSD</code>, <code>XAUUSD</code>).</td></tr>
              <tr><td><code>side</code></td><td><code>buy</code> | <code>sell</code></td><td>open only</td><td>Direction of the order.</td></tr>
              <tr><td><code>order_type</code></td><td><code>market</code> | <code>limit</code> | <code>stop</code></td><td>open only</td><td>Execution type.</td></tr>
              <tr><td><code>quantity</code></td><td>number (lots)</td><td>yes</td><td>Lot size. Standard = 100,000 base units for forex.</td></tr>
              <tr><td><code>price</code></td><td>number</td><td>limit / stop</td><td>Required for non-market orders. Null for market.</td></tr>
              <tr><td><code>stop_loss</code></td><td>number</td><td>no</td><td>Optional SL in instrument price units.</td></tr>
              <tr><td><code>take_profit</code></td><td>number</td><td>no</td><td>Optional TP in instrument price units.</td></tr>
              <tr><td><code>close_ticket</code></td><td>string</td><td>close only</td><td>XMLiquidity ticket ID returned when the position opened.</td></tr>
              <tr><td><code>expires_at</code></td><td>int (unix s)</td><td>no</td><td>Cancel pending order if not filled by this time.</td></tr>
              <tr><td><code>comment</code></td><td>string</td><td>no</td><td>Free-form, surfaces on the broker dashboard.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Sample payloads */}
      <section className="api-card">
        <div className="api-card__head">
          <span className="mono-label">EXAMPLES</span>
          <h3 className="api-card__title">Sample payloads</h3>
        </div>

        <div className="api-sample">
          <div className="api-sample__title">Open — market buy with SL / TP</div>
          <CodeBlock>{samplePayload}</CodeBlock>
        </div>

        <div className="api-sample">
          <div className="api-sample__title">Open — pending limit sell with expiry</div>
          <CodeBlock>{pendingPayload}</CodeBlock>
        </div>

        <div className="api-sample">
          <div className="api-sample__title">Close — full close by ticket</div>
          <CodeBlock>{closePayload}</CodeBlock>
        </div>

        <div className="api-sample">
          <div className="api-sample__title">cURL — signed webhook POST</div>
          <CodeBlock>{`# Bash example
PAYLOAD='{"signal_id":"9f3c","timestamp":1769734821,"client_account":"MT5-43928","symbol":"EURUSD","side":"buy","order_type":"market","quantity":0.25}'
SIG=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$XMLQ_API_SECRET" -hex | awk '{print $2}')

curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-XMLQ-Signature: $SIG" \\
  -d "$PAYLOAD"`}</CodeBlock>
        </div>
      </section>

      {/* Realtime stream */}
      <section className="api-card">
        <div className="api-card__head">
          <span className="mono-label">REALTIME STREAM</span>
          <h3 className="api-card__title">WebSocket events</h3>
        </div>

        <div className="api-table-wrap">
          <table className="api-table">
            <thead>
              <tr>
                <th>EVENT</th>
                <th>PAYLOAD KEYS</th>
                <th>FIRED WHEN</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><code>order.accepted</code></td><td><code>signal_id, ticket_id</code></td><td>Webhook accepted, ticket allocated.</td></tr>
              <tr><td><code>order.filled</code></td><td><code>ticket_id, fill_price, fill_qty, slippage</code></td><td>Position opened in liquidity.</td></tr>
              <tr><td><code>order.partial</code></td><td><code>ticket_id, filled_qty, remaining_qty</code></td><td>Partial fill from LP.</td></tr>
              <tr><td><code>order.rejected</code></td><td><code>signal_id, reason</code></td><td>Routing rejected (margin, invalid symbol, signature, etc.).</td></tr>
              <tr><td><code>position.closed</code></td><td><code>ticket_id, close_price, realized_pnl</code></td><td>Position fully closed (by you, by SL/TP, or by stop-out).</td></tr>
              <tr><td><code>account.equity</code></td><td><code>balance, equity, free_margin, margin_level</code></td><td>Periodic snapshot every 1s while market open.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="api-footer-note">
        Need help integrating? Email{' '}
        <a href="mailto:integration@xmliquidity.com" className="signin-legal__a">
          integration@xmliquidity.com
        </a>{' '}
        or open a chat with your account manager.
      </p>
    </div>
  )
}
