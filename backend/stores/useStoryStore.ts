import { create } from 'zustand';
import { Story, CompleteStoryData } from '../schemas';
import { storyService } from '../services';
import { useAuthStore } from './useAuthStore';

interface StoryState {
    stories: Story[];
    currentStory: CompleteStoryData | null;
    isLoading: boolean;
    error: string | null;

    // Getters
    can_edit: () => boolean;
    can_delete: () => boolean;
    is_author: (authorId?: string) => boolean;

    // Core Actions
    fetchStories: () => Promise<void>;
    fetchStoryDetail: (id: string) => Promise<void>;
    createStory: (title: string, description: string, tags: string[]) => Promise<boolean>;
    editStory: (id: string, updates: Partial<Story>) => Promise<boolean>;
    deleteStory: (id: string) => Promise<boolean>;

    // Interactions
    likeStory: (storyId: string) => Promise<void>;
    unlikeStory: (storyId: string) => Promise<void>;
    toggleLike: (storyId: string) => Promise<void>;

    addComment: (storyId: string, content: string) => Promise<void>;



    is_liked: (storyId: string) => boolean;
}

/**
 * useStoryStore
 * Manages the collection of stories and the focused story detail.
 * Integrates with auth store to provide ownership calculations.
 */
export const useStoryStore = create<StoryState>((set, get) => ({
    stories: [],
    currentStory: null,
    isLoading: false,
    error: null,

    // Implementation of Getters
    is_author: (authorId?: string) => {
        const userId = useAuthStore.getState().profile()?.id;
        return !!userId && !!authorId && userId === authorId;
    },

    is_liked: (storyId: string) => {
        const userId = useAuthStore.getState().profile()?.id;
        const story = get().currentStory;
        return !!userId && !!story && story.liked_by.includes(userId);
    },

    can_edit: () => {
        const authorId = get().currentStory?.author.id;
        return get().is_author(authorId);
    },

    can_delete: () => {
        const authorId = get().currentStory?.author.id;
        return get().is_author(authorId);
    },

    /**
     * fetchStories: Fetch list of published stories
     */
    fetchStories: async () => {
        set({ isLoading: true, error: null });
        const result = await storyService.getPublishedStories();
        if (result.isSuccess && result.data) {
            set({ stories: Array.isArray(result.data) ? result.data : [result.data], isLoading: false });
        } else {
            set({ error: (result.backendError as string) || 'Failed to fetch stories', isLoading: false });
        }
    },

    /**
     * fetchStoryDetail: Fetch detailed story info including comments using RPC
     */
    fetchStoryDetail: async (id: string) => {
        set({ isLoading: true, error: null });
        const result = await storyService.getFullStoryData(id);

        // Result is CompleteStoryData | null (ServiceResult.data is T | T[] | null)
        const data = Array.isArray(result.data) ? result.data[0] : result.data;

        if (result.isSuccess && data) {
            set({ currentStory: data, isLoading: false });
        } else {
            set({ error: (result.backendError as string) || 'Failed to fetch story details', isLoading: false });
        }
    },

    /**
     * createStory
     */
    createStory: async (title, description, tags) => {
        const userId = useAuthStore.getState().profile()?.id;
        if (!userId) {
            set({ error: 'Authentication required to create stories' });
            return false;
        }

        set({ isLoading: true, error: null });
        const result = await storyService.createStory({
            uploader_id: userId,
            title,
            description,
            tags,
            is_archived: false,
        });

        if (result.isSuccess) {
            await get().fetchStories(); // Refresh list
            return true;
        } else {
            set({ error: (result.backendError as string) || 'Failed to create story', isLoading: false });
            return false;
        }
    },

    /**
     * editStory
     */
    editStory: async (id, updates) => {
        if (!get().can_edit()) {
            set({ error: 'You do not have permission to edit this story' });
            return false;
        }

        set({ isLoading: true, error: null });
        const result = await storyService.updateStory(id, updates);

        if (result.isSuccess) {
            await get().fetchStoryDetail(id); // Refresh detail
            return true;
        } else {
            set({ error: (result.backendError as string) || 'Update failed', isLoading: false });
            return false;
        }
    },

    /**
     * deleteStory
     */
    deleteStory: async (id) => {
        if (!get().can_delete()) {
            set({ error: 'Permission denied' });
            return false;
        }

        set({ isLoading: true, error: null });
        const result = await storyService.deleteStory(id);

        if (result.isSuccess) {
            await get().fetchStories(); // Refresh list
            return true;
        } else {
            set({ error: (result.backendError as string) || 'Delete failed', isLoading: false });
            return false;
        }
    },

    /**
     * Interactions
     */
    likeStory: async (storyId) => {
        const userId = useAuthStore.getState().profile()?.id;
        if (!userId) return;

        const result = await storyService.likeStory(storyId, userId);
        if (result.isSuccess) {
            // Local state refresh
            await get().fetchStoryDetail(storyId);
        }
    },

    unlikeStory: async (storyId) => {
        const userId = useAuthStore.getState().profile()?.id;
        if (!userId) return;

        const result = await storyService.unlikeStory(storyId, userId);
        if (result.isSuccess) {
            await get().fetchStoryDetail(storyId);
        }
    },

    toggleLike: async (storyId) => {
        const userId = useAuthStore.getState().profile()?.id;
        if (!userId) return;

        const story = get().currentStory;
        if (!story) return;

        if (story.liked_by.includes(userId)) {
            await get().unlikeStory(storyId);
        } else {
            await get().likeStory(storyId);
        }
    },

    addComment: async (storyId, content) => {
        const userId = useAuthStore.getState().profile()?.id;
        if (!userId) return;

        const result = await storyService.addComment(storyId, userId, content);
        if (result.isSuccess) {
            await get().fetchStoryDetail(storyId);
        } else {
            set({ error: (result.backendError as string) || 'Failed to add comment' });
        }
    }
}));
