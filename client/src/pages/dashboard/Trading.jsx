/**
 * XMLiquidity — Professional Trading Terminal
 * Full-screen layout: TradingView chart + order panel + watchlist + positions
 * Opens from account cards via /trade/:accountId
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { tradesApi, accountsApi, instrumentsApi } from '../../services/dashboard'
import { useToast } from '../../components/Toast'
import TradingViewChart from '../../components/TradingViewChart'
import { soundBuy, soundSell, soundClose, soundProfit, soundLoss, soundCancel, soundCloseAll, soundStopLoss, soundError, soundClick } from '../../services/sounds'
import { fetchTradePrice } from '../../services/infowayDatafeed'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
const API_KEY = import.meta.env.VITE_INFOWAY_API_KEY || '2e3ee94f2bf749769a73000cd8302f19-infoway'

// Format price with proper decimals per instrument type
function fmtPrice(price, inst) {
  if (!price || !inst) return '-'
  const s = inst.symbol || ''
  const seg = inst.segment || ''
  // JPY pairs: 3 decimals
  if (s.includes('JPY')) return price.toFixed(3)
  // Crypto: 2 decimals for BTC/ETH/BNB/SOL, 4 for small coins
  if (seg === 'crypto') return price > 10 ? price.toFixed(2) : price.toFixed(4)
  // Metals: 2 decimals
  if (seg === 'metals' || s.includes('XAU') || s.includes('XAG')) return price.toFixed(2)
  // Indices: 2 decimals
  if (seg === 'indices') return price.toFixed(2)
  // Energy: 3 decimals
  if (seg === 'energy') return price.toFixed(3)
  // Forex default: 5 decimals
  return price.toFixed(5)
}

export default function Trading() {
  const { accountId } = useParams()
  const navigate = useNavigate()

  const [account, setAccount] = useState(null)
  const [instruments, setInstruments] = useState([])
  const [segments, setSegments] = useState([])
  const [openTrades, setOpenTrades] = useState([])
  const [pendingOrders, setPendingOrders] = useState([])
  const [closedTrades, setClosedTrades] = useState([])
  const [selectedSegment, setSelectedSegment] = useState('')
  const [selectedInstrument, setSelectedInstrument] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [positionTab, setPositionTab] = useState('positions')
  const [showWatchlist, setShowWatchlist] = useState(true)
  const [mobileTab, setMobileTab] = useState('market') // market | chart | positions | history
  const [mobileOrderSheet, setMobileOrderSheet] = useState(false)
  const [livePrices, setLivePrices] = useState({}) // { EURUSD: { bid, ask, spread, change } }
  const priceWsRef = useRef(null)
  const toast = useToast()
  const [closeMenuTradeId, setCloseMenuTradeId] = useState(null)
  const [partialCloseId, setPartialCloseId] = useState(null)
  const [partialLots, setPartialLots] = useState('')
  const [positionsHeight, setPositionsHeight] = useState(220)
  const isDraggingRef = useRef(false)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(220)

  // Order form
  const [orderTab, setOrderTab] = useState('market') // market, pending
  const [direction, setDirection] = useState('buy')
  const [lotSize, setLotSize] = useState(0.01)
  const [price, setPrice] = useState('')
  const [sl, setSl] = useState('')
  const [tp, setTp] = useState('')

  const chartContainerRef = useRef(null)

  useEffect(() => { loadInitial() }, [accountId])
  useEffect(() => { loadInstruments() }, [selectedSegment])
  useEffect(() => { if (account) loadPositions() }, [account])

  // Auto-refresh positions every 2 seconds
  useEffect(() => {
    if (!account) return
    const posInterval = setInterval(loadPositions, 2000)
    return () => clearInterval(posInterval)
  }, [account])

  // Connect WebSocket for real-time ticks (primary), REST poll as fallback
  useEffect(() => {
    if (instruments.length === 0) return
    connectPriceWs()
    // REST poll as fallback — slower interval to avoid rate limits
    fetchAllPrices()
    const interval = setInterval(fetchAllPrices, 5000)

    return () => {
      clearInterval(interval)
      if (priceWsRef.current) { priceWsRef.current.close(); priceWsRef.current = null }
      if (cryptoWsRef.current) { cryptoWsRef.current.close(); cryptoWsRef.current = null }
    }
  }, [instruments])

  // Persist selected instrument
  useEffect(() => {
    if (selectedInstrument) {
      try { localStorage.setItem('st_instrument', selectedInstrument.symbol) } catch {}
    }
  }, [selectedInstrument])

  // Market orders: price auto-tracks live bid/ask every tick
  useEffect(() => {
    if (!selectedInstrument) return
    const lp = livePrices[selectedInstrument.symbol]
    if (!lp) return
    if (orderTab === 'market') {
      setPrice(direction === 'buy' ? lp.ask.toString() : lp.bid.toString())
    }
  }, [livePrices, selectedInstrument, direction, orderTab])

  const fetchAllPrices = async () => {
    const updates = {}
    const nonCrypto = instruments.filter(i => i.segment !== 'crypto')
    const crypto = instruments.filter(i => i.segment === 'crypto')

    // Batch non-crypto in groups of 20 (safe for URL length)
    for (let i = 0; i < nonCrypto.length; i += 20) {
      const batch = nonCrypto.slice(i, i + 20)
      const codes = batch.map(inst => inst.symbol).join(',')
      try {
        const data = await fetchTradePrice(codes)
        if (data && data.length > 0) {
          data.forEach(item => {
            const last = parseFloat(item.p)
            const inst = batch.find(b => b.symbol === item.s)
            if (inst && !isNaN(last) && last > 0) {
              const pipSize = inst.pip_size || 0.0001
              const spread = pipSize * (1.5 + Math.random() * 2.5)
              updates[inst.symbol] = {
                last,
                bid: parseFloat((last - spread / 2).toFixed(6)),
                ask: parseFloat((last + spread / 2).toFixed(6)),
                spread: parseFloat((spread / pipSize).toFixed(1)),
                change: item.pca ? parseFloat(item.pca) : 0,
              }
            }
          })
        }
      } catch(err) { console.warn('[Prices] batch error:', err) }
    }

    if (crypto.length > 0) {
      const codes = crypto.map(inst => inst.symbol.replace('USD', 'USDT')).join(',')
      try {
        const data = await fetchTradePrice(codes)
        if (data && data.length > 0) {
          data.forEach(item => {
            const last = parseFloat(item.p)
            const inst = crypto.find(c => c.symbol.replace('USD', 'USDT') === item.s)
            if (inst && !isNaN(last) && last > 0) {
              const pipSize = inst.pip_size || 0.01
              const spread = pipSize * (2 + Math.random() * 5)
              updates[inst.symbol] = {
                last,
                bid: parseFloat((last - spread / 2).toFixed(6)),
                ask: parseFloat((last + spread / 2).toFixed(6)),
                spread: parseFloat((spread / pipSize).toFixed(1)),
                change: item.pca ? parseFloat(item.pca) : 0,
              }
            }
          })
        }
      } catch(err) { console.warn('[Prices] crypto error:', err) }
    }

    if (Object.keys(updates).length > 0) {
      setLivePrices(prev => ({ ...prev, ...updates }))
    }
  }

  const cryptoWsRef = useRef(null)

  const connectPriceWs = () => {
    // Build symbol lookup maps once
    const commonSyms = instruments.filter(i => i.segment !== 'crypto')
    const cryptoSyms = instruments.filter(i => i.segment === 'crypto')
    const symMap = {}
    commonSyms.forEach(i => { symMap[i.symbol] = i })
    const cryptoMap = {}
    cryptoSyms.forEach(i => { cryptoMap[i.symbol.replace('USD', 'USDT')] = i })

    const handleTick = (item, inst) => {
      if (!item.p || !inst) return
      const last = parseFloat(item.p)
      if (isNaN(last) || last <= 0) return
      const pipSize = inst.pip_size || 0.0001
      setLivePrices(prev => {
        const old = prev[inst.symbol]
        const spread = old?.spread ? old.spread * pipSize : pipSize * 2
        return {
          ...prev,
          [inst.symbol]: {
            last,
            bid: parseFloat((last - spread / 2).toFixed(6)),
            ask: parseFloat((last + spread / 2).toFixed(6)),
            spread: parseFloat((spread / pipSize).toFixed(1)),
            change: item.pca ? parseFloat(item.pca) : (old?.change || 0),
          }
        }
      })
    }

    // --- Common WS (forex, metals, indices, energy) ---
    if (!priceWsRef.current && commonSyms.length > 0) {
      const ws = new WebSocket(`wss://data.infoway.io/ws?business=common&apikey=${API_KEY}`)
      priceWsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] Common connected, subscribing', commonSyms.length, 'symbols')
        const codes = commonSyms.map(i => i.symbol).join(',')
        ws.send(JSON.stringify({ code: 10000, trace: String(Date.now()), data: { codes } }))
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (!msg.data) return
          const items = Array.isArray(msg.data) ? msg.data : [msg.data]
          items.forEach(item => {
            if (item.s && item.p) handleTick(item, symMap[item.s])
          })
        } catch {}
      }

      ws.onerror = (e) => console.warn('[WS] Common error:', e)
      ws.onclose = () => {
        priceWsRef.current = null
        setTimeout(() => { if (instruments.length > 0) connectPriceWs() }, 3000)
      }

      // Heartbeat
      const hb = setInterval(() => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ code: 10010, trace: String(Date.now()) }))
        else clearInterval(hb)
      }, 25000)
    }

    // --- Crypto WS ---
    if (!cryptoWsRef.current && cryptoSyms.length > 0) {
      const ws = new WebSocket(`wss://data.infoway.io/ws?business=crypto&apikey=${API_KEY}`)
      cryptoWsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] Crypto connected, subscribing', cryptoSyms.length, 'symbols')
        const codes = cryptoSyms.map(i => i.symbol.replace('USD', 'USDT')).join(',')
        ws.send(JSON.stringify({ code: 10000, trace: String(Date.now()), data: { codes } }))
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (!msg.data) return
          const items = Array.isArray(msg.data) ? msg.data : [msg.data]
          items.forEach(item => {
            if (item.s && item.p) handleTick(item, cryptoMap[item.s])
          })
        } catch {}
      }

      ws.onerror = (e) => console.warn('[WS] Crypto error:', e)
      ws.onclose = () => {
        cryptoWsRef.current = null
        setTimeout(() => { if (instruments.length > 0) connectPriceWs() }, 3000)
      }

      // Heartbeat for crypto too
      const hb = setInterval(() => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ code: 10010, trace: String(Date.now()) }))
        else clearInterval(hb)
      }, 25000)
    }
  }

  const loadInitial = async () => {
    try {
      const [acctRes, segRes] = await Promise.all([
        accountsApi.get(accountId),
        instrumentsApi.segments(),
      ])
      setAccount(acctRes.data)
      setSegments(segRes.data)
    } catch {
      navigate('/dashboard/accounts')
    } finally { setLoading(false) }
  }

  const loadInstruments = async () => {
    try {
      const params = selectedSegment ? { segment: selectedSegment } : {}
      const { data } = await instrumentsApi.list(params)
      const list = Array.isArray(data) ? data : []
      setInstruments(list)
      if (list.length > 0 && !selectedInstrument) {
        const saved = localStorage.getItem('st_instrument')
        const restored = saved ? list.find(i => i.symbol === saved) : null
        const xauusd = list.find(i => i.symbol === 'XAUUSD')
        setSelectedInstrument(restored || xauusd || list[0])
        setPrice('')
      } else if (list.length > 0 && selectedInstrument) {
        const stillExists = list.find(i => i.symbol === selectedInstrument.symbol)
        if (!stillExists) {
          setSelectedInstrument(list[0])
          setPrice('')
        }
      }
    } catch (err) {
      console.error('[Instruments] Load error:', err)
    }
  }

  const loadPositions = async () => {
    // Fetch each independently — don't let one failure block others
    try {
      const openRes = await tradesApi.getOpen({ account_id: accountId })
      setOpenTrades(Array.isArray(openRes.data) ? openRes.data : [])
    } catch (err) {
      console.error('[Positions] Open trades error:', err)
    }

    try {
      const pendRes = await tradesApi.getPending({ account_id: accountId })
      setPendingOrders(Array.isArray(pendRes.data) ? pendRes.data : [])
    } catch (err) {
      console.error('[Positions] Pending error:', err)
    }

    try {
      const closedRes = await tradesApi.getHistory({ account_id: accountId, per_page: 20 })
      const closedData = closedRes.data?.trades || (Array.isArray(closedRes.data) ? closedRes.data : [])
      setClosedTrades(closedData)
    } catch (err) {
      console.error('[Positions] History error:', err)
    }
  }

  const handlePlaceOrder = async (e) => {
    e.preventDefault()
    if (!selectedInstrument) { toast.error('Select an instrument'); return }

    // For market orders, always use the freshest live price at execution time
    let execPrice = parseFloat(price)
    if (orderTab === 'market') {
      const lp = livePrices[selectedInstrument.symbol]
      if (!lp) { toast.error('Waiting for live price...'); return }
      execPrice = direction === 'buy' ? lp.ask : lp.bid
    } else if (!price) {
      toast.error('Enter a limit price'); return
    }

    setPlacing(true)
    try {
      await tradesApi.open({
        account_id: accountId,
        instrument: selectedInstrument.symbol,
        direction,
        lot_size: lotSize,
        order_type: orderTab === 'pending' ? 'limit' : 'market',
        price: execPrice,
        stop_loss: sl ? parseFloat(sl) : null,
        take_profit: tp ? parseFloat(tp) : null,
      })
      toast.tradeOpened(selectedInstrument.symbol, direction, lotSize, price)
      direction === 'buy' ? soundBuy() : soundSell()
      await loadPositions()
      await loadInitial()
      setTimeout(() => { loadPositions(); loadInitial() }, 500)
    } catch (err) { toast.error(err.response?.data?.detail || 'Order failed'); soundError() }
    finally { setPlacing(false) }
  }

  const getLiveClosePrice = (trade) => {
    const lp = livePrices[trade.instrument]
    if (lp) return trade.direction === 'buy' ? (lp.bid || lp.last) : (lp.ask || lp.last)
    return trade.current_price || trade.open_price
  }

  const getLivePnl = (trade) => {
    const lp = livePrices[trade.instrument]
    if (!lp) return 0
    const closeAt = trade.direction === 'buy' ? (lp.bid || lp.last) : (lp.ask || lp.last)
    const inst = instruments.find(i => i.symbol === trade.instrument)
    const cs = inst?.lot_size || 100000
    return trade.direction === 'buy'
      ? (closeAt - trade.open_price) * trade.lot_size * cs
      : (trade.open_price - closeAt) * trade.lot_size * cs
  }

  const handleClose = async (tradeId) => {
    const trade = openTrades.find(t => t.id === tradeId)
    if (!trade) return
    try {
      const closePrice = getLiveClosePrice(trade)
      await tradesApi.close(tradeId, { close_price: closePrice })
      const pnl = getLivePnl(trade)
      toast.tradeClosed(trade.instrument, pnl)
      pnl >= 0 ? soundProfit() : soundLoss()
      await loadPositions()
      await loadInitial()
    } catch (err) { toast.error('Close failed: ' + (err.response?.data?.detail || '')) }
    setCloseMenuTradeId(null)
  }

  const handleCloseAll = async () => {
    let total = 0
    for (const t of openTrades) {
      try {
        await tradesApi.close(t.id, { close_price: getLiveClosePrice(t) })
        total += getLivePnl(t)
      } catch {}
    }
    toast.tradeClosed('All positions', total)
    soundCloseAll()
    await loadPositions()
    await loadInitial()
  }

  const handleCloseProfit = async () => {
    const profitable = openTrades.filter(t => getLivePnl(t) > 0)
    if (profitable.length === 0) { toast.info('No profitable positions to close'); return }
    let total = 0
    for (const t of profitable) {
      try {
        await tradesApi.close(t.id, { close_price: getLiveClosePrice(t) })
        total += getLivePnl(t)
      } catch {}
    }
    toast.success(`Closed ${profitable.length} profitable positions | +$${total.toFixed(2)}`)
    soundProfit()
    await loadPositions()
    await loadInitial()
  }

  const handleCloseLoss = async () => {
    const losing = openTrades.filter(t => getLivePnl(t) < 0)
    if (losing.length === 0) { toast.info('No losing positions to close'); return }
    let total = 0
    for (const t of losing) {
      try {
        await tradesApi.close(t.id, { close_price: getLiveClosePrice(t) })
        total += getLivePnl(t)
      } catch {}
    }
    toast.warning(`Closed ${losing.length} losing positions | $${total.toFixed(2)}`)
    soundLoss()
    await loadPositions()
    await loadInitial()
  }

  const handlePartialClose = async (tradeId) => {
    const lots = parseFloat(partialLots)
    if (!lots || lots <= 0) { toast.error('Enter valid lot size'); return }
    const trade = openTrades.find(t => t.id === tradeId)
    if (!trade) return
    try {
      await tradesApi.partialClose(tradeId, { lot_size: lots, close_price: getLiveClosePrice(trade) })
      toast.success(`Partially closed ${lots} lots of ${trade.instrument}`)
      soundClose()
      setPartialCloseId(null)
      setPartialLots('')
      await loadPositions()
      await loadInitial()
    } catch (err) { toast.error(err.response?.data?.detail || 'Partial close failed') }
  }

  const handleModifySLTP = async (tradeId, field, value) => {
    const numValue = parseFloat(value)
    if (isNaN(numValue) && value !== '') return
    try {
      const data = {}
      data[field] = value === '' ? null : numValue
      await tradesApi.modify(tradeId, data)
      toast.info(`${field === 'stop_loss' ? 'SL' : 'TP'} updated to ${value || 'none'}`)
      soundClick()
      await loadPositions()
    } catch (err) { toast.error(err.response?.data?.detail || 'Modify failed') }
  }

  const filteredInstruments = searchQuery
    ? instruments.filter(i => i.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || i.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : instruments

  // --- AUTO SQUARE-OFF: Monitor equity/margin and close all if negative ---
  const autoSquareOffRef = useRef(false)

  const calcLiveMetrics = useCallback(() => {
    if (!account || openTrades.length === 0) return { totalPnl: 0, marginUsed: 0, equity: account?.balance || 0, marginAvail: account?.balance || 0, marginLvl: '0.00' }

    const pnl = openTrades.reduce((sum, t) => {
      const lp = livePrices[t.instrument]
      if (!lp) return sum + (t.unrealized_pnl || 0)
      const closeAt = t.direction === 'buy' ? (lp.bid || lp.last) : (lp.ask || lp.last)
      const inst = instruments.find(i => i.symbol === t.instrument)
      const cs = inst?.lot_size || 100000
      return sum + (t.direction === 'buy'
        ? (closeAt - t.open_price) * t.lot_size * cs
        : (t.open_price - closeAt) * t.lot_size * cs)
    }, 0)

    const mu = openTrades.reduce((s, t) => s + (t.margin_used || 0), 0)
    const eq = account.balance + pnl
    const ma = eq - mu
    const ml = mu > 0 ? ((eq / mu) * 100).toFixed(2) : '0.00'

    return { totalPnl: pnl, marginUsed: mu, equity: eq, marginAvail: ma, marginLvl: ml }
  }, [account, openTrades, livePrices, instruments])

  // Watch for margin call / stop out
  useEffect(() => {
    if (!account || openTrades.length === 0 || autoSquareOffRef.current) return

    const { equity, marginUsed, marginAvail } = calcLiveMetrics()

    // STOP OUT: Equity <= 0 OR margin level < 20% OR free margin deeply negative
    const marginLevel = marginUsed > 0 ? (equity / marginUsed) * 100 : 999

    if (equity <= 0 || marginLevel < 20 || marginAvail < -(account.balance * 0.5)) {
      // Prevent re-triggering
      autoSquareOffRef.current = true

      toast.error('⚠ STOP OUT — Equity/Margin critical. Closing all positions!')
      soundStopLoss()

      // Close all positions immediately
      const closeAll = async () => {
        for (const t of openTrades) {
          try {
            await tradesApi.close(t.id, { close_price: getLiveClosePrice(t) })
          } catch {}
        }
        toast.warning('All positions auto-squared off due to insufficient margin')
        await loadPositions()
        await loadInitial()

        // Reset after 5 seconds so it can trigger again if user opens new trades
        setTimeout(() => { autoSquareOffRef.current = false }, 5000)
      }

      closeAll()
    }
  }, [livePrices, openTrades, account])

  if (loading) return <div className="terminal-loading"><div className="auth-loading__spinner" /></div>
  if (!account) return null

  const { totalPnl, marginUsed, equity: liveEquity, marginAvail: marginAvailable, marginLvl: marginLevel } = calcLiveMetrics()

  return (
    <div className={`terminal terminal--mobile-${mobileTab}`} data-mobile-tab={mobileTab}>
      {/* === TOP BAR === */}
      <div className="terminal__topbar">
        <div className="terminal__topbar-left">
          <button className="terminal__back-btn" onClick={() => navigate('/dashboard/accounts')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <span className="terminal__logo">XM<span style={{ color: 'var(--accent)' }}>LIQUIDITY</span></span>
          <span className="terminal__account-badge">{account.account_number} | {account.account_type.toUpperCase()} | 1:{account.leverage}</span>
        </div>
        <div className="terminal__topbar-stats">
          <div className="terminal__stat-box">
            <span className="terminal__stat-label">BALANCE</span>
            <span className="terminal__stat-value">${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="terminal__stat-box">
            <span className="terminal__stat-label">P&L</span>
            <span className={`terminal__stat-value ${totalPnl >= 0 ? 'text-green' : 'text-red'}`}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </span>
          </div>
          <div className="terminal__stat-box">
            <span className="terminal__stat-label">EQUITY</span>
            <span className="terminal__stat-value">${liveEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="terminal__stat-box">
            <span className="terminal__stat-label">MARGIN USED</span>
            <span className="terminal__stat-value">${marginUsed.toFixed(2)}</span>
          </div>
          <div className="terminal__stat-box">
            <span className="terminal__stat-label">AVAILABLE</span>
            <span className="terminal__stat-value">${marginAvailable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="terminal__stat-box">
            <span className="terminal__stat-label">MARGIN LVL</span>
            <span className="terminal__stat-value">{marginLevel}%</span>
          </div>
          {openTrades.length > 0 && (
            <button className="terminal__close-all" onClick={handleCloseAll}>Close All</button>
          )}
        </div>
      </div>

      {/* === MAIN LAYOUT === */}
      <div className="terminal__body">
        {/* LEFT: CHART */}
        <div className="terminal__chart-area">
          {/* Chart header removed — TradingView shows instrument info in its own toolbar */}
          <div className="terminal__chart" ref={chartContainerRef}>
            {selectedInstrument ? (
              <>
                <TradingViewChart
                  symbol={selectedInstrument.symbol}
                  interval="1"
                  openTrades={openTrades.filter(t => t.instrument === selectedInstrument.symbol)}
                  onSymbolChange={(newSymbol) => {
                    const found = instruments.find(i => i.symbol === newSymbol)
                    if (found) setSelectedInstrument(found)
                  }}
                  onCloseTrade={(tradeId) => handleClose(tradeId)}
                  onModifySLTP={(tradeId, field, value) => handleModifySLTP(tradeId, field, String(value))}
                />
                {/* Quick Trade — overlaid inside chart, top-left below instrument */}
                {(() => {
                  const lp = livePrices[selectedInstrument.symbol]
                  const dec = selectedInstrument.symbol.includes('JPY') ? 3 : (selectedInstrument.segment === 'crypto' ? 2 : 5)
                  return (
                    <div className="terminal__quick-overlay">
                      <button className="terminal__quick-sell" onClick={() => {
                        if (!lp) return; setDirection('sell')
                        setTimeout(() => document.querySelector('.terminal__order-form button[type=submit]')?.click(), 50)
                      }}>
                        <span className="terminal__quick-label">SELL</span>
                        <span className="terminal__quick-price">{lp?.bid?.toFixed(dec) || '-'}</span>
                      </button>
                      <div className="terminal__quick-lot">
                        <button className="terminal__quick-lot-btn" onClick={() => setLotSize(p => Math.max(0.01, +(parseFloat(p)-0.01).toFixed(2)))}>−</button>
                        <input className="terminal__quick-lot-input" value={lotSize}
                          onChange={(e) => setLotSize(e.target.value)}
                          onBlur={(e) => { const n = parseFloat(e.target.value); setLotSize(isNaN(n)||n<0.01 ? 0.01 : +n.toFixed(2)) }}
                        />
                        <button className="terminal__quick-lot-btn" onClick={() => setLotSize(p => +(parseFloat(p)+0.01).toFixed(2))}>+</button>
                      </div>
                      <button className="terminal__quick-buy" onClick={() => {
                        if (!lp) return; setDirection('buy')
                        setTimeout(() => document.querySelector('.terminal__order-form button[type=submit]')?.click(), 50)
                      }}>
                        <span className="terminal__quick-label">BUY</span>
                        <span className="terminal__quick-price">{lp?.ask?.toFixed(dec) || '-'}</span>
                      </button>
                      {lp && <span className="terminal__quick-spread">{lp.spread?.toFixed(1)}</span>}
                    </div>
                  )
                })()}
              </>
            ) : (
              <div className="terminal__chart-placeholder">
                <p>Select an instrument from the watchlist</p>
              </div>
            )}
          </div>

          {/* === RESIZE HANDLE === */}
          <div
            className={`terminal__resize-handle ${isDraggingRef.current ? 'terminal__resize-handle--active' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              isDraggingRef.current = true
              dragStartY.current = e.clientY
              dragStartHeight.current = positionsHeight

              // Add full-screen overlay so cursor never escapes
              const overlay = document.createElement('div')
              overlay.id = 'resize-overlay'
              overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;cursor:ns-resize;'
              document.body.appendChild(overlay)

              const onMove = (ev) => {
                ev.preventDefault()
                const delta = dragStartY.current - ev.clientY
                const newHeight = Math.max(80, Math.min(window.innerHeight * 0.7, dragStartHeight.current + delta))
                setPositionsHeight(newHeight)
              }

              const onUp = () => {
                isDraggingRef.current = false
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
                const el = document.getElementById('resize-overlay')
                if (el) el.remove()
              }

              document.addEventListener('mousemove', onMove)
              document.addEventListener('mouseup', onUp)
            }}
          />

          {/* === BOTTOM: POSITIONS === */}
          <div className="terminal__positions" style={{ height: positionsHeight }}>
            <div className="terminal__pos-tabs">
              <button className={`terminal__pos-tab ${positionTab === 'positions' ? 'terminal__pos-tab--active' : ''}`}
                onClick={() => setPositionTab('positions')}>Positions <span className="terminal__pos-count">{openTrades.length}</span></button>
              <button className={`terminal__pos-tab ${positionTab === 'pending' ? 'terminal__pos-tab--active' : ''}`}
                onClick={() => setPositionTab('pending')}>Pending <span className="terminal__pos-count">{pendingOrders.length}</span></button>
              <button className={`terminal__pos-tab ${positionTab === 'closed' ? 'terminal__pos-tab--active' : ''}`}
                onClick={() => setPositionTab('closed')}>Closed Positions</button>
            </div>

            <div className="terminal__pos-table-wrap">
              <table className="terminal__pos-table">
                <thead>
                  <tr>
                    <th>Instrument</th><th>Side</th><th>Size</th>
                    <th>Entry / Market</th><th>Stop Loss</th><th>Take Profit</th>
                    <th>Margin</th>{positionTab !== 'pending' && <th>P&L</th>}
                    <th>Swap</th><th>Fee</th>
                    {positionTab === 'positions' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(positionTab === 'positions' ? openTrades : positionTab === 'pending' ? pendingOrders : closedTrades).map((t) => {
                    const lp = livePrices[t.instrument]
                    const currentPrice = lp?.last || t.current_price || t.open_price
                    const livePnl = positionTab === 'positions' ? getLivePnl(t) : (t.pnl || 0)

                    return (
                      <tr key={t.id}>
                        <td data-label="Instrument"><strong>{t.instrument}</strong></td>
                        <td data-label="Side"><span className={`terminal__side terminal__side--${t.direction}`}>{t.direction.toUpperCase()}</span></td>
                        <td data-label="Size">{t.lot_size}</td>
                        <td data-label="Entry / Market">
                          {t.open_price}
                          <span style={{ color: 'var(--text-secondary)', marginLeft: 4 }}>/ {positionTab === 'closed' ? (t.close_price || '-') : currentPrice}</span>
                        </td>

                        {/* Editable SL */}
                        <td data-label="Stop Loss">
                          {positionTab === 'positions' ? (
                            <input
                              className={`terminal__editable ${!t.stop_loss ? 'terminal__editable--empty' : ''}`}
                              defaultValue={t.stop_loss || ''}
                              placeholder="SL"
                              onBlur={(e) => {
                                if (e.target.value !== String(t.stop_loss || '')) {
                                  handleModifySLTP(t.id, 'stop_loss', e.target.value)
                                }
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                            />
                          ) : (t.stop_loss || '-')}
                        </td>

                        {/* Editable TP */}
                        <td data-label="Take Profit">
                          {positionTab === 'positions' ? (
                            <input
                              className={`terminal__editable ${!t.take_profit ? 'terminal__editable--empty' : ''}`}
                              defaultValue={t.take_profit || ''}
                              placeholder="TP"
                              onBlur={(e) => {
                                if (e.target.value !== String(t.take_profit || '')) {
                                  handleModifySLTP(t.id, 'take_profit', e.target.value)
                                }
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                            />
                          ) : (t.take_profit || '-')}
                        </td>

                        <td data-label="Margin">${t.margin_used?.toFixed(2) || '0.00'}</td>
                        {positionTab !== 'pending' && (
                          <td data-label="P&L" className={livePnl >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: 700 }}>
                            {livePnl >= 0 ? '+' : ''}${livePnl.toFixed(2)}
                          </td>
                        )}
                        <td data-label="Swap">${t.swap_charged?.toFixed(2) || '0.00'}</td>
                        <td data-label="Fee">${((t.spread_charged || 0) + (t.commission_charged || 0)).toFixed(2)}</td>

                        {/* Close Actions with Menu */}
                        {positionTab === 'positions' && (
                          <td data-label="Actions">
                            <div className="terminal__close-menu-wrap">
                              {/* X button — close this trade */}
                              <button className="terminal__close-btn" onClick={() => handleClose(t.id)} title="Close trade">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>

                              {/* 3-line menu button */}
                              <button className="terminal__close-btn" onClick={() => setCloseMenuTradeId(closeMenuTradeId === t.id ? null : t.id)} title="More options">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
                                </svg>
                              </button>

                              {/* Close menu and partial close are rendered as centered popups outside the table */}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {(positionTab === 'positions' ? openTrades : positionTab === 'pending' ? pendingOrders : closedTrades).length === 0 && (
                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.08)' }}>
                      <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>
                        XM<span style={{ color: 'var(--accent)' }}>LIQUIDITY</span>
                      </span>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT: WATCHLIST + ORDER PANEL */}
        <div className="terminal__right-panel">
          {/* Watchlist / Instrument Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '40vh', minHeight: 80, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="terminal__watchlist-header">
              <input
                className="terminal__search"
                placeholder="Search instruments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select className="terminal__segment-select" value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}>
                <option value="">All</option>
                {segments.map((s) => (
                  <option key={s.segment} value={s.segment}>{s.segment.charAt(0).toUpperCase() + s.segment.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="terminal__wl-header" style={{ flexShrink: 0 }}>
              <span>Instruments</span><span>Bid</span><span>Ask</span><span>Spread</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
                {filteredInstruments.map((i) => (
                  <div
                    key={i.symbol}
                    className={`terminal__wl-row ${selectedInstrument?.symbol === i.symbol ? 'terminal__wl-row--active' : ''}`}
                    onClick={() => {
                      setSelectedInstrument(i)
                      const p = livePrices[i.symbol]
                      setPrice(p?.last?.toString() || '')
                      if (window.innerWidth <= 768) {
                        setMobileTab('chart')
                        setMobileOrderSheet(true)
                      }
                    }}
                  >
                    <span className="terminal__wl-symbol">{i.symbol}</span>
                    <span className="terminal__wl-bid" style={{ color: livePrices[i.symbol] ? '#ff5050' : 'var(--text-secondary)' }}>
                      {livePrices[i.symbol]?.bid ? fmtPrice(livePrices[i.symbol].bid, i) : '-'}
                    </span>
                    <span className="terminal__wl-ask" style={{ color: livePrices[i.symbol] ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {livePrices[i.symbol]?.ask ? fmtPrice(livePrices[i.symbol].ask, i) : '-'}
                    </span>
                    <span className="terminal__wl-spread">
                      {livePrices[i.symbol]?.spread?.toFixed(1) || '-'}
                    </span>
                  </div>
                ))}
              </div>
          </div>

          {/* Order Panel */}
          <div className="terminal__order-panel">
            {/* Errors/messages now show as toast notifications */}

            <div className="terminal__order-tabs">
              <button className={`terminal__order-tab ${orderTab === 'market' ? 'terminal__order-tab--active' : ''}`}
                onClick={() => setOrderTab('market')}>Market</button>
              <button className={`terminal__order-tab ${orderTab === 'pending' ? 'terminal__order-tab--active' : ''}`}
                onClick={() => setOrderTab('pending')}>Pending</button>
            </div>

            {/* Sell / Buy buttons */}
            <div className="terminal__direction-row">
              <button
                className={`terminal__dir-btn terminal__dir-btn--sell ${direction === 'sell' ? 'terminal__dir-btn--active-sell' : ''}`}
                onClick={() => setDirection('sell')}
              >
                <span className="terminal__dir-label">Sell</span>
                <span className="terminal__dir-price">
                  {selectedInstrument && livePrices[selectedInstrument.symbol]
                    ? livePrices[selectedInstrument.symbol].bid.toFixed(selectedInstrument.symbol.includes('JPY') ? 3 : 5)
                    : '-'}
                </span>
              </button>
              <button
                className={`terminal__dir-btn terminal__dir-btn--buy ${direction === 'buy' ? 'terminal__dir-btn--active-buy' : ''}`}
                onClick={() => setDirection('buy')}
              >
                <span className="terminal__dir-label">Buy</span>
                <span className="terminal__dir-price">
                  {selectedInstrument && livePrices[selectedInstrument.symbol]
                    ? livePrices[selectedInstrument.symbol].ask.toFixed(selectedInstrument.symbol.includes('JPY') ? 3 : 5)
                    : '-'}
                </span>
              </button>
            </div>

            <form onSubmit={handlePlaceOrder} className="terminal__order-form">
              <div className="terminal__order-fields">
                <div className="terminal__field">
                  <label>Trail</label>
                  <input type="number" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="Stop Loss" step="0.00001" />
                </div>
                <div className="terminal__field">
                  <label>Take Profit</label>
                  <input type="number" value={tp} onChange={(e) => setTp(e.target.value)} placeholder="Take Profit" step="0.00001" />
                </div>
              </div>

              <div className="terminal__field">
                <label>{orderTab === 'market' ? 'Market Price' : 'Limit Price'}</label>
                <input type="number" value={price} onChange={(e) => { if (orderTab === 'pending') setPrice(e.target.value) }} placeholder={orderTab === 'market' ? 'Live' : 'Enter price'} step="0.00001" required readOnly={orderTab === 'market'} style={orderTab === 'market' ? { opacity: 0.7, cursor: 'default' } : {}} />
              </div>

              <div className="terminal__lot-row">
                <button type="button" className="terminal__lot-btn" onClick={() => setLotSize(prev => {
                  const v = parseFloat(prev) || 0.01
                  return Math.max(0.01, +(v - 0.01).toFixed(2))
                })}>-</button>
                <input
                  type="text"
                  className="terminal__lot-input"
                  value={lotSize}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || val === '0' || val === '0.') {
                      setLotSize(val)
                    } else {
                      const num = parseFloat(val)
                      if (!isNaN(num)) setLotSize(val)
                    }
                  }}
                  onBlur={(e) => {
                    const num = parseFloat(e.target.value)
                    if (isNaN(num) || num < 0.01) setLotSize(0.01)
                    else setLotSize(+(num).toFixed(2))
                  }}
                />
                <button type="button" className="terminal__lot-btn" onClick={() => setLotSize(prev => {
                  const v = parseFloat(prev) || 0
                  return +(v + 0.01).toFixed(2)
                })}>+</button>
                <span className="terminal__lot-label">lots</span>
              </div>

              <button
                type="submit"
                className={`terminal__submit-btn ${direction === 'sell' ? 'terminal__submit-btn--sell' : 'terminal__submit-btn--buy'}`}
                disabled={placing}
              >
                {placing ? 'PLACING...' : `${direction.toUpperCase()} ${lotSize} @ ${price || '...'}`}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* === CLOSE MENU — Compact Card Popup === */}
      {closeMenuTradeId && (() => {
        const trade = openTrades.find(t => t.id === closeMenuTradeId)
        if (!trade) return null
        const pnl = getLivePnl(trade)
        const isBuy = trade.direction === 'buy'
        return (
          <>
            <div className="terminal__close-overlay" onClick={() => setCloseMenuTradeId(null)} />
            <div className="terminal__close-menu">
              <div className="terminal__popup-header">
                <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 13, flexShrink: 0, letterSpacing: '-0.02em' }}>XM<span style={{ color: 'var(--accent)' }}>LIQUIDITY</span></span>
                <div className="terminal__popup-trade-info">
                  <div className="terminal__popup-details">
                    <span style={{ color: isBuy ? 'var(--accent)' : '#ff5050' }}>{trade.direction.toUpperCase()}</span>
                    {' '}{trade.lot_size} lot @ {trade.open_price}
                  </div>
                </div>
                <div className="terminal__popup-pnl">
                  <div className={`terminal__popup-pnl-value ${pnl >= 0 ? 'text-green' : 'text-red'}`}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                  </div>
                  <div className="terminal__popup-pnl-label">P&L</div>
                </div>
              </div>
              <div className="terminal__popup-actions">
                <button className="terminal__popup-action terminal__popup-action--close" onClick={() => handleClose(closeMenuTradeId)}>
                  <div className="terminal__popup-action-icon">✕</div>
                  <span className="terminal__popup-action-label">Close Position</span>
                </button>
                <button className="terminal__popup-action terminal__popup-action--closeall" onClick={() => { handleCloseAll(); setCloseMenuTradeId(null) }}>
                  <div className="terminal__popup-action-icon">⊗</div>
                  <span className="terminal__popup-action-label">Close All ({openTrades.length})</span>
                </button>
                <button className="terminal__popup-action terminal__popup-action--profit" onClick={() => { handleCloseProfit(); setCloseMenuTradeId(null) }}>
                  <div className="terminal__popup-action-icon">+</div>
                  <span className="terminal__popup-action-label">Close Profit ({openTrades.filter(t => getLivePnl(t) > 0).length})</span>
                </button>
                <button className="terminal__popup-action terminal__popup-action--loss" onClick={() => { handleCloseLoss(); setCloseMenuTradeId(null) }}>
                  <div className="terminal__popup-action-icon">−</div>
                  <span className="terminal__popup-action-label">Close Loss ({openTrades.filter(t => getLivePnl(t) < 0).length})</span>
                </button>
                <button className="terminal__popup-action terminal__popup-action--partial" onClick={() => { setPartialCloseId(closeMenuTradeId); setCloseMenuTradeId(null) }}>
                  <div className="terminal__popup-action-icon">½</div>
                  <span className="terminal__popup-action-label">Partial Close</span>
                </button>
                <button className="terminal__popup-action terminal__popup-action--cancel" onClick={() => setCloseMenuTradeId(null)}>
                  <div className="terminal__popup-action-icon">←</div>
                  <span className="terminal__popup-action-label">Cancel</span>
                </button>
              </div>
            </div>
          </>
        )
      })()}

      {/* === PARTIAL CLOSE — Professional Popup === */}
      {partialCloseId && (() => {
        const trade = openTrades.find(t => t.id === partialCloseId)
        if (!trade) return null
        return (
          <>
            <div className="terminal__close-overlay" onClick={() => { setPartialCloseId(null); setPartialLots('') }} />
            <div className="terminal__partial-popup">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 13, letterSpacing: '-0.02em' }}>XM<span style={{ color: 'var(--accent)' }}>LIQUIDITY</span></span>
                <div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 15 }}>{trade.instrument}</div>
                  <div style={{ fontFamily: 'Geist Mono', fontSize: 10, color: 'var(--text-secondary)' }}>
                    {trade.direction.toUpperCase()} {trade.lot_size} lot @ {trade.open_price}
                  </div>
                </div>
              </div>

              <div className="terminal__partial-popup__title">PARTIAL CLOSE</div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, padding: '12px 16px', fontFamily: 'Geist Mono', fontSize: 16,
                    fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', outline: 'none',
                  }}
                  placeholder="0.00"
                  value={partialLots}
                  onChange={(e) => setPartialLots(e.target.value)}
                  autoFocus
                />
                <span style={{ fontFamily: 'Geist Mono', fontSize: 11, color: 'var(--text-secondary)' }}>lots</span>
              </div>

              <div className="terminal__partial-popup__info">
                Maximum: {trade.lot_size} lots | Must be less than total position
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => handlePartialClose(partialCloseId)}
                  style={{
                    flex: 1, padding: '12px', border: 'none', borderRadius: 10,
                    background: '#6496ff', color: '#fff', fontFamily: 'Geist Mono',
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer',
                  }}
                >CLOSE {partialLots || '...'} LOTS</button>
                <button
                  onClick={() => { setPartialCloseId(null); setPartialLots('') }}
                  style={{
                    padding: '12px 20px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                    background: 'none', color: 'var(--text-secondary)', fontFamily: 'Geist Mono',
                    fontSize: 12, cursor: 'pointer',
                  }}
                >CANCEL</button>
              </div>
            </div>
          </>
        )
      })()}

      {/* === MOBILE ORDER SHEET (MT5-style slide-up from chart) === */}
      {mobileOrderSheet && selectedInstrument && (() => {
        const lp = livePrices[selectedInstrument.symbol]
        const dec = selectedInstrument.symbol.includes('JPY') ? 3 : (selectedInstrument.segment === 'crypto' ? 2 : 5)
        return (
          <div className="terminal__msheet-wrap">
            <div className="terminal__msheet-backdrop" onClick={() => setMobileOrderSheet(false)} />
            <div className="terminal__msheet">
              <div className="terminal__msheet-handle" onClick={() => setMobileOrderSheet(false)} />
              <div className="terminal__msheet-header">
                <div className="terminal__msheet-sym">{selectedInstrument.symbol}</div>
                <div className="terminal__msheet-spread">Spread {lp?.spread?.toFixed(1) || '-'}</div>
                <button className="terminal__msheet-close" onClick={() => setMobileOrderSheet(false)} aria-label="Close">×</button>
              </div>

              {/* BUY / SELL big buttons with price */}
              <div className="terminal__msheet-bs">
                <button
                  className={`terminal__msheet-sell ${direction === 'sell' ? 'terminal__msheet-sell--active' : ''}`}
                  onClick={() => setDirection('sell')}
                >
                  <span className="terminal__msheet-bs-label">SELL</span>
                  <span className="terminal__msheet-bs-price">{lp?.bid?.toFixed(dec) || '-'}</span>
                </button>
                <button
                  className={`terminal__msheet-buy ${direction === 'buy' ? 'terminal__msheet-buy--active' : ''}`}
                  onClick={() => setDirection('buy')}
                >
                  <span className="terminal__msheet-bs-label">BUY</span>
                  <span className="terminal__msheet-bs-price">{lp?.ask?.toFixed(dec) || '-'}</span>
                </button>
              </div>

              {/* Lot size stepper */}
              <div className="terminal__msheet-row">
                <label>Volume (lots)</label>
                <div className="terminal__lot-row" style={{ marginTop: 4 }}>
                  <button type="button" className="terminal__lot-btn" onClick={() => setLotSize(p => Math.max(0.01, +(parseFloat(p)-0.01).toFixed(2)))}>−</button>
                  <input className="terminal__lot-input" value={lotSize}
                    onChange={(e) => setLotSize(e.target.value)}
                    onBlur={(e) => { const n = parseFloat(e.target.value); setLotSize(isNaN(n)||n<0.01 ? 0.01 : +n.toFixed(2)) }}
                  />
                  <button type="button" className="terminal__lot-btn" onClick={() => setLotSize(p => +(parseFloat(p)+0.01).toFixed(2))}>+</button>
                </div>
              </div>

              {/* SL / TP */}
              <div className="terminal__msheet-sltp">
                <div className="terminal__msheet-row">
                  <label>Stop Loss</label>
                  <input type="number" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="—" step="0.00001" />
                </div>
                <div className="terminal__msheet-row">
                  <label>Take Profit</label>
                  <input type="number" value={tp} onChange={(e) => setTp(e.target.value)} placeholder="—" step="0.00001" />
                </div>
              </div>

              {/* Submit */}
              <button
                type="button"
                className={`terminal__msheet-submit ${direction === 'sell' ? 'terminal__msheet-submit--sell' : 'terminal__msheet-submit--buy'}`}
                disabled={placing}
                onClick={(e) => { handlePlaceOrder(e); setMobileOrderSheet(false) }}
              >
                {placing ? 'PLACING…' : `${direction.toUpperCase()} ${lotSize} @ ${price || '…'}`}
              </button>
            </div>
          </div>
        )
      })()}

      {/* === MOBILE BOTTOM TAB BAR === */}
      <nav className="terminal__mtabs" role="tablist" aria-label="Trading sections">
        {[
          { key: 'market', label: 'Market', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          ) },
          { key: 'chart', label: 'Chart', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          ) },
          { key: 'positions', label: 'Positions', badge: openTrades.length, icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          ) },
          { key: 'history', label: 'History', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ) },
        ].map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={mobileTab === t.key}
            className={`terminal__mtab ${mobileTab === t.key ? 'terminal__mtab--active' : ''}`}
            onClick={() => {
              setMobileTab(t.key)
              if (t.key === 'positions') setPositionTab('positions')
              if (t.key === 'history') setPositionTab('closed')
              if (t.key !== 'chart') setMobileOrderSheet(false)
            }}
          >
            <span className="terminal__mtab-icon">{t.icon}</span>
            <span className="terminal__mtab-label">{t.label}</span>
            {t.badge ? <span className="terminal__mtab-badge">{t.badge}</span> : null}
          </button>
        ))}
      </nav>
    </div>
  )
}
