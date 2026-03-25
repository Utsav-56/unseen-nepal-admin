import { SupabaseService } from "../../supabase/supabaseService";
import { Profile, ProfileSchema, UserRole } from "../schemas";

class ProfileService extends SupabaseService<Profile> {
    constructor() {
        super('profiles', ProfileSchema);
    }

    /**
     * Get profiles by role
     */
    async getByRole(role: UserRole) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('role', role);
            if (error) throw error;
            return data as Profile[];
        });
    }

    /**
     * Get verified profiles
     */
    async getVerifiedProfiles() {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('is_verified', true);
            if (error) throw error;
            return data as Profile[];
        });
    }
}

export const profileService = new ProfileService();
