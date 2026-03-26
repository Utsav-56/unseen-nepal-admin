import { SupabaseService } from "../../supabase/supabaseService";
import {
    Story,
    StorySchema,
    StoryLike,
    StoryComment,
    CompleteStoryData,
    CompleteStoryDataSchema
} from "../schemas";

/**
 * StoryService
 * Handles all story related operations including CRUD, likes, and comments.
 */
class StoryService extends SupabaseService<Story> {
    constructor() {
        super('stories', StorySchema);
    }

    /**
     * Get published stories with basic author details
     * This is useful for list views
     */
    async getPublishedStories() {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*, author:profiles(first_name, last_name, avatar_url, username)')
                .eq('is_archived', false)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        });
    }

    /**
     * Get full story data for a single story page
     * Calls the get_full_story_data RPC
     */
    async getFullStoryData(storyId: string) {
        return this.execute(async () => {
            const data = await this.callRpc<CompleteStoryData>('get_full_story_data', {
                target_story_id: storyId
            });

            // Optional: Validate with Zod for production-grade robustness
            if (data) {
                const validation = CompleteStoryDataSchema.safeParse(data);
                if (!validation.success) {
                    console.error("Story Data validation failed:", validation.error);
                }
            }

            return data;
        }, null);
    }

    /**
     * Create a new story
     */
    async createStory(payload: Omit<Story, 'id' | 'created_at' | 'likes_count' | 'comments_count'>) {
        return this.create(payload as any);
    }

    /**
     * Update an existing story
     */
    async updateStory(id: string, payload: Partial<Story>) {
        return this.update(id, payload);
    }

    /**
     * Delete a story
     */
    async deleteStory(id: string) {
        return this.delete(id);
    }

    /**
     * Like a story
     * Counter is updated via DB trigger
     */
    async likeStory(storyId: string, userId: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from('story_likes')
                .insert({ story_id: storyId, user_id: userId })
                .select()
                .single();
            if (error) throw error;
            return data as StoryLike;
        });
    }

    /**
     * Unlike a story
     * Counter is updated via DB trigger
     */
    async unlikeStory(storyId: string, userId: string) {
        return this.execute(async () => {
            const { error } = await this.supabase
                .from('story_likes')
                .delete()
                .match({ story_id: storyId, user_id: userId });
            if (error) throw error;
            return true;
        });
    }

    /**
     * Add a comment to a story
     * Counter is updated via DB trigger
     */
    async addComment(storyId: string, userId: string, content: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from('story_comments')
                .insert({ story_id: storyId, user_id: userId, content })
                .select()
                .single();
            if (error) throw error;
            return data as StoryComment;
        });
    }

    /**
     * Check if a user has liked a story
     */
    async hasUserLiked(storyId: string, userId: string) {
        return this.execute(async () => {
            const { count, error } = await this.supabase
                .from('story_likes')
                .select('*', { count: 'exact', head: true })
                .match({ story_id: storyId, user_id: userId });
            if (error) throw error;
            return (count ?? 0) > 0;
        });
    }
}

export const storyService = new StoryService();
