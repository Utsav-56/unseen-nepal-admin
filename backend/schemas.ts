import { z } from "zod";
import { BaseEntity } from "../supabase/schemas";

// Enums from SQL schema
export const UserRole = z.enum(['tourist', 'guide', 'hotel_owner', 'admin']);
export type UserRole = z.infer<typeof UserRole>;

export const VerificationStatus = z.enum(['pending', 'approved', 'rejected']);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

export const IdType = z.enum(['citizenship', 'nid', 'license', 'pan']);
export type IdType = z.infer<typeof IdType>;

export const BookingStatus = z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'reported']);
export type BookingStatus = z.infer<typeof BookingStatus>;

// Base Zod schema that matches BaseEntity
export const BaseSchema = z.object({
    id: z.string().uuid(),
    created_at: z.string(),
});

/**
 * Profiles Schema
 */
export const ProfileSchema = BaseSchema.extend({
    full_name: z.string().min(1, "Full name is required"),
    avatar_url: z.string().url("Invalid avatar URL").nullable().optional(),
    role: UserRole.default('tourist'),
    is_verified: z.boolean().default(false),
});
export type Profile = z.infer<typeof ProfileSchema> & BaseEntity;

/**
 * Verification Requests Schema
 */
export const VerificationRequestSchema = BaseSchema.extend({
    user_id: z.string().uuid("Invalid user ID"),
    entity_type: z.string().default('guide'),
    id_type: IdType,
    id_number: z.string().min(1, "ID number is required"),
    id_photo_url: z.string().min(1, "ID photo URL is required"),
    status: VerificationStatus.default('pending'),
    admin_notes: z.string().nullable().optional(),
    updated_at: z.string().optional(),
});
export type VerificationRequest = z.infer<typeof VerificationRequestSchema> & BaseEntity;

/**
 * Guides Schema
 */
export const GuideSchema = BaseSchema.extend({
    bio: z.string().nullable().optional(),
    languages: z.any().default(["Nepali", "English"]),
    location: z.string().nullable().optional(),
    hourly_rate: z.number().nullable().optional(),
    is_available: z.boolean().default(false),
    avg_rating: z.number().default(0),
});
export type Guide = z.infer<typeof GuideSchema> & BaseEntity;

/**
 * Bookings Schema
 */
export const BookingSchema = BaseSchema.extend({
    tourist_id: z.string().uuid("Invalid tourist ID"),
    guide_id: z.string().uuid("Invalid guide ID"),
    status: BookingStatus.default('pending'),
    hired_at: z.string().optional(),
    payment_status: z.string().default('unpaid').nullable().optional(),
});
export type Booking = z.infer<typeof BookingSchema> & BaseEntity;

/**
 * Reviews Schema
 */
export const ReviewSchema = BaseSchema.extend({
    booking_id: z.string().uuid("Invalid booking ID"),
    tourist_id: z.string().uuid("Invalid tourist ID"),
    guide_id: z.string().uuid("Invalid guide ID"),
    rating: z.number().min(1).max(5, "Rating must be between 1 and 5"),
    comment: z.string().nullable().optional(),
});
export type Review = z.infer<typeof ReviewSchema> & BaseEntity;

/**
 * Stories Schema
 */
export const StorySchema = BaseSchema.extend({
    author_id: z.string().uuid(),
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Content is required"),
    featured_image_url: z.string().url().nullable().optional(),
    tags: z.array(z.string()).default([]),
    likes_count: z.number().default(0),
    comments_count: z.number().default(0),
    is_published: z.boolean().default(true),
    updated_at: z.string().optional(),
});
export type Story = z.infer<typeof StorySchema> & BaseEntity;

/**
 * Story Likes Schema
 */
export const StoryLikeSchema = BaseSchema.extend({
    story_id: z.string().uuid(),
    user_id: z.string().uuid(),
});
export type StoryLike = z.infer<typeof StoryLikeSchema> & BaseEntity;

/**
 * Story Comments Schema
 */
export const StoryCommentSchema = BaseSchema.extend({
    story_id: z.string().uuid(),
    user_id: z.string().uuid(),
    content: z.string().min(1, "Comment content is required"),
    updated_at: z.string().optional(),
});
export type StoryComment = z.infer<typeof StoryCommentSchema> & BaseEntity;

