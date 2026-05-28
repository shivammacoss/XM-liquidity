/**
 * XMLiquidity — Auth Redux Slice
 * Manages authentication state. Tokens in memory, not localStorage.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { setTokens, clearTokens, getRefreshToken, getErrorMessage } from '../services/api';
import type { AuthState, LoginRequest, TokenResponse, User } from '../types/auth';

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// --- Async Thunks ---

export const loginUser = createAsyncThunk<
  TokenResponse,
  LoginRequest,
  { rejectValue: string }
>('auth/login', async (data, { rejectWithValue }) => {
  try {
    const response = await api.post<TokenResponse>('/auth/login', data);
    return response.data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const fetchCurrentUser = createAsyncThunk<
  User,
  void,
  { rejectValue: string }
>('auth/fetchMe', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get<{ user: User }>('/auth/me');
    return response.data.user;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const refreshAccessToken = createAsyncThunk<
  TokenResponse,
  void,
  { rejectValue: string }
>('auth/refresh', async (_, { rejectWithValue }) => {
  const rt = getRefreshToken();
  if (!rt) return rejectWithValue('No refresh token');
  try {
    const response = await api.post<TokenResponse>('/auth/refresh', {
      refresh_token: rt,
    });
    return response.data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const logoutUser = createAsyncThunk<void, void, { rejectValue: string }>(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    const rt = getRefreshToken();
    try {
      if (rt) {
        await api.post('/auth/logout', { refresh_token: rt });
      }
    } catch {
      // Logout should succeed even if API call fails
    } finally {
      clearTokens();
    }
  }
);

// --- Slice ---

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    resetAuth() {
      clearTokens();
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
        setTokens(action.payload.access_token, action.payload.refresh_token || '');
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Login failed';
      });

    // Fetch current user
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        clearTokens();
      });

    // Refresh token
    builder
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        setTokens(action.payload.access_token, action.payload.refresh_token || '');
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.accessToken = null;
        clearTokens();
      });

    // Logout
    builder
      .addCase(logoutUser.fulfilled, () => {
        clearTokens();
        return initialState;
      });
  },
});

export const { clearError, resetAuth } = authSlice.actions;
export default authSlice.reducer;
