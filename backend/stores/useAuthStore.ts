import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { createClient } from '../../supabase/client';
import { Profile } from '../schemas';
import { profileService } from '../services';

interface AuthState {
    user: User | null;
    profile: Profile | null;
    isLoading: boolean;
    error: string | null;

    initialize: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    setUser: (user: User | null) => void;
    setProfile: (profile: Profile | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    profile: null,
    isLoading: true,
    error: null,

    initialize: async () => {
        set({ isLoading: true, error: null });
        const supabase = createClient();

        try {
            // Using getUser() for production-ready security as it validates the session
            const { data: { user }, error } = await supabase.auth.getUser();

            if (error || !user) {
                set({ user: null, profile: null, isLoading: false });
                return;
            }

            const profileResult = await profileService.getById(user.id);
            set({
                user,
                profile: profileResult.isSuccess ? profileResult.data : null,
                isLoading: false
            });
        } catch (err: any) {
            set({ error: err.message, isLoading: false, user: null, profile: null });
        }
    },

    signOut: async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        set({ user: null, profile: null, isLoading: false });
    },

    refreshProfile: async () => {
        const { user } = get();
        if (!user) return;

        const profileResult = await profileService.getById(user.id);
        if (profileResult.isSuccess) {
            set({ profile: profileResult.data });
        }
    },

    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile })
}));
