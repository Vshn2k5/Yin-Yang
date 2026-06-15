import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';
import { validate, signUpSchema, signInSchema, resetPasswordSchema, updatePasswordSchema, checkRateLimit } from './validation';

export type OAuthProvider = 'google' | 'github' | 'facebook' | 'twitter';

export interface AuthUser extends User {
  profile?: UserProfile;
}

export interface UserProfile {
  id: string;
  user_id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  website?: string;
  role: 'guest' | 'user' | 'premium' | 'admin';
  is_verified: boolean;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SocialLink {
  id: string;
  user_id: string;
  platform: string;
  username?: string;
  url?: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
}

// Authentication functions
export const authAPI = {
  // Sign up with email and password
  async signUp(email: string, password: string, metadata?: Record<string, unknown>) {
    // Validate input
    const validation = validate(signUpSchema, { email, password, ...metadata });
    if (!validation.success) {
      return { data: null, error: new Error(validation.error) };
    }

    // Check rate limit
    const rateLimit = checkRateLimit(`signup:${email}`, 3, 60000); // 3 attempts per minute
    if (!rateLimit.allowed) {
      return { 
        data: null, 
        error: new Error(`Too many attempts. Please try again in ${rateLimit.retryAfter} seconds.`) 
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    return { data, error };
  },

  // Sign in with email and password
  async signIn(email: string, password: string) {
    // Validate input
    const validation = validate(signInSchema, { email, password });
    if (!validation.success) {
      return { data: null, error: new Error(validation.error) };
    }

    // Check rate limit
    const rateLimit = checkRateLimit(`signin:${email}`, 5, 60000); // 5 attempts per minute
    if (!rateLimit.allowed) {
      return { 
        data: null, 
        error: new Error(`Too many attempts. Please try again in ${rateLimit.retryAfter} seconds.`) 
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },

  // Sign in with OAuth provider
  async signInWithOAuth(provider: OAuthProvider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true
      }
    });
    return { data, error };
  },

  async exchangeOAuthCode(code: string) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    return { data, error };
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Reset password
  async resetPassword(email: string) {
    // Validate input
    const validation = validate(resetPasswordSchema, { email });
    if (!validation.success) {
      return { data: null, error: new Error(validation.error) };
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    });
    return { data, error };
  },

  // Update password
  async updatePassword(password: string) {
    // Validate input
    const validation = validate(updatePasswordSchema, { password });
    if (!validation.success) {
      return { data: null, error: new Error(validation.error) };
    }

    const { data, error } = await supabase.auth.updateUser({
      password
    });
    return { data, error };
  },

  // Get current session
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    return { data, error };
  },

  // Get current user
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    return { data, error };
  },

  // Enable 2FA
  async enable2FA() {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp'
    });
    return { data, error };
  },

  // Verify 2FA
  async verify2FA(factorId: string, challengeId: string, code: string) {
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code
    });
    return { data, error };
  },

  // Create guest session
  createGuestSession() {
    return {
      user: {
        id: 'guest',
        email: 'guest@example.com',
        profile: {
          id: 'guest',
          user_id: 'guest',
          full_name: 'Guest User',
          role: 'guest' as const,
          is_verified: false,
          preferences: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      } as AuthUser,
      session: null,
      isGuest: true
    };
  }
};

// Profile management functions
export const profileAPI = {
  // Get user profile
  async getProfile(userId: string): Promise<{ data: UserProfile | null; error: unknown }> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    return { data, error };
  },

  // Update user profile
  async updateProfile(userId: string, updates: Partial<UserProfile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();
    
    return { data, error };
  },

  // Upload avatar
  async uploadAvatar(userId: string, file: File) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) {
      return { data: null, error: uploadError };
    }

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Update profile with new avatar URL
    const { data: profile, error: updateError } = await profileAPI.updateProfile(userId, {
      avatar_url: data.publicUrl
    });

    return { data: profile, error: updateError };
  },

  // Get social links
  async getSocialLinks(userId: string): Promise<{ data: SocialLink[] | null; error: unknown }> {
    const { data, error } = await supabase
      .from('social_links')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    return { data, error };
  },

  // Add or update social link
  async upsertSocialLink(userId: string, platform: string, username?: string, url?: string) {
    const { data, error } = await supabase
      .from('social_links')
      .upsert({
        user_id: userId,
        platform,
        username,
        url
      })
      .select()
      .single();
    
    return { data, error };
  },

  // Delete social link
  async deleteSocialLink(userId: string, platform: string) {
    const { error } = await supabase
      .from('social_links')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform);
    
    return { error };
  }
};

// Security functions
export const securityAPI = {
  // Get active sessions
  async getActiveSessions(userId: string) {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_activity', { ascending: false });
    
    return { data, error };
  },

  // Revoke session
  async revokeSession(sessionId: string) {
    const { error } = await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('id', sessionId);
    
    return { error };
  },

  // Check if user has permission
  hasPermission(userRole: string, requiredRole: string): boolean {
    const roleHierarchy = ['guest', 'user', 'premium', 'admin'];
    const userLevel = roleHierarchy.indexOf(userRole);
    const requiredLevel = roleHierarchy.indexOf(requiredRole);
    
    return userLevel >= requiredLevel;
  }
};

// Auth state listener with race condition protection
let authAbortController: AbortController | null = null;

export const setupAuthListener = (callback: (authState: AuthState) => void) => {
  return supabase.auth.onAuthStateChange(async (_event, session) => {
    // Cancel any pending auth operations to prevent race conditions
    if (authAbortController) {
      authAbortController.abort();
    }
    authAbortController = new AbortController();

    const authState: AuthState = {
      user: null,
      session,
      loading: false,
      isGuest: false
    };

    if (session?.user) {
      try {
        // Get user profile
        let { data: profile } = await profileAPI.getProfile(session.user.id);
        
        // If no profile exists, auto-create one (handles users who pre-date the
        // handle_new_user trigger or cases where the trigger failed)
        if (!profile) {
          try {
            const { data: newProfile } = await supabase
              .from('profiles')
              .insert({
                user_id: session.user.id,
                email: session.user.email,
                full_name: session.user.user_metadata?.full_name
                  || session.user.user_metadata?.name
                  || session.user.email?.split('@')[0]
                  || 'User',
                avatar_url: session.user.user_metadata?.avatar_url || null,
                role: 'user'
              })
              .select()
              .single();
            
            if (newProfile) {
              profile = newProfile;
            }
          } catch (insertError) {
            console.warn('Could not auto-create profile:', insertError);
          }
        }

        // Ensure we always have at least a minimal profile for authenticated users
        authState.user = {
          ...session.user,
          profile: profile || {
            id: session.user.id,
            user_id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name
              || session.user.user_metadata?.name
              || session.user.email?.split('@')[0]
              || 'User',
            role: 'user' as const,
            is_verified: false,
            preferences: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Request was aborted due to race condition, ignore
          return;
        }
        console.error('Error in auth state change:', error);
      }
    }

    callback(authState);
  });
};
