import { create } from 'zustand';
import { Review } from '../schemas';
import { reviewService } from '../services';

interface ReviewState {
    guideReviews: any[]; // Hydrated reviews with profile data
    touristReviews: Review[];
    isLoading: boolean;
    error: string | null;

    fetchForGuide: (guideId: string) => Promise<void>;
    fetchByTourist: (touristId: string) => Promise<void>;
    submitReview: (review: Omit<Review, 'id' | 'created_at'>) => Promise<boolean>;
    getReviewByBooking: (bookingId: string) => Promise<Review | null>;
}

/**
 * useReviewStore
 * Manages the rating and review lifecycle.
 * Reviews are strictly tied to completed bookings (enforced by RLS & Unique constraints).
 */
export const useReviewStore = create<ReviewState>((set, get) => ({
    guideReviews: [],
    touristReviews: [],
    isLoading: false,
    error: null,

    /**
     * Fetch all reviews for a guide to display on their public profile.
     */
    fetchForGuide: async (guideId: string) => {
        set({ isLoading: true, error: null });
        const result = await reviewService.getForGuide(guideId);
        if (result.isSuccess) {
            set({ guideReviews: result.data || [], isLoading: false });
        } else {
            set({ error: (result.backendError as string) || 'Failed to fetch guide reviews', isLoading: false });
        }
    },

    /**
     * Fetch all reviews written by the current tourist.
     */
    fetchByTourist: async (touristId: string) => {
        set({ isLoading: true, error: null });
        const result = await reviewService.getByTourist(touristId);
        if (result.isSuccess) {
            set({ touristReviews: result.data || [], isLoading: false });
        } else {
            set({ error: (result.backendError as string) || 'Failed to fetch your reviews', isLoading: false });
        }
    },

    /**
     * Submit a new review for a completed booking.
     * Note: Guide's avg_rating is automatically updated by the database.
     */
    submitReview: async (review) => {
        set({ isLoading: true, error: null });
        const result = await reviewService.submitReview(review);
        if (result.isSuccess) {
            // Refresh guide reviews if we are looking at the same guide
            if (get().guideReviews.length > 0 && get().guideReviews[0].guide_id === review.guide_id) {
                await get().fetchForGuide(review.guide_id);
            }
            set({ isLoading: false });
            return true;
        } else {
            set({ error: (result.backendError as string) || 'Submission failed', isLoading: false });
            return false;
        }
    },

    /**
     * Check if a booking already has a review.
     */
    getReviewByBooking: async (bookingId: string) => {
        const result = await reviewService.getByBookingId(bookingId);
        if (result.isSuccess) {
            return result.data as Review | null;
        }
        return null;
    }
}));
