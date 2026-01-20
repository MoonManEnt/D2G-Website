/**
 * Authentication Hook with Zustand Store
 */

import { create } from "zustand";
import { AuthState, User } from "../types";
import * as api from "../services/api";

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string): Promise<boolean> => {
    set({ isLoading: true });

    const response = await api.login(email, password);

    if (response.success && response.data) {
      set({
        user: response.data.user as User,
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    }

    set({ isLoading: false });
    return false;
  },

  logout: async (): Promise<void> => {
    await api.logout();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  checkAuth: async (): Promise<void> => {
    set({ isLoading: true });

    const token = await api.getAccessToken();

    if (!token) {
      set({ isAuthenticated: false, isLoading: false });
      return;
    }

    const response = await api.getProfile();

    if (response.success && response.data) {
      set({
        user: response.data.user as User,
        accessToken: token,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      await api.logout();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  setUser: (user: User | null): void => {
    set({ user });
  },
}));
