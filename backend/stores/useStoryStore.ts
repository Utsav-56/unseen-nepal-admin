import { create } from 'zustand';
import { Story } from '../schemas';
import { storyService } from '../services';

interface StoryState {
    stories: Story[];
    currentStory: Story | null;
    isLoading: boolean;
    error: string | null;

    fetchStories: () => Promise<void>;
    fetchStoryById: (id: string) => Promise<void>;
    likeStory: (storyId: string, userId: string) => Promise<void>;
    unlikeStory: (storyId: string, userId: string) => Promise<void>;
    addComment: (storyId: string, userId: string, content: string) => Promise<void>;
}

export const useStoryStore = create<StoryState>((set, get) => ({
    stories: [],
    currentStory: null,
    isLoading: false,
    error: null,

    fetchStories: async () => {
        set({ isLoading: true, error: null });
        const result = await storyService.getPublishedStories();
        if (result.isSuccess && result.data) {
            set({ stories: result.data, isLoading: false });
        } else {
            set({ error: result.error?.message || 'Failed to fetch stories', isLoading: false });
        }
    },

    fetchStoryById: async (id: string) => {
        set({ isLoading: true, error: null });
        const result = await storyService.getById(id);
        if (result.isSuccess && result.data) {
            set({ currentStory: result.data, isLoading: false });
        } else {
            set({ error: result.error?.message || 'Failed to fetch story', isLoading: false });
        }
    },

    likeStory: async (storyId: string, userId: string) => {
        try {
            await storyService.likeStory(storyId, userId);
            // Update local state is more optimized but for now we refresh
            get().fetchStoryById(storyId);
        } catch (err: any) {
            set({ error: err.message });
        }
    },

    unlikeStory: async (storyId: string, userId: string) => {
        try {
            await storyService.unlikeStory(storyId, userId);
            get().fetchStoryById(storyId);
        } catch (err: any) {
            set({ error: err.message });
        }
    },

    addComment: async (storyId: string, userId: string, content: string) => {
        try {
            await storyService.addComment(storyId, userId, content);
            get().fetchStoryById(storyId);
        } catch (err: any) {
            set({ error: err.message });
        }
    }
}));
