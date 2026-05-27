/**
 * XMLiquidity — Dashboard API Service
 * All dashboard-related API calls.
 */

import api from './api';

// --- Accounts ---
export const accountsApi = {
  list: (params?: Record<string, string>) => api.get('/accounts/', { params }),
  get: (id: string) => api.get(`/accounts/${id}`),
  create: (data: { account_type: string; leverage: number }) => api.post('/accounts/', data),
  updateLeverage: (id: string, leverage: number) => api.patch(`/accounts/${id}/leverage?leverage=${leverage}`),
  delete: (id: string) => api.delete(`/accounts/${id}`),
};

// --- Wallet ---
export const walletApi = {
  get: () => api.get('/wallet/'),
  getMemoTag: () => api.get('/wallet/memo-tag'),
  depositAddresses: () => api.get('/wallet/deposit-addresses'),
  deposit: (data: {
    amount: number;
    method: string;
    network?: string;
    crypto_txn_hash?: string;
    memo_tag?: string;
    from_address?: string;
    proof_image_url?: string;
  }) => api.post('/wallet/deposit', data),
  withdraw: (data: { amount: number; method: string; network?: string; wallet_address?: string }) =>
    api.post('/wallet/withdraw', data),
  transfer: (data: { amount: number; direction: string; account_id: string }) =>
    api.post('/wallet/transfer', data),
  transactions: (params?: Record<string, string | number>) => api.get('/wallet/transactions', { params }),
  lockFunds: () => api.post('/wallet/lock-funds', {}),
  uploadProof: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/wallet/upload-proof', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// --- Trades ---
export const tradesApi = {
  open: (data: Record<string, unknown>) => api.post('/trades/open', data),
  close: (id: string, data: { close_price: number }) => api.post(`/trades/${id}/close`, data),
  partialClose: (id: string, data: { lot_size: number; close_price: number }) =>
    api.post(`/trades/${id}/partial-close`, data),
  modify: (id: string, data: { stop_loss?: number; take_profit?: number }) =>
    api.patch(`/trades/${id}/modify`, data),
  cancel: (id: string) => api.post(`/trades/${id}/cancel`),
  getOpen: (params?: Record<string, string>) => api.get('/trades/open', { params }),
  getPending: (params?: Record<string, string>) => api.get('/trades/pending', { params }),
  getHistory: (params?: Record<string, string | number>) => api.get('/trades/history', { params }),
  checkMargin: (accountId: string) => api.post(`/trades/check-margin/${accountId}`),
};

// --- Prop ---
export const propApi = {
  // Public + legacy
  status: () => api.get('/prop/status'),
  available: () => api.get('/prop/available'),
  purchase: (propSettingsId: string) => api.post('/prop/purchase', { prop_settings_id: propSettingsId }),
  myChallenges: (params?: Record<string, string>) => api.get('/prop/my-challenges', { params }),
  getDetail: (id: string) => api.get(`/prop/${id}`),

  // bharat_funded parity — multi-tier catalog + analytics + funded payout
  challenges: () => api.get('/prop/challenges'),
  buy: (challengeId: string, tierIndex?: number) =>
    api.post('/prop/buy', { challenge_id: challengeId, tier_index: tierIndex ?? null }),
  myAccounts: () => api.get('/prop/my-accounts'),
  dashboard: (propId: string) => api.get(`/prop/account/${propId}/dashboard`),
  insights: (propId: string) => api.get(`/prop/account/${propId}/insights`),
  withdraw: (propId: string) => api.post('/prop/withdraw', { prop_id: propId }),
};

// --- IB ---
export const ibApi = {
  create: (data: { ib_type: string; referral_code_used?: string }) => api.post('/ib/create', data),
  dashboard: () => api.get('/ib/dashboard'),
  commissions: (params?: Record<string, string | number>) => api.get('/ib/commissions', { params }),
  referralLink: () => api.get('/ib/referral-link'),
};

// --- Copy Trading ---
export const copyApi = {
  masters: () => api.get('/copy-trading/masters'),
  applyMaster: (data: { account_id: string; charge_per_trade: number }) =>
    api.post('/copy-trading/apply-master', data),
  subscribe: (data: { master_id: string; account_id: string; lot_multiplier: number }) =>
    api.post('/copy-trading/subscribe', data),
  unsubscribe: (id: string) => api.delete(`/copy-trading/unsubscribe/${id}`),
  mySubscriptions: () => api.get('/copy-trading/my-subscriptions'),
  pammList: () => api.get('/copy-trading/pamm'),
  pammInvest: (data: { pamm_id: string; amount: number }) => api.post('/copy-trading/pamm/invest', data),
};

// --- Bots ---
export const botsApi = {
  list: () => api.get('/bots/'),
  create: (data: {
    account_id: string;
    name: string;
    strategy_name?: string;
    default_lot_size: number;
    max_lot_size?: number;
    risk_per_trade_pct?: number;
    use_sl?: boolean;
    use_tp?: boolean;
    default_order_action?: string;
    fixed_symbol?: string;
  }) => api.post('/bots/', data),
  signals: (botId: string, params?: Record<string, string | number>) =>
    api.get(`/bots/${botId}/signals`, { params }),
  toggle: (botId: string) => api.patch(`/bots/${botId}/toggle`),
};

// --- Challenges ---
export const challengesApi = {
  list: (params?: Record<string, string>) => api.get('/challenges/', { params }),
  join: (challengeId: string, accountId: string) =>
    api.post(`/challenges/${challengeId}/join?account_id=${accountId}`),
  leaderboard: (challengeId: string) => api.get(`/challenges/${challengeId}/leaderboard`),
};

// --- Profile ---
export const profileApi = {
  update: (data: { name?: string; phone?: string; avatar_type?: string }) =>
    api.patch('/users/profile', data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post('/users/change-password', data),
  createReadOnlyId: (password: string) => api.post('/users/read-only-id', { password }),
  kycUpload: (docType: string, file: File) => {
    const formData = new FormData();
    formData.append('doc_type', docType);
    formData.append('file', file);
    return api.post('/users/kyc/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  kycStatus: () => api.get('/users/kyc/status'),
};

// --- Instruments ---
export const instrumentsApi = {
  list: (params?: Record<string, string>) => api.get('/instruments/', { params }),
  segments: () => api.get('/instruments/segments'),
};

// --- Notifications ---
export const notificationsApi = {
  list: (params?: Record<string, string | number | boolean>) => api.get('/notifications/', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};

// --- Banking ---
export const bankingApi = {
  list: () => api.get('/banking/'),
  add: (data: Record<string, unknown>) => api.post('/banking/', data),
  remove: (id: string) => api.delete(`/banking/${id}`),
  setDefault: (id: string) => api.patch(`/banking/${id}/set-default`),
};
