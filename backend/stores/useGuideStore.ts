import { create } from 'zustand';
import { Guide, CompleteGuideData } from '../schemas';
import { guideService } from '../services';
import { useAuthStore } from './useAuthStore';

interface GuideState {
    guides: Guide[];
    availableGuides: Guide[];
    currentGuide: CompleteGuideData | null;
    isLoading: boolean;
    error: string | null;

    // Getters 
    is_owner: () => boolean;

    // Actions
    fetchGuideDetail: (id: string) => Promise<void>;
    fetchTopRated: () => Promise<void>;
    searchByProximity: (lat: number, lon: number) => Promise<void>;

    // Guide specific management
    updateProfile: (updates: Partial<Guide>) => Promise<boolean>;
    toggleAvailability: () => Promise<boolean>;
    updateHourlyRate: (rate: number) => Promise<boolean>;
}

/**
 * useGuideStore
 * Manages the guide-related state, focusing on detailed profile hydration 
 * and geographic searching.
 */
export const useGuideStore = create<GuideState>((set, get) => ({
    guides: [],
    availableGuides: [],
    currentGuide: null,
    isLoading: false,
    error: null,

    // Implementation of Getters
    is_owner: () => {
        const userId = useAuthStore.getState().profile()?.id;
        const targetGuideId = get().currentGuide?.id;
        return !!userId && !!targetGuideId && userId === targetGuideId;
    },

    /**
     * fetchGuideDetail: Loads the complete guide profile including reviews and service areas
     */
    fetchGuideDetail: async (id: string) => {
        set({ isLoading: true, error: null });
        const result = await guideService.getFullGuideData(id);

        const data = Array.isArray(result.data) ? result.data[0] : result.data;
        if (result.isSuccess && data) {
            set({ currentGuide: data, isLoading: false });
        } else {
            set({ error: (result.backendError as string) || 'Failed to fetch guide details', isLoading: false });
        }
    },

    /**
     * fetchTopRated: Fetch high-performing guides for listings
     */
    fetchTopRated: async () => {
        set({ isLoading: true, error: null });
        const result = await guideService.getTopRated();
        if (result.isSuccess && result.data) {
            set({ guides: Array.isArray(result.data) ? result.data : [result.data], isLoading: false });
        } else {
            set({ error: (result.backendError as string) || 'Failed to fetch top guides', isLoading: false });
        }
    },

    /**
     * searchByProximity: Find guides based on geolocation (lat, lon)
     */
    searchByProximity: async (lat, lon) => {
        set({ isLoading: true, error: null });
        const result = await guideService.searchByProximity(lat, lon);
        if (result.isSuccess && result.data) {
            set({ availableGuides: Array.isArray(result.data) ? result.data : [result.data], isLoading: false });
        } else {
            set({ error: (result.backendError as string) || 'Search failed', isLoading: false });
        }
    },

    /**
     * updateProfile: Updates the current guide record
     */
    updateProfile: async (updates) => {
        const currentId = get().currentGuide?.id;
        if (!currentId || !get().is_owner()) {
            set({ error: 'Permission denied or no guide selected' });
            return false;
        }

        set({ isLoading: true, error: null });
        const result = await guideService.updateGuide(currentId, updates);
        if (result.isSuccess) {
            await get().fetchGuideDetail(currentId);
            return true;
        } else {
            set({ error: (result.backendError as string) || 'Update failed', isLoading: false });
            return false;
        }
    },

    /**
     * toggleAvailability: Handy method for a guide to toggle status
     */
    toggleAvailability: async () => {
        const currentId = get().currentGuide?.id;
        const currentStatus = get().currentGuide?.is_available;
        if (!currentId || !get().is_owner()) return false;

        set({ isLoading: true, error: null });
        const result = await guideService.setAvailability(currentId, !currentStatus);
        if (result.isSuccess) {
            await get().fetchGuideDetail(currentId);
            return true;
        } else {
            set({ error: (result.backendError as string) || 'Toggle failed', isLoading: false });
            return false;
        }
    },

    /**
     * updateHourlyRate: Quick update for pricing
     */
    updateHourlyRate: async (rate) => {
        const currentId = get().currentGuide?.id;
        if (!currentId || !get().is_owner()) return false;

        set({ isLoading: true, error: null });
        const result = await guideService.updateRate(currentId, rate);
        if (result.isSuccess) {
            await get().fetchGuideDetail(currentId);
            return true;
        } else {
            set({ error: (result.backendError as string) || 'Rate update failed', isLoading: false });
            return false;
        }
    }
}));
