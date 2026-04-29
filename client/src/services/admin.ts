/**
 * SwisTrade — Admin API Service
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

  // Instruments
  createInstrument: (data: Record<string, unknown>) => api.post('/admin/instruments', data),
  toggleInstrument: (symbol: string) => api.patch(`/admin/instruments/${symbol}/toggle`),

  // Prop settings (legacy single-tier — kept for back-compat)
  createPropSettings: (data: Record<string, unknown>) => api.post('/admin/prop-settings', data),

  // Prop challenges (bharat_funded parity — multi-tier catalog, force actions, payout queue)
  prop: {
    getSettings: () => api.get('/admin/prop/settings'),
    updateSettings: (data: Record<string, unknown>) => api.put('/admin/prop/settings', data),

    listChallenges: () => api.get('/admin/prop/challenges'),
    createChallenge: (data: Record<string, unknown>) => api.post('/admin/prop/challenges', data),
    updateChallenge: (id: string, data: Record<string, unknown>) =>
      api.put(`/admin/prop/challenges/${id}`, data),
    deleteChallenge: (id: string) => api.delete(`/admin/prop/challenges/${id}`),

    listAccounts: (params?: Record<string, string | number>) =>
      api.get('/admin/prop/accounts', { params }),
    forcePass: (propId: string) => api.post(`/admin/prop/accounts/${propId}/force-pass`),
    forceFail: (propId: string, reason?: string) =>
      api.post(`/admin/prop/accounts/${propId}/force-fail`, { reason: reason || '' }),
    extendTime: (propId: string, days: number) =>
      api.post(`/admin/prop/accounts/${propId}/extend-time`, { days }),
    resetAccount: (propId: string) => api.post(`/admin/prop/accounts/${propId}/reset`),

    dashboard: () => api.get('/admin/prop/dashboard'),

    listPayouts: (status: string = 'pending') =>
      api.get('/admin/prop/payouts', { params: { status } }),
    approvePayout: (txnId: string, data: { custom_amount?: number; override_cooldown?: boolean; admin_note?: string }) =>
      api.post(`/admin/prop/payouts/${txnId}/approve`, data),
    rejectPayout: (txnId: string, reason: string) =>
      api.post(`/admin/prop/payouts/${txnId}/reject`, { reason }),
  },

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
