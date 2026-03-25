import { create } from 'zustand';
import { Booking, BookingStatus } from '../schemas';
import { bookingService } from '../services';

interface BookingState {
    bookings: Booking[];
    isLoading: boolean;
    error: string | null;

    fetchForGuide: (guideId: string) => Promise<void>;
    fetchForTourist: (touristId: string) => Promise<void>;
    updateStatus: (id: string, status: BookingStatus) => Promise<void>;
    createBooking: (payload: any) => Promise<void>;
}

export const useBookingStore = create<BookingState>((set) => ({
    bookings: [],
    isLoading: false,
    error: null,

    fetchForGuide: async (guideId: string) => {
        set({ isLoading: true, error: null });
        const result = await bookingService.getForGuide(guideId);
        if (result.isSuccess && result.data) {
            set({ bookings: result.data, isLoading: false });
        } else {
            set({ error: result.error?.message || 'Failed to fetch guide bookings', isLoading: false });
        }
    },

    fetchForTourist: async (touristId: string) => {
        set({ isLoading: true, error: null });
        const result = await bookingService.getForTourist(touristId);
        if (result.isSuccess && result.data) {
            set({ bookings: result.data, isLoading: false });
        } else {
            set({ error: result.error?.message || 'Failed to fetch tourist bookings', isLoading: false });
        }
    },

    updateStatus: async (id: string, status: BookingStatus) => {
        set({ isLoading: true, error: null });
        const result = await bookingService.updateStatus(id, status);
        if (result.isSuccess && result.data) {
            set((state) => ({
                bookings: state.bookings.map(b => b.id === id ? result.data! : b),
                isLoading: false
            }));
        } else {
            set({ error: result.error?.message || 'Failed to update status', isLoading: false });
        }
    },

    createBooking: async (payload: any) => {
        set({ isLoading: true, error: null });
        const result = await bookingService.create(payload);
        if (result.isSuccess && result.data) {
            set((state) => ({
                bookings: [...state.bookings, result.data!],
                isLoading: false
            }));
        } else {
            set({ error: result.error?.message || 'Failed to create booking', isLoading: false });
        }
    }
}));
