/**
 * XMLiquidity — API Service
 * Centralized HTTP client. All API calls go through here.
 * Tokens stored in memory (accessToken) + secure storage (refreshToken).
 * NEVER stores tokens in localStorage for XSS protection.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '../types/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Create axios instance with security defaults
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  // Don't send cookies to API (we use Bearer tokens)
  withCredentials: false,
});

// --- Token Management (in-memory only — not localStorage) ---
let accessToken: string | null = null;
let refreshTokenValue: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshTokenValue = refresh;
  try {
    sessionStorage.setItem('_at', access);
    sessionStorage.setItem('_rt', refresh);
  } catch {
    // sessionStorage unavailable
  }
}

export function restoreTokens(): { access: string | null; refresh: string | null } {
  try {
    const at = sessionStorage.getItem('_at');
    const rt = sessionStorage.getItem('_rt');
    if (at) accessToken = at;
    if (rt) refreshTokenValue = rt;
    return { access: at, refresh: rt };
  } catch {
    return { access: null, refresh: null };
  }
}

export function getRefreshToken(): string | null {
  if (refreshTokenValue) return refreshTokenValue;
  try {
    return sessionStorage.getItem('_rt');
  } catch {
    return null;
  }
}

export function clearTokens() {
  accessToken = null;
  refreshTokenValue = null;
  try {
    sessionStorage.removeItem('_at');
    sessionStorage.removeItem('_rt');
  } catch {
    // ignore
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

// --- Request Interceptor: Attach Bearer token ---
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response Interceptor: Handle 401 + auto-refresh ---
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else if (token) {
      p.resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and we haven't retried yet, try refreshing the token
    if (error.response?.status === 401 && !originalRequest._retry) {
      const rt = getRefreshToken();
      if (!rt) {
        clearTokens();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: rt,
        });

        const newAccessToken = data.access_token;
        accessToken = newAccessToken;

        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        // Redirect to login
        window.location.href = '/signin';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Extract user-friendly error message from API error response.
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data?.detail) {
      if (typeof data.detail === 'string') return data.detail;
      if (Array.isArray(data.detail)) {
        return data.detail.map((e: { msg: string }) => e.msg).join(', ');
      }
    }
    if (error.response?.status === 429) return 'Too many attempts. Please try again later.';
    if (error.response?.status === 500) return 'Server error. Please try again.';
    if (!error.response) return 'Network error. Check your connection.';
  }
  return 'Something went wrong. Please try again.';
}

export default api;
