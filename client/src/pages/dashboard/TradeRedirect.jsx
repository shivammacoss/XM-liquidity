/**
 * /dashboard/trade → resolves the broker's manual trading sub-account and
 * forwards into the terminal at /trade/:accountId.
 *
 * If the broker's liquidity account hasn't been fully provisioned, show an
 * empty state with a link back to Accounts.
 */

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { accountsApi } from '../../services/dashboard'

export default function TradeRedirect() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | ready | empty

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await accountsApi.list()
        const nonProp = (data.accounts || []).filter((a) => !a.is_prop_account)
        // accounts[0] = API feed, accounts[1] = Manual
        const manual = nonProp[1]
        if (manual?.id) {
          navigate(`/trade/${manual.id}`, { replace: true })
          setStatus('ready')
        } else {
          setStatus('empty')
        }
      } catch {
        setStatus('empty')
      }
    })()
  }, [navigate])

  if (status === 'loading' || status === 'ready') {
    return <div className="dash-loading">Opening trading terminal…</div>
  }

  return (
    <div className="dash-page">
      <div className="liq-empty">
        <p>
          Your manual trading account isn’t provisioned yet. Once the XMLiquidity
          admin team sets up your liquidity account, you’ll be able to open the
          trading terminal directly from here.
        </p>
        <p style={{ marginTop: 14 }}>
          <Link to="/dashboard/accounts" className="signin-footer-link__a">
            Go to Accounts →
          </Link>
        </p>
      </div>
    </div>
  )
}
