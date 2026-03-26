import { SupabaseService } from "../../supabase/supabaseService";
import { Story, StorySchema, StoryLike, StoryComment } from "../schemas";

class StoryService extends SupabaseService<Story> {
    constructor() {
        super('stories', StorySchema);
    }

    /**
     * Get published stories with author details
     */
    async getPublishedStories() {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*, author:profiles(*)')
                .eq('is_published', true)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as (Story & { author: any })[];
        });
    }

    /**
     * Get stories by a specific author
     */
    async getStoriesByAuthor(authorId: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('author_id', authorId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as Story[];
        });
    }

    /**
     * Like a story
     * Note: Counter is handled by DB trigger
     */
    async likeStory(storyId: string, userId: string) {
        const { data, error } = await this.supabase
            .from('story_likes')
            .insert({ story_id: storyId, user_id: userId })
            .select()
            .single();
        if (error) throw error;
        return data as StoryLike;
    }

    /**
     * Unlike a story
     * Note: Counter is handled by DB trigger
     */
    async unlikeStory(storyId: string, userId: string) {
        const { error } = await this.supabase
            .from('story_likes')
            .delete()
            .match({ story_id: storyId, user_id: userId });
        if (error) throw error;
        return true;
    }



    /**
     * Add a comment to a story
     * Note: Counter is handled by DB trigger
     */
    async addComment(storyId: string, userId: string, content: string) {
        const { data, error } = await this.supabase
            .from('story_comments')
            .insert({ story_id: storyId, user_id: userId, content })
            .select()
            .single();
        if (error) throw error;
        return data as StoryComment;
    }

    /**
     * Get comments for a story with user profile info
     */
    async getComments(storyId: string) {
        const { data, error } = await this.supabase
            .from('story_comments')
            .select('*, user:profiles(full_name, avatar_url)')
            .eq('story_id', storyId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data;
    }

    /**
     * Check if a user has liked a story
     */
    async hasUserLiked(storyId: string, userId: string): Promise<boolean> {
        const { count, error } = await this.supabase
            .from('story_likes')
            .select('*', { count: 'exact', head: true })
            .match({ story_id: storyId, user_id: userId });

        if (error) return false;
        return (count ?? 0) > 0;
    }
}

export const storyService = new StoryService();
