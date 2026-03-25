import { SupabaseService } from "../../supabase/supabaseService";
import { Booking, BookingSchema, BookingStatus } from "../schemas";

class BookingService extends SupabaseService<Booking> {
    constructor() {
        super('bookings', BookingSchema);
    }

    /**
     * Get bookings for a guide
     */
    async getForGuide(guideId: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('guide_id', guideId);
            if (error) throw error;
            return data as Booking[];
        });
    }

    /**
     * Get bookings for a tourist
     */
    async getForTourist(touristId: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('tourist_id', touristId);
            if (error) throw error;
            return data as Booking[];
        });
    }

    /**
     * Update booking status
     */
    async updateStatus(id: string, status: BookingStatus) {
        return this.update(id, { status });
    }
}

export const bookingService = new BookingService();
