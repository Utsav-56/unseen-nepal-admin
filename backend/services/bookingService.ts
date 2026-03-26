import { SupabaseService } from "../../supabase/supabaseService";
import {
    Booking,
    BookingSchema,
    BookingStatus,
    CompleteBookingData,
    CompleteBookingDataSchema
} from "../schemas";

/**
 * BookingService
 * Responsible for handling guide bookings, status transitions, and detailed hydration.
 * Ensures data integrity for financial and scheduling records.
 */
class BookingService extends SupabaseService<Booking> {
    constructor() {
        super('bookings', BookingSchema as any);
    }

    /**
     * Create a new booking request
     * Note: total_amount should be calculated on the frontend and validated here or via DB triggers.
     */
    async createBooking(payload: Omit<Booking, 'id' | 'created_at' | 'status' | 'hired_at' | 'is_payment_recieved'>) {
        return this.create(payload as any);
    }

    /**
     * Get detailed booking for hydration
     * Calls get_detailed_booking RPC
     */
    async getDetailedBooking(bookingId: string) {
        return this.execute(async () => {
            const data = await this.callRpc<CompleteBookingData>('get_detailed_booking', {
                target_booking_id: bookingId
            });

            if (data) {
                const validation = CompleteBookingDataSchema.safeParse(data);
                if (!validation.success) {
                    console.error("Booking detailed validation failed:", validation.error);
                }
            }
            return data;
        });
    }

    /**
     * Get bookings for a specific user (Tourist or Guide)
     * Calls get_user_bookings RPC
     */
    async getUserBookings(userId: string, role: 'tourist' | 'guide') {
        return this.execute(async () => {
            const data = await this.callRpc<CompleteBookingData[]>('get_user_bookings', {
                target_user_id: userId,
                user_role: role
            });
            return data;
        });
    }

    /**
     * Update booking status (confirm, complete, cancel, report)
     */
    async updateStatus(id: string, status: BookingStatus) {
        return this.update(id, { status } as any);
    }

    /**
     * Confirm payment reception
     */
    async markAsPaid(id: string) {
        return this.update(id, { is_payment_recieved: true } as any);
    }
}

export const bookingService = new BookingService();
