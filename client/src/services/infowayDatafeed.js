/**
 * XMLiquidity — InfoWay Datafeed for TradingView Advanced Charts
 *
 * All REST calls go through OUR BACKEND PROXY to avoid CORS:
 *   Frontend → http://localhost:8000/api/v1/market/... → InfoWay
 *
 * WebSocket connects directly to InfoWay (WS doesn't have CORS issues).
 *
 * klineType: 1=1min, 2=5min, 3=15min, 4=30min, 5=1h, 6=2h, 7=4h, 8=1day, 9=1week, 10=1month
 */

// REST goes through our backend proxy (no CORS issues)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// WebSocket goes direct to InfoWay (WS is not subject to CORS)
const API_KEY = import.meta.env.VITE_INFOWAY_API_KEY || '2e3ee94f2bf749769a73000cd8302f19-infoway';

const resolutionToKlineType = {
  '1': 1, '5': 2, '15': 3, '30': 4, '60': 5,
  '120': 6, '240': 7,
  'D': 8, '1D': 8, 'W': 9, '1W': 9, 'M': 10, '1M': 10,
};

const CRYPTO_SET = new Set([
  'BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'SOLUSDT', 'BNBUSDT',
  'ADAUSDT', 'DOGEUSDT', 'LTCUSDT', 'BTCUSD', 'ETHUSD',
  'XRPUSD', 'SOLUSD', 'BNBUSD', 'ADAUSD', 'DOGEUSD', 'LTCUSD',
]);

function isCrypto(symbol) {
  return CRYPTO_SET.has(symbol.toUpperCase());
}

function toInfowaySymbol(symbol) {
  const s = symbol.toUpperCase().replace('/', '');
  if (isCrypto(s) && !s.endsWith('USDT')) return s.replace('USD', 'USDT');
  return s;
}

// ---- REST via backend proxy ----

