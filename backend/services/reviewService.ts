import { SupabaseService } from "../../supabase/supabaseService";
import { Review, ReviewSchema } from "../schemas";

class ReviewService extends SupabaseService<Review> {
    constructor() {
        super('reviews', ReviewSchema);
    }

    /**
     * Get reviews for a guide
     */
    async getForGuide(guideId: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('guide_id', guideId);
            if (error) throw error;
            return data as Review[];
        });
    }

    /**
     * Get reviews by a tourist
     */
    async getByTourist(touristId: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('tourist_id', touristId);
            if (error) throw error;
            return data as Review[];
        });
    }

    /**
     * Get review for a specific booking
     */
    async getByBookingId(bookingId: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('booking_id', bookingId)
                .single();
            if (error) throw error;
            return data as Review;
        });
    }
}

export const reviewService = new ReviewService();
