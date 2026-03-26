import { create } from 'zustand';
import { Booking, BookingStatus, CompleteBookingData } from '../schemas';
import { bookingService } from '../services';
import { useAuthStore } from './useAuthStore';

interface BookingState {
    bookings: CompleteBookingData[];
    currentBooking: CompleteBookingData | null;
    isLoading: boolean;
    error: string | null;

    // Core Actions
    fetchUserBookings: (roleOverride?: 'tourist' | 'guide') => Promise<void>;
    fetchBookingDetail: (id: string) => Promise<void>;
    createBooking: (payload: Omit<Booking, 'id' | 'created_at' | 'status' | 'hired_at' | 'is_payment_recieved'>) => Promise<boolean>;

    // Status Transitions
    confirmBooking: (id: string) => Promise<void>;
    completeBooking: (id: string) => Promise<void>;
    cancelBooking: (id: string) => Promise<void>;
    reportBooking: (id: string) => Promise<void>;
}

/**
 * useBookingStore
 * Dedicated store for handling the lifecycle of guide bookings.
 * Integrates with auth store to deduce the current user's role and identity.
 */
export const useBookingStore = create<BookingState>((set, get) => ({
    bookings: [],
    currentBooking: null,
    isLoading: false,
    error: null,

    /**
     * fetchUserBookings: Fetches bookings based on the currently logged in user role.
     */
    fetchUserBookings: async (roleOverride) => {
        const profile = useAuthStore.getState().profile();
        if (!profile || !profile.id) return;

        const role = roleOverride || (profile.profile?.role === 'guide' ? 'guide' : 'tourist');

        set({ isLoading: true, error: null });
        const result = await bookingService.getUserBookings(profile.id, role);

        if (result.isSuccess && result.data) {
            set({ bookings: Array.isArray(result.data) ? result.data : [result.data], isLoading: false });
        } else {
            set({ error: (result.backendError as string) || 'Failed to fetch bookings', isLoading: false });
        }
    },

    /**
     * fetchBookingDetail: Hydrates the store with detailed booking and profile associations.
     */
    fetchBookingDetail: async (id: string) => {
        set({ isLoading: true, error: null });
        const result = await bookingService.getDetailedBooking(id);

        const data = Array.isArray(result.data) ? result.data[0] : result.data;
        if (result.isSuccess && data) {
            set({ currentBooking: data, isLoading: false });
        } else {
            set({ error: (result.backendError as string) || 'Failed to fetch booking details', isLoading: false });
        }
    },

    /**
     * createBooking: Submits a new booking request.
     */
    createBooking: async (payload) => {
        const userId = useAuthStore.getState().profile()?.id;
        if (!userId) {
            set({ error: 'Authentication required' });
            return false;
        }

        set({ isLoading: true, error: null });
        const result = await bookingService.createBooking({
            ...payload,
            tourist_id: userId // Ensure tourist_id comes from secure state
        });

        if (result.isSuccess && result.data) {
            const newBooking = Array.isArray(result.data) ? result.data[0] : result.data;
            set((state) => ({
                bookings: [newBooking as CompleteBookingData, ...state.bookings],
                isLoading: false
            }));
            return true;
        } else {
            set({ error: (result.backendError as string) || 'Failed to create booking', isLoading: false });
            return false;
        }
    },

    /**
     * Utility status transitions
     */
    confirmBooking: async (id) => {
        set({ isLoading: true });
        const result = await bookingService.updateStatus(id, 'confirmed');
        if (result.isSuccess) {
            await get().fetchBookingDetail(id);
        } else {
            set({ error: (result.backendError as string) || 'Operation failed', isLoading: false });
        }
    },

    completeBooking: async (id) => {
        set({ isLoading: true });
        const result = await bookingService.updateStatus(id, 'completed');
        if (result.isSuccess) {
            await get().fetchBookingDetail(id);
        } else {
            set({ error: (result.backendError as string) || 'Operation failed', isLoading: false });
        }
    },

    cancelBooking: async (id) => {
        set({ isLoading: true });
        const result = await bookingService.updateStatus(id, 'cancelled');
        if (result.isSuccess) {
            await get().fetchBookingDetail(id);
        } else {
            set({ error: (result.backendError as string) || 'Operation failed', isLoading: false });
        }
    },

    reportBooking: async (id) => {
        set({ isLoading: true });
        const result = await bookingService.updateStatus(id, 'reported');
        if (result.isSuccess) {
            await get().fetchBookingDetail(id);
        } else {
            set({ error: (result.backendError as string) || 'Operation failed', isLoading: false });
        }
    }
}));