async function fetchKlines(symbol, klineType, count = 500) {
  const infSym = toInfowaySymbol(symbol);
  const num = Math.min(count, 500); // InfoWay max is 500

  console.log(`[Datafeed] fetchKlines: ${infSym} type=${klineType} num=${num}`);

  try {
    const res = await fetch(`${API_BASE}/market/kline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ klineType, klineNum: num, codes: infSym }),
    });

    if (!res.ok) {
      console.error(`[Datafeed] kline HTTP error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    console.log(`[Datafeed] kline response: ret=${data.ret} hasData=${!!data.data}`);

    if (data.ret === 200 && data.data) {
      const item = Array.isArray(data.data) ? data.data[0] : data.data;
      if (item && item.respList && item.respList.length > 0) {
        const bars = item.respList.map(bar => ({
          time: parseInt(bar.t) * 1000,
          open: parseFloat(bar.o),
          high: parseFloat(bar.h),
          low: parseFloat(bar.l),
          close: parseFloat(bar.c),
          volume: parseFloat(bar.v || 0),
        })).sort((a, b) => a.time - b.time);

        console.log(`[Datafeed] Parsed ${bars.length} bars`);
        return bars;
      }
    }

    console.warn('[Datafeed] No bars in response:', data.msg || data);
    return [];
  } catch (err) {
    console.error('[Datafeed] fetchKlines error:', err);
    return [];
  }
}

export async function fetchTradePrice(codes) {
  const res = await fetch(`${API_BASE}/market/trades/${codes}`);
  const data = await res.json();
  if (data.ret === 200 && data.data) return data.data;
  return [];
}

export async function fetchLastPrice(symbol) {
  const infSym = toInfowaySymbol(symbol);
  const data = await fetchTradePrice(infSym);
  if (data.length > 0) return parseFloat(data[0].p);
  return null;
}

// ---- WebSocket (direct to InfoWay — no CORS on WS) ----

const subscriptions = new Map();
let wsCommon = null;
let wsCrypto = null;
let heartbeatTimer = null;

function ensureWs(forCrypto) {
  const biz = forCrypto ? 'crypto' : 'common';
  const existing = forCrypto ? wsCrypto : wsCommon;
  if (existing && existing.readyState <= 1) return existing;

  const ws = new WebSocket(`wss://data.infoway.io/ws?business=${biz}&apikey=${API_KEY}`);

  ws.onopen = () => {
    console.log(`[WS] ${biz} connected`);
    subscriptions.forEach(sub => {
      if (isCrypto(toInfowaySymbol(sub.symbol)) === forCrypto) {
        wsSendSub(ws, sub.symbol, sub.klineType);
      }
    });
  };

  // Track last bar per symbol for real-time tick updates
  const lastBars = {};

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);

      // Kline updates (code 10006) — full candle data
      if (msg.code === 10006 && msg.data) {
        const items = Array.isArray(msg.data) ? msg.data : [msg.data];
        items.forEach(item => {
          if (!item.s || !item.respList?.length) return;
          const last = item.respList[item.respList.length - 1];
          const bar = {
            time: parseInt(last.t) * 1000,
            open: parseFloat(last.o),
            high: parseFloat(last.h),
            low: parseFloat(last.l),
            close: parseFloat(last.c),
            volume: parseFloat(last.v || 0),
          };
          lastBars[item.s] = bar;
          subscriptions.forEach(sub => {
            if (toInfowaySymbol(sub.symbol) === item.s) sub.onTick(bar);
          });
        });
      }

      // Trade ticks (code 10000) — every single trade, ultra fast
      // Use these to update the last bar's close/high/low in real-time
      if (msg.code === 10000 && msg.data) {
        const ticks = Array.isArray(msg.data) ? msg.data : [msg.data];
        ticks.forEach(tick => {
          if (!tick.s || !tick.p) return;
          const price = parseFloat(tick.p);
          const sym = tick.s;
          const existing = lastBars[sym];

          if (existing) {
            // Update current candle with tick
            existing.close = price;
            if (price > existing.high) existing.high = price;
            if (price < existing.low) existing.low = price;
            existing.volume += parseFloat(tick.v || 0);

            subscriptions.forEach(sub => {
              if (toInfowaySymbol(sub.symbol) === sym) {
                sub.onTick({ ...existing });
              }
            });
          } else {
            // No existing bar yet — create one from tick
            const now = Math.floor(Date.now() / 60000) * 60000; // Round to minute
            const bar = { time: now, open: price, high: price, low: price, close: price, volume: parseFloat(tick.v || 0) };
            lastBars[sym] = bar;
            subscriptions.forEach(sub => {
              if (toInfowaySymbol(sub.symbol) === sym) sub.onTick(bar);
            });
          }
        });
      }
    } catch { /* */ }
  };

  ws.onclose = () => {
    if (forCrypto) wsCrypto = null; else wsCommon = null;
    setTimeout(() => {
      if ([...subscriptions.values()].some(s => isCrypto(toInfowaySymbol(s.symbol)) === forCrypto)) {
        ensureWs(forCrypto);
      }
    }, 3000);
  };

  ws.onerror = () => {};

  if (forCrypto) wsCrypto = ws; else wsCommon = ws;

  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(() => {
      const hb = JSON.stringify({ code: 10010, trace: String(Date.now()) });
      try { if (wsCommon?.readyState === 1) wsCommon.send(hb); } catch {}
      try { if (wsCrypto?.readyState === 1) wsCrypto.send(hb); } catch {}
    }, 25000);
  }

  return ws;
}

function wsSendSub(ws, symbol, klineType) {
  if (ws.readyState !== 1) return;
  const infSym = toInfowaySymbol(symbol);
  ws.send(JSON.stringify({ code: 10006, trace: String(Date.now()), data: { arr: [{ type: klineType, codes: infSym }] } }));
  ws.send(JSON.stringify({ code: 10000, trace: String(Date.now() + 1), data: { codes: infSym } }));
}

// ==========================================
// TradingView IExternalDatafeed
// ==========================================

