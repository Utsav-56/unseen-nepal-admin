import { create } from 'zustand';
import { CompleteUserProfile, Profile } from '../schemas';
import { authService } from '../services';

interface AuthState {
    completeProfile: CompleteUserProfile | null;
    isLoading: boolean;
    error: string | null;

    // Getters for abstracted access
    is_logged_in: () => boolean;
    is_onbording_done: () => boolean;
    profile: () => CompleteUserProfile | null;

    // Core Actions
    initialize: () => Promise<void>;
    login: (email: string, password: string) => Promise<boolean>;
    signUp: (email: string, password: string, metadata?: any) => Promise<boolean>;
    onboarding: (profileData: Partial<Profile>) => Promise<boolean>;
    refresh: () => Promise<void>;
    logout: () => Promise<void>;
}

/**
 * useAuthStore
 * Manages the authentication state and complete user profile.
 * Uses the authService for all Supabase interactions.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
    completeProfile: null,
    isLoading: true,
    error: null,

    // Implementation of Getters 
    is_logged_in: () => get().completeProfile !== null,
    is_onbording_done: () => get().completeProfile?.is_onbording_completed ?? false,
    profile: () => get().completeProfile,

    /**
     * Initialize the store by checking the current session
     */
    initialize: async () => {
        set({ isLoading: true, error: null });
        try {
            const userResult = await authService.getCurrentUser();

            // Handle User | User[] | null type from ServiceResult
            const user = Array.isArray(userResult.data) ? userResult.data[0] : userResult.data;

            if (userResult.isSuccess && user) {
                const profileResult = await authService.fetchProfile(user.id);
                // Handle CompleteUserProfile | CompleteUserProfile[] | null
                const profileData = Array.isArray(profileResult.data) ? profileResult.data[0] : profileResult.data;

                if (profileResult.isSuccess && profileData) {
                    set({ completeProfile: profileData, isLoading: false });
                    return;
                }
            }
            set({ completeProfile: null, isLoading: false });
        } catch (err: any) {
            set({ error: err.message, isLoading: false, completeProfile: null });
        }
    },

    /**
     * Basic Login with Email
     */
    login: async (email, password) => {
        set({ isLoading: true, error: null });
        const result = await authService.loginWithEmail(email, password);

        const loginData = Array.isArray(result.data) ? result.data[0] : result.data;

        if (result.isSuccess && loginData?.user) {
            const profileResult = await authService.fetchProfile(loginData.user.id);
            const profileData = Array.isArray(profileResult.data) ? profileResult.data[0] : profileResult.data;

            set({
                completeProfile: profileResult.isSuccess && profileData ? profileData : null,
                isLoading: false
            });
            return true;
        } else {
            set({ error: (result.backendError as string) || 'Login failed', isLoading: false });
            return false;
        }
    },

    /**
     * Sign Up with Email
     */
    signUp: async (email, password, metadata) => {
        set({ isLoading: true, error: null });
        const result = await authService.signUp(email, password, metadata);

        const signUpData = Array.isArray(result.data) ? result.data[0] : result.data;

        if (result.isSuccess) {
            if (signUpData?.user) {
                const profileResult = await authService.fetchProfile(signUpData.user.id);
                const profileData = Array.isArray(profileResult.data) ? profileResult.data[0] : profileResult.data;
                set({ completeProfile: profileResult.isSuccess && profileData ? profileData : null });
            }
            set({ isLoading: false });
            return true;
        } else {
            set({ error: (result.backendError as string) || 'Signup failed', isLoading: false });
            return false;
        }
    },

    /**
     * Handle Profile Onboarding
     */
    onboarding: async (profileData) => {
        const profile = get().profile();
        if (!profile || !profile.id) {
            set({ error: 'No active profile to onboard' });
            return false;
        }

        set({ isLoading: true, error: null });
        const result = await authService.onboarding(profile.id, profileData);

        if (result.isSuccess) {
            await get().refresh();
            set({ isLoading: false });
            return true;
        } else {
            set({ error: (result.backendError as string) || 'Onboarding failed', isLoading: false });
            return false;
        }
    },

    /**
     * Refresh the current profile data
     */
    refresh: async () => {
        const currentProfile = get().profile();
        if (!currentProfile || !currentProfile.id) return;

        const profileResult = await authService.fetchProfile(currentProfile.id);
        const profileData = Array.isArray(profileResult.data) ? profileResult.data[0] : profileResult.data;

        if (profileResult.isSuccess && profileData) {
            set({ completeProfile: profileData });
        }
    },

    /**
     * Logout and clear state
     */
    logout: async () => {
        set({ isLoading: true });
        await authService.logout();
        set({ completeProfile: null, isLoading: false, error: null });
    }
}));
