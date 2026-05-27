/**
 * XMLiquidity — Auth Hook
 * Convenience hook for auth state and actions.
 */

import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import {
  loginUser,
  registerUser,
  logoutUser,
  fetchCurrentUser,
  clearError,
} from '../store/authSlice';
import type { LoginRequest, RegisterRequest } from '../types/auth';
import { useCallback } from 'react';

export function useAuth() {
  const dispatch = useDispatch<AppDispatch>();
  const auth = useSelector((state: RootState) => state.auth);

  const login = useCallback(
    (data: LoginRequest) => dispatch(loginUser(data)),
    [dispatch]
  );

  const register = useCallback(
    (data: RegisterRequest) => dispatch(registerUser(data)),
    [dispatch]
  );

  const logout = useCallback(() => dispatch(logoutUser()), [dispatch]);

  const fetchUser = useCallback(() => dispatch(fetchCurrentUser()), [dispatch]);

  const clearAuthError = useCallback(() => dispatch(clearError()), [dispatch]);

  return {
    ...auth,
    login,
    register,
    logout,
    fetchUser,
    clearAuthError,
  };
}
