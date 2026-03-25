import { SupabaseService } from "../../supabase/supabaseService";
import { Guide, GuideSchema } from "../schemas";

class GuideService extends SupabaseService<Guide> {
    constructor() {
        super('guides', GuideSchema);
    }

    /**
     * Get available guides
     */
    async getAvailableGuides() {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('is_available', true);
            if (error) throw error;
            return data as Guide[];
        });
    }

    /**
     * Search guides by location
     */
    async searchByLocation(location: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .ilike('location', `%${location}%`);
            if (error) throw error;
            return data as Guide[];
        });
    }

    /**
     * Get top rated guides
     */
    async getTopRatedGuides(limit: number = 10) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .order('avg_rating', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return data as Guide[];
        });
    }
}

export const guideService = new GuideService();
