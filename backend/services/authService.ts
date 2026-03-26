import { SupabaseService } from "../../supabase/supabaseService";
import {
    CompleteUserProfile,
    CompleteUserProfileSchema,
    Profile,
    ProfileSchema
} from "../schemas";

/**
 * AuthService
 * Handles the authentication and profile lifecycle of the user
 * 
 * note: Singleton pattern, no business logic, only CRUD and API methods
 */
class AuthService extends SupabaseService<Profile> {
    constructor() {
        // We use 'profiles' as the base table and ProfileSchema for basic validations
        // casted to any because of optional id in BaseSchema vs BaseEntity
        super('profiles', ProfileSchema as any);
    }

    /**
     * Signup with email and password
     */
    async signUp(email: string, password: string, metadata: any = {}) {
        return this.execute(async () => {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: metadata,
                },
            });
            if (error) throw error;
            return data;
        });
    }

    /**
     * Login with email and password
     */
    async loginWithEmail(email: string, password: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
            return data;
        });
    }

    /**
     * Phone authentication (OTP)
     * This starts the OTP process
     */
    async loginWithPhone(phone: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase.auth.signInWithOtp({
                phone,
            });
            if (error) throw error;
            return data;
        });
    }

    /**
     * Verify OTP for phone/email login
     */
    async verifyOTP(phone: string, token: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase.auth.verifyOtp({
                phone,
                token,
                type: 'sms',
            });
            if (error) throw error;
            return data;
        });
    }

    /**
     * OAuth Login (Google, etc.)
     */
    async loginWithOAuth(provider: 'google' | 'facebook' | 'apple') {
        return this.execute(async () => {
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });
            if (error) throw error;
            return data;
        });
    }

    /**
     * Logout
     */
    async logout() {
        return this.execute(async () => {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            return null;
        });
    }

    /**
     * Fetch complete profile via RPC
     * This avoids multiple hits and returns guides and service areas if present
     */
    async fetchProfile(userId: string) {
        return this.execute(async () => {
            const data = await this.callRpc<CompleteUserProfile>('get_complete_user_profile', { user_id: userId });

            // Validate the complex object via its dedicated schema
            const validation = CompleteUserProfileSchema.safeParse(data);
            if (!validation.success) {
                console.error("Profile parsing failed:", validation.error);
            }
            return data;
        });
    }

    /**
     * Complete Onboarding
     * Fills the profile details and sets the onboarding_completed flag to true
     */
    async onboarding(userId: string, profileData: Partial<Profile>) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .update({
                    ...profileData,
                    onboarding_completed: true
                })
                .eq('id', userId)
                .select()
                .single();
            if (error) throw error;
            return data as Profile;
        }, profileData, true);
    }

    /**
     * Get the currently authenticated user session
     */
    async getCurrentUser() {
        return this.execute(async () => {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            if (error) throw error;
            return user;
        });
    }
}

export const authService = new AuthService();
