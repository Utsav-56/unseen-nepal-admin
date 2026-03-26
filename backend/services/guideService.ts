import { SupabaseService } from "../../supabase/supabaseService";
import {
    Guide,
    GuideSchema,
    CompleteGuideData,
    CompleteGuideDataSchema
} from "../schemas";

/**
 * GuideService
 * Handles all guide related operations including profile management, 
 * searching, and deep profile hydration.
 */
class GuideService extends SupabaseService<Guide> {
    constructor() {
        super('guides', GuideSchema as any);
    }

    /**
     * Get full guide profile details for hydration
     * Calls the get_full_guide_data RPC
     */
    async getFullGuideData(guideId: string) {
        return this.execute(async () => {
            const data = await this.callRpc<CompleteGuideData>('get_full_guide_data', {
                target_guide_id: guideId
            });

            if (data) {
                const validation = CompleteGuideDataSchema.safeParse(data);
                if (!validation.success) {
                    console.error("Guide Data validation failed:", validation.error);
                }
            }
            return data;
        }, null);
    }

    /**
     * Find available guides for a specific geographic point
     * Uses the PostGIS find_guides_for_destination RPC
     */
    async searchByProximity(lat: number, lon: number) {
        return this.execute(async () => {
            const { data, error } = await this.supabase.rpc('find_guides_for_destination', {
                dest_lat: lat,
                dest_lon: lon
            });
            if (error) throw error;
            return data;
        });
    }

    /**
     * Update guide basic information
     */
    async updateGuide(id: string, updates: Partial<Guide>) {
        return this.update(id, updates);
    }

    /**
     * Toggle guide availability status
     */
    async setAvailability(id: string, isAvailable: boolean) {
        return this.update(id, { is_available: isAvailable });
    }

    /**
     * Update guide hourly rate
     */
    async updateRate(id: string, rate: number) {
        return this.update(id, { hourly_rate: rate });
    }

    /**
     * Fetch top rated guides
     */
    async getTopRated(limit: number = 10) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*, profiles(first_name, last_name, avatar_url)')
                .order('avg_rating', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return data;
        });
    }
}

export const guideService = new GuideService();
