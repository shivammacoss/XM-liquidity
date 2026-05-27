/**
 * XMLiquidity — TradingView Advanced Chart
 * - Default 1-minute timeframe
 * - ~1000 historical bars
 * - Entry/SL/TP lines (ASYNC API — returns Promises)
 * - Real-time candles via InfoWay
 * - Position/SL/TP lines on chart
 * - Draggable SL/TP
 * - Close button on entry line
 * - Default 1-minute timeframe
 */

import { useEffect, useRef, memo, useCallback } from 'react'
import { createInfowayDatafeed } from '../services/infowayDatafeed'

function TradingViewChart({
  symbol = 'EURUSD',
  interval = '1',
  onSymbolChange,
  openTrades = [],
  onCloseTrade,
  onModifySLTP,
}) {
  const containerRef = useRef(null)
  const widgetRef = useRef(null)
  const chartReadyRef = useRef(false)
  const linesRef = useRef({})

  const drawTradeLines = useCallback(async () => {
    if (!widgetRef.current || !chartReadyRef.current) return

    let chart
    try { chart = widgetRef.current.activeChart() } catch { return }
    if (!chart) return

    const chartSymbol = (chart.symbol() || '').toUpperCase().replace('/', '')

    // Remove old lines for trades that no longer exist or symbol changed
    Object.keys(linesRef.current).forEach(tradeId => {
      const trade = openTrades.find(t => t.id === tradeId)
      if (!trade || trade.instrument?.toUpperCase() !== chartSymbol) {
        const l = linesRef.current[tradeId]
        try { l.entry?.remove() } catch {}
        try { l.sl?.remove() } catch {}
        try { l.tp?.remove() } catch {}
        delete linesRef.current[tradeId]
      }
    })

    // Draw lines for trades matching current chart symbol
    for (const trade of openTrades) {
      if ((trade.instrument || '').toUpperCase() !== chartSymbol) continue
      if (linesRef.current[trade.id]) {
        await updateExistingLines(chart, trade)
      } else {
        await createTradeLines(chart, trade)
      }
    }
  }, [openTrades, onCloseTrade, onModifySLTP])

  const createTradeLines = async (chart, trade) => {
    const isBuy = trade.direction === 'buy'
    const entryColor = isBuy ? '#BFFF00' : '#ff5050'
    const lines = { entry: null, sl: null, tp: null }

    try {
      // Try createPositionLine first (Trading feature)
      if (typeof chart.createPositionLine === 'function') {
        const pos = await chart.createPositionLine()
        pos.setPrice(trade.open_price)
          .setQuantity(String(trade.lot_size))
          .setText(`${isBuy ? 'BUY' : 'SELL'} ${trade.lot_size}`)
          .setLineStyle(0)
          .setLineLength(25)
          .setLineColor(entryColor)
          .setBodyBackgroundColor(isBuy ? 'rgba(191,255,0,0.1)' : 'rgba(255,50,50,0.1)')
          .setBodyBorderColor(entryColor)
          .setBodyTextColor(entryColor)
          .setQuantityBackgroundColor(entryColor)
          .setQuantityBorderColor(entryColor)
          .setQuantityTextColor(isBuy ? '#000' : '#fff')
          .setCloseButtonBackgroundColor('#ff5050')
          .setCloseButtonBorderColor('#ff5050')
          .setCloseButtonIconColor('#fff')

        try {
          pos.setReverseButtonBackgroundColor('transparent')
          pos.setReverseButtonBorderColor('transparent')
          pos.setReverseButtonIconColor('transparent')
        } catch {}

        pos.onClose(() => { if (onCloseTrade) onCloseTrade(trade.id) })
        lines.entry = pos
      }
    } catch (err) {
      console.warn('[Chart] createPositionLine not available:', err.message)
    }

    // SL line
    if (trade.stop_loss) {
      try {
        if (typeof chart.createOrderLine === 'function') {
          const sl = await chart.createOrderLine()
          sl.setPrice(trade.stop_loss)
            .setText('SL')
            .setQuantity('')
            .setLineStyle(2)
            .setLineLength(15)
            .setLineColor('#ff5050')
            .setBodyBackgroundColor('rgba(255,50,50,0.15)')
            .setBodyBorderColor('#ff5050')
            .setBodyTextColor('#ff5050')
            .setQuantityBackgroundColor('transparent')
            .setQuantityBorderColor('transparent')

          try { sl.setEditable(true) } catch {}

          sl.onMove(() => {
            if (onModifySLTP) onModifySLTP(trade.id, 'stop_loss', sl.getPrice())
          })
          lines.sl = sl
        }
      } catch (err) {
        console.warn('[Chart] SL line error:', err.message)
      }
    }

    // TP line
    if (trade.take_profit) {
      try {
        if (typeof chart.createOrderLine === 'function') {
          const tp = await chart.createOrderLine()
          tp.setPrice(trade.take_profit)
            .setText('TP')
            .setQuantity('')
            .setLineStyle(2)
            .setLineLength(15)
            .setLineColor('#BFFF00')
            .setBodyBackgroundColor('rgba(191,255,0,0.15)')
            .setBodyBorderColor('#BFFF00')
            .setBodyTextColor('#BFFF00')
            .setQuantityBackgroundColor('transparent')
            .setQuantityBorderColor('transparent')

          try { tp.setEditable(true) } catch {}

          tp.onMove(() => {
            if (onModifySLTP) onModifySLTP(trade.id, 'take_profit', tp.getPrice())
          })
          lines.tp = tp
        }
      } catch (err) {
        console.warn('[Chart] TP line error:', err.message)
      }
    }

    linesRef.current[trade.id] = lines
  }

  const updateExistingLines = async (chart, trade) => {
    const existing = linesRef.current[trade.id]
    if (!existing) return

    // Update SL
    if (trade.stop_loss && existing.sl) {
      try { if (Math.abs(existing.sl.getPrice() - trade.stop_loss) > 0.00001) existing.sl.setPrice(trade.stop_loss) } catch {}
    } else if (trade.stop_loss && !existing.sl) {
      // SL added
      try {
        if (typeof chart.createOrderLine === 'function') {
          const sl = await chart.createOrderLine()
            .setPrice(trade.stop_loss).setText('SL').setQuantity('')
            .setLineStyle(2).setLineLength(15).setLineColor('#ff5050')
            .setBodyBackgroundColor('rgba(255,50,50,0.15)').setBodyBorderColor('#ff5050').setBodyTextColor('#ff5050')
            .setQuantityBackgroundColor('transparent').setQuantityBorderColor('transparent')
          try { sl.setEditable(true) } catch {}
          sl.onMove(() => { if (onModifySLTP) onModifySLTP(trade.id, 'stop_loss', sl.getPrice()) })
          existing.sl = sl
        }
      } catch {}
    } else if (!trade.stop_loss && existing.sl) {
      try { existing.sl.remove() } catch {}
      existing.sl = null
    }

    // Update TP
    if (trade.take_profit && existing.tp) {
      try { if (Math.abs(existing.tp.getPrice() - trade.take_profit) > 0.00001) existing.tp.setPrice(trade.take_profit) } catch {}
    } else if (trade.take_profit && !existing.tp) {
      try {
        if (typeof chart.createOrderLine === 'function') {
          const tp = await chart.createOrderLine()
            .setPrice(trade.take_profit).setText('TP').setQuantity('')
            .setLineStyle(2).setLineLength(15).setLineColor('#BFFF00')
            .setBodyBackgroundColor('rgba(191,255,0,0.15)').setBodyBorderColor('#BFFF00').setBodyTextColor('#BFFF00')
            .setQuantityBackgroundColor('transparent').setQuantityBorderColor('transparent')
          try { tp.setEditable(true) } catch {}
          tp.onMove(() => { if (onModifySLTP) onModifySLTP(trade.id, 'take_profit', tp.getPrice()) })
          existing.tp = tp
        }
      } catch {}
    } else if (!trade.take_profit && existing.tp) {
      try { existing.tp.remove() } catch {}
      existing.tp = null
    }
  }

  // Initialize widget
  useEffect(() => {
    if (!containerRef.current) return

    if (widgetRef.current) {
      try { widgetRef.current.remove() } catch {}
      widgetRef.current = null
      chartReadyRef.current = false
      linesRef.current = {}
    }

    const datafeed = createInfowayDatafeed()

    const initWidget = () => {
      console.log('[TV] initWidget, TradingView available:', !!window.TradingView)
      if (!window.TradingView) {
        const script = document.createElement('script')
        script.src = '/charting_library/charting_library.standalone.js'
        script.onload = () => { console.log('[TV] Script loaded'); buildWidget() }
        script.onerror = (e) => console.error('[TV] Script load error:', e)
        document.head.appendChild(script)
      } else {
        buildWidget()
      }
    }

    const buildWidget = () => {
      if (!containerRef.current || !window.TradingView) {
        console.error('[TV] Cannot build: container=', !!containerRef.current, 'TV=', !!window.TradingView)
        return
      }
      console.log('[TV] Building widget for symbol:', symbol)

      try {
        const widget = new window.TradingView.widget({
          container: containerRef.current,
          datafeed,
          symbol,
          interval: '1',  // DEFAULT 1 MINUTE
          library_path: '/charting_library/',
          locale: 'en',
          fullscreen: false,
          autosize: true,
          theme: 'dark',

          overrides: {
            'paneProperties.background': '#0a0a0a',
            'paneProperties.backgroundType': 'solid',
            'paneProperties.vertGridProperties.color': 'rgba(255, 255, 255, 0.03)',
            'paneProperties.horzGridProperties.color': 'rgba(255, 255, 255, 0.03)',
            'scalesProperties.backgroundColor': '#0a0a0a',
            'scalesProperties.lineColor': 'rgba(255, 255, 255, 0.06)',
            'scalesProperties.textColor': 'rgba(255, 255, 255, 0.4)',
            'mainSeriesProperties.candleStyle.upColor': '#BFFF00',
            'mainSeriesProperties.candleStyle.downColor': '#ff5050',
            'mainSeriesProperties.candleStyle.borderUpColor': '#BFFF00',
            'mainSeriesProperties.candleStyle.borderDownColor': '#ff5050',
            'mainSeriesProperties.candleStyle.wickUpColor': '#BFFF00',
            'mainSeriesProperties.candleStyle.wickDownColor': '#ff5050',
          },

          disabled_features: [
            'header_symbol_search',
            'symbol_search_hot_key',
            'header_compare',
            'display_market_status',
            'go_to_date',
            'timezone_menu',
          ],
          enabled_features: [
            'study_templates',
            'side_toolbar_in_fullscreen_mode',
            'trading_notifications',
            'show_trading_notifications_history',
          ],

          studies_overrides: {
            'volume.volume.color.0': '#ff5050',
            'volume.volume.color.1': '#BFFF00',
            'volume.volume.transparency': 70,
          },

          loading_screen: { backgroundColor: '#0a0a0a', foregroundColor: '#BFFF00' },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })

        widgetRef.current = widget

        widget.onChartReady(() => {
          console.log('[TV] Chart READY for', symbol)
          chartReadyRef.current = true

          widget.activeChart().onSymbolChanged().subscribe(null, () => {
            const newSymbol = widget.activeChart().symbol()
            if (onSymbolChange) onSymbolChange(newSymbol)
            // Clear lines on symbol change
            Object.values(linesRef.current).forEach(l => {
              try { l.entry?.remove() } catch {}
              try { l.sl?.remove() } catch {}
              try { l.tp?.remove() } catch {}
            })
            linesRef.current = {}
          })

          // Draw trade lines after chart is ready
          setTimeout(() => drawTradeLines(), 500)
        })
      } catch (err) {
        console.error('[TradingView] Widget init error:', err)
      }
    }

    initWidget()

    return () => {
      chartReadyRef.current = false
      linesRef.current = {}
      if (widgetRef.current) {
        try { widgetRef.current.remove() } catch {}
        widgetRef.current = null
      }
    }
  }, [symbol])

  // Redraw lines when trades change
  useEffect(() => {
    if (chartReadyRef.current) drawTradeLines()
  }, [openTrades, drawTradeLines])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
  )
}

export default memo(TradingViewChart)
