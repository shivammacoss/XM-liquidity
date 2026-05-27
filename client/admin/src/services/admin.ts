/**
 * XMLiquidity — Admin API Service
 */

import api from './api';

export const adminApi = {
  // Dashboard
  dashboard: () => api.get('/admin/dashboard'),

  // Users
  users: (params?: Record<string, string | number>) => api.get('/admin/users', { params }),
  userDetail: (id: string) => api.get(`/admin/users/${id}`),
  userAction: (id: string, data: { action: string; reason?: string }) => api.post(`/admin/users/${id}/action`, data),

  // Transactions (deposits/withdrawals)
  transactions: (params?: Record<string, string | number>) => api.get('/admin/transactions', { params }),
  reviewTransaction: (id: string, data: { action: string; admin_notes?: string }) =>
    api.post(`/admin/transactions/${id}/review`, data),

  // Trades
  trades: (params?: Record<string, string | number>) => api.get('/admin/trades', { params }),
  modifyTrade: (id: string, data: Record<string, number>) => api.patch(`/admin/trades/${id}`, data),
  closeTrade: (id: string, price: number) => api.post(`/admin/trades/${id}/close?close_price=${price}`),

  // Charges
  charges: () => api.get('/admin/charges'),
  setCharge: (data: Record<string, unknown>) => api.post('/admin/charges', data),

  // Platform deposit-address settings (TRC20 / BEP20)
  paymentSettings: () => api.get('/admin/payment-settings'),
  updatePaymentSettings: (data: Record<string, unknown>) =>
    api.put('/admin/payment-settings', data),
  uploadPaymentQr: (network: 'trc20' | 'bep20', file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/admin/payment-settings/upload-qr?network=${network}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Instruments
  createInstrument: (data: Record<string, unknown>) => api.post('/admin/instruments', data),
  toggleInstrument: (symbol: string) => api.patch(`/admin/instruments/${symbol}/toggle`),

  // Prop settings
  createPropSettings: (data: Record<string, unknown>) => api.post('/admin/prop-settings', data),

  // Challenges
  createChallenge: (data: Record<string, unknown>) => api.post('/admin/challenges', data),

  // Copy trading
  copyMasters: (params?: Record<string, string>) => api.get('/admin/copy-masters', { params }),
  reviewMaster: (id: string, action: string) => api.post(`/admin/copy-masters/${id}/review?action=${action}`),

  // PAMM
  setPammProfitShare: (id: string, pct: number) =>
    api.post(`/admin/pamm/${id}/set-profit-share?profit_share_pct=${pct}`),

  // IB settings
  setIBSettings: (data: { level_1_pct: number; decay_factor: number; level_overrides?: Record<string, number> }) =>
    api.post('/admin/ib-settings', data),

  // Risk
  netPositions: () => api.get('/admin/risk/net-positions'),

  // Audit log
  auditLog: (params?: Record<string, number>) => api.get('/admin/audit-log', { params }),
};
