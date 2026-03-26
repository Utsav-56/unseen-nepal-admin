import { SupabaseService } from "../../supabase/supabaseService";
import { Review, ReviewSchema } from "../schemas";

class ReviewService extends SupabaseService<Review> {
    constructor() {
        super('reviews', ReviewSchema as any);
    }

    /**
     * Submit a review for a completed booking.
     * SQL Trigger handle_guide_rating will automatically update the guide's avg_rating.
     * RLS ensures only the tourist of a 'completed' booking can insert.
     */
    async submitReview(review: Omit<Review, 'id' | 'created_at'>) {
        return this.create(review as any);
    }

    /**
     * Get all reviews for a specific guide, including tourist profile data.
     */
    async getForGuide(guideId: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select(`
                    *,
                    booking:bookings (
                        tourist:profiles (
                            id,
                            first_name,
                            last_name,
                            avatar_url,
                            username
                        )
                    )
                `)
                .eq('guide_id', guideId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as any[]; // Need to type this better in store or via schema
        });
    }

    /**
     * Get all reviews written by a specific tourist.
     */
    async getByTourist(touristId: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*, booking:bookings!inner(*)')
                .eq('booking.tourist_id', touristId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Review[];
        });
    }

    /**
     * Get review for a specific booking.
     */
    async getByBookingId(bookingId: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('booking_id', bookingId)
                .maybeSingle();

            if (error) throw error;
            return data as Review | null;
        });
    }
}

export const reviewService = new ReviewService();
