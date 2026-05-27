/**
 * XMLiquidity — Auth Type Definitions
 * Matches backend Pydantic schemas exactly.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: 'user' | 'sub_admin' | 'super_admin';
  kyc_status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  profile_image: string | null;
  avatar_type: string | null;
  is_active: boolean;
  is_blocked: boolean;
  is_trading_restricted: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  user: User;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ApiError {
  detail: string | Array<{ msg: string; loc: string[] }>;
}
