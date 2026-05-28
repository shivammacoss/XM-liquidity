import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import {
  loginUser,
  logoutUser,
  fetchCurrentUser,
  clearError,
} from '../store/authSlice';
import type { LoginRequest } from '../types/auth';
import { useCallback } from 'react';

export function useAuth() {
  const dispatch = useDispatch<AppDispatch>();
  const auth = useSelector((state: RootState) => state.auth);

  const login = useCallback(
    (data: LoginRequest) => dispatch(loginUser(data)),
    [dispatch]
  );

  const logout = useCallback(() => dispatch(logoutUser()), [dispatch]);

  const fetchUser = useCallback(() => dispatch(fetchCurrentUser()), [dispatch]);

  const clearAuthError = useCallback(() => dispatch(clearError()), [dispatch]);

  return {
    ...auth,
    login,
    logout,
    fetchUser,
    clearAuthError,
  };
}
