import { create } from 'zustand';
import { Guide } from '../schemas';
import { guideService } from '../services';

interface GuideState {
    guides: Guide[];
    availableGuides: Guide[];
    selectedGuide: Guide | null;
    isLoading: boolean;
    error: string | null;

    fetchGuides: () => Promise<void>;
    fetchAvailableGuides: () => Promise<void>;
    selectGuide: (id: string) => Promise<void>;
    searchByLocation: (location: string) => Promise<void>;
}

export const useGuideStore = create<GuideState>((set) => ({
    guides: [],
    availableGuides: [],
    selectedGuide: null,
    isLoading: false,
    error: null,

    fetchGuides: async () => {
        set({ isLoading: true, error: null });
        const { data, isSuccess, error } = await guideService.getAll();
        if (isSuccess && data) {
            set({ guides: data, isLoading: false });
        } else {
            set({ error: error?.message || 'Failed to fetch guides', isLoading: false });
        }
    },

    fetchAvailableGuides: async () => {
        set({ isLoading: true, error: null });
        const { data, isSuccess, error } = await guideService.getAvailableGuides();
        if (isSuccess && data) {
            set({ availableGuides: data, isLoading: false });
        } else {
            set({ error: error?.message || 'Failed to fetch available guides', isLoading: false });
        }
    },

    selectGuide: async (id: string) => {
        set({ isLoading: true, error: null });
        const { data, isSuccess, error } = await guideService.getById(id);
        if (isSuccess && data) {
            set({ selectedGuide: data, isLoading: false });
        } else {
            set({ error: error?.message || 'Failed to select guide', isLoading: false });
        }
    },

    searchByLocation: async (location: string) => {
        set({ isLoading: true, error: null });
        const { data, isSuccess, error } = await guideService.searchByLocation(location);
        if (isSuccess && data) {
            set({ guides: data, isLoading: false });
        } else {
            set({ error: error?.message || 'Failed to search guides', isLoading: false });
        }
    }
}));
