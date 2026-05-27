/**
 * XMLiquidity — Toast Notification System
 * iOS-style slide-in notifications. Used across the entire app.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react'

const ToastContext = createContext(null)

let toastIdCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastIdCounter
    setToasts(prev => [...prev, { id, message, type, duration }])

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const success = useCallback((msg, dur) => addToast(msg, 'success', dur), [addToast])
  const error = useCallback((msg, dur) => addToast(msg, 'error', dur || 5000), [addToast])
  const info = useCallback((msg, dur) => addToast(msg, 'info', dur), [addToast])
  const warning = useCallback((msg, dur) => addToast(msg, 'warning', dur), [addToast])

  // Trade-specific toasts
  const tradeOpened = useCallback((instrument, direction, lot, price) => {
    addToast(`${direction.toUpperCase()} ${lot} ${instrument} @ ${price}`, direction === 'buy' ? 'buy' : 'sell', 3000)
  }, [addToast])

  const tradeClosed = useCallback((instrument, pnl) => {
    const type = pnl >= 0 ? 'profit' : 'loss'
    addToast(`${instrument} closed | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, type, 4000)
  }, [addToast])

  return (
    <ToastContext.Provider value={{ success, error, info, warning, tradeOpened, tradeClosed, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.type}`}
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => removeToast(toast.id)}
          >
            <div className="toast__icon">
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✕'}
              {toast.type === 'info' && 'i'}
              {toast.type === 'warning' && '!'}
              {toast.type === 'buy' && '↑'}
              {toast.type === 'sell' && '↓'}
              {toast.type === 'profit' && '+'}
              {toast.type === 'loss' && '−'}
            </div>
            <span className="toast__message">{toast.message}</span>
            <button className="toast__close" onClick={(e) => { e.stopPropagation(); removeToast(toast.id) }}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
