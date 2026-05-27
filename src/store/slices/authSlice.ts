import { StateCreator } from 'zustand';
import { AuthUser, setupAuthListener } from '../../lib/auth';
import { ProdigyState } from '../index';

export interface AuthSlice {
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  setAuthUser: (user: AuthUser | null) => void;
  clearAuth: () => void;
  initializeAuth: () => void;
}

export const createAuthSlice: StateCreator<ProdigyState, [], [], AuthSlice> = (set, get) => ({
  authUser: null,
  isAuthenticated: false,
  authLoading: true,

  setAuthUser: (authUser: AuthUser | null) => {
    set({ 
      authUser, 
      isAuthenticated: !!authUser && authUser.id !== 'guest',
      authLoading: false 
    });
  },

  clearAuth: () => {
    set({ 
      authUser: null, 
      isAuthenticated: false,
      authLoading: false 
    });
  },

  initializeAuth: () => {
    setupAuthListener(async (authState) => {
      get().setAuthUser(authState.user);

      const userId = authState.user?.id;
      if (userId && userId !== 'guest') {
        try {
          await Promise.all([
            get().fetchUserData(userId),
            get().fetchSkills(userId),
            get().fetchQuests(userId)
          ]);
        } catch (error) {
          console.error('Error hydrating authenticated user state:', error);
        }
      }
    });
  }
});