export function createInfowayDatafeed() {
  return {
    onReady(cb) {
      console.log('[Datafeed] onReady called');
      setTimeout(() => cb({
        supported_resolutions: ['1', '5', '15', '30', '60', '120', '240', 'D', 'W', 'M'],
        exchanges: [{ value: 'XMLiquidity', name: 'XMLiquidity', desc: '' }],
        symbols_types: [
          { name: 'Forex', value: 'forex' },
          { name: 'Crypto', value: 'crypto' },
          { name: 'Metals', value: 'metals' },
        ],
      }), 0);
    },

    searchSymbols(input, exchange, symbolType, onResult) { onResult([]); },

    resolveSymbol(symbolName, onResolve) {
      const sym = symbolName.toUpperCase().replace('/', '');
      const isC = isCrypto(sym);
      const isJPY = sym.includes('JPY');
      const isXAU = sym.includes('XAU') || sym.includes('XAG');

      let pricescale = 100000;
      if (isJPY) pricescale = 1000;
      if (isXAU) pricescale = 100;
      if (isC) pricescale = 100;

      console.log('[Datafeed] resolveSymbol:', sym);
      setTimeout(() => onResolve({
        name: sym, ticker: sym, full_name: sym, description: sym,
        type: isC ? 'crypto' : 'forex',
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: 'XMLiquidity', listed_exchange: 'XMLiquidity',
        minmov: 1, pricescale,
        has_intraday: true, has_daily: true, has_weekly_and_monthly: true,
        supported_resolutions: ['1', '5', '15', '30', '60', '120', '240', 'D', 'W', 'M'],
        volume_precision: 2, data_status: 'streaming',
      }), 0);
    },

    async getBars(symbolInfo, resolution, periodParams, onResult) {
      const { countBack, firstDataRequest } = periodParams;
      const klineType = resolutionToKlineType[resolution] || 1;
      console.log(`[Datafeed] getBars: ${symbolInfo.name} res=${resolution} ktype=${klineType} countBack=${countBack} first=${firstDataRequest}`);

      try {
        const bars = await fetchKlines(symbolInfo.name, klineType, 500);
        console.log(`[Datafeed] getBars returned ${bars.length} bars for ${symbolInfo.name}`);
        if (bars.length > 0) {
          console.log(`[Datafeed] First bar: ${new Date(bars[0].time).toISOString()} Last bar: ${new Date(bars[bars.length-1].time).toISOString()}`);
        }
        onResult(bars.length > 0 ? bars : [], { noData: bars.length === 0 });
      } catch (err) {
        console.error('[Datafeed] getBars error:', err);
        onResult([], { noData: true });
      }
    },

    subscribeBars(symbolInfo, resolution, onTick, listenerGuid) {
      console.log(`[Datafeed] subscribeBars: ${symbolInfo.name} res=${resolution}`);
      const klineType = resolutionToKlineType[resolution] || 1;
      const infSym = toInfowaySymbol(symbolInfo.name);
      const resMinutes = parseInt(resolution) || 1;
      const resMs = resMinutes * 60 * 1000;

      // Register in WS subscriptions so ensureWs() feeds us real-time ticks
      subscriptions.set(listenerGuid, {
        symbol: symbolInfo.name,
        klineType,
        onTick,
      });

      // Connect WS (idempotent — reuses existing connection)
      const forCrypto = isCrypto(infSym);
      const ws = ensureWs(forCrypto);
      if (ws && ws.readyState === 1) {
        wsSendSub(ws, symbolInfo.name, klineType);
      }

      // REST poll as fallback — catches any gaps if WS drops
      let lastBar = null;
      let initialized = false;

      const init = async () => {
        try {
          const bars = await fetchKlines(symbolInfo.name, klineType, 2);
          if (bars.length > 0) {
            lastBar = { ...bars[bars.length - 1] };
          }
        } catch {}
        initialized = true;
      };
      init();

      const pollInterval = setInterval(async () => {
        if (!initialized) return;
        try {
          const tradeData = await fetchTradePrice(infSym);
          if (!tradeData || tradeData.length === 0) return;
          const price = parseFloat(tradeData[0].p);
          if (isNaN(price) || price <= 0) return;

          const now = Date.now();
          const candleTime = Math.floor(now / resMs) * resMs;

          if (!lastBar) {
            lastBar = { time: candleTime, open: price, high: price, low: price, close: price, volume: 0 };
          } else if (candleTime > lastBar.time) {
            lastBar = { time: candleTime, open: price, high: price, low: price, close: price, volume: 0 };
          } else {
            lastBar.close = price;
            if (price > lastBar.high) lastBar.high = price;
            if (price < lastBar.low) lastBar.low = price;
          }
          onTick({ ...lastBar });
        } catch {}
      }, 3000);

      if (!window._stPollers) window._stPollers = {};
      window._stPollers[listenerGuid] = pollInterval;
    },

    unsubscribeBars(listenerGuid) {
      subscriptions.delete(listenerGuid);
      if (window._stPollers?.[listenerGuid]) {
        clearInterval(window._stPollers[listenerGuid]);
        delete window._stPollers[listenerGuid];
      }
    },
  };
}
