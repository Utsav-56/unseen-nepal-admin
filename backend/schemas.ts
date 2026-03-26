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

export const ApplicationStatus = z.enum(['pending', 'approved', 'rejected']);
export type ApplicationStatus = z.infer<typeof ApplicationStatus>;

// Base Zod schema that matches BaseEntity
export const BaseSchema = z.object({
    id: z.string().uuid().optional(), // Optional for creates
    created_at: z.string().optional(),
});

/**
 * Geo Point Schema for PostGIS
 */
export const GeoPointSchema = z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]), // [longitude, latitude]
});

/**
 * Profiles Schema
 */
export const ProfileSchema = BaseSchema.extend({

    // these are not defined in the base schema but will be in response
    id: z.string().uuid().optional(),
    created_at: z.string().optional(),

    first_name: z.string().nullable().optional(),
    middle_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),

    username: z.string().min(3, "Username must be at least 3 characters").nullable().optional(),
    phone_number: z.string().nullable().optional(),
    emergency_contact: z.string().nullable().optional(),
    avatar_url: z.string().url("Invalid avatar URL").nullable().optional(),
    role: UserRole.default('tourist'),

    onboarding_completed: z.boolean().default(false),
    preferences: z.array(z.string()).default([]),
    home_location: z.union([z.string(), GeoPointSchema]).nullable().optional(),

    is_verified: z.boolean().default(false),
    is_guide: z.boolean().default(false),
    is_admin: z.boolean().default(false),
    updated_at: z.string().optional(),
});
export type Profile = z.infer<typeof ProfileSchema> & BaseEntity;



/**
 * Minimal user means a minimum public info of the user 
 * it is used in places like comments, stories or bookings
 */
/**
 * Minimal User Card (The DRY interface)
 */
export const MinimalUserSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    username: z.string(),
    avatar: z.string().url().nullable(),
});


/**
 * Guide Applications Schema
 */
export const GuideApplicationSchema = BaseSchema.extend({
    user_id: z.string().uuid(),
    document_type: IdType,
    id_number: z.string().min(1, "ID number is required"),
    id_photo_url: z.string().min(1, "ID photo URL is required"), // Secure path

    description: z.string().nullable().optional(),
    previous_experience: z.string().nullable().optional(),
    known_languages: z.array(z.string()).default([]),
    status: ApplicationStatus.default('pending'),
    admin_feedback: z.string().nullable().optional(),
    updated_at: z.string().optional(),
});
export type GuideApplication = z.infer<typeof GuideApplicationSchema> & BaseEntity;

/**
 * Guides Schema
 */
export const GuideSchema = BaseSchema.extend({
    bio: z.string().nullable().optional(),
    known_languages: z.array(z.string()).default(["Nepali"]),
    location: z.string().nullable().optional(),
    hourly_rate: z.number().nullable().optional(),
    is_available: z.boolean().default(false),
    avg_rating: z.number().default(0),
});
export type Guide = z.infer<typeof GuideSchema> & BaseEntity;

/**
 * Guide Service Areas Schema
 */
export const GuideServiceAreaSchema = BaseSchema.extend({
    guide_id: z.string().uuid(),
    location: z.union([z.string(), GeoPointSchema]),
    radius_meters: z.number().positive(),
    location_name: z.string().nullable().optional(),
});
export type GuideServiceArea = z.infer<typeof GuideServiceAreaSchema> & BaseEntity;


/**
 * Complete User Profile Schema
 * this will be returned by the get_complete_user_profile rpc function
 * always use this data on stores because it is the most complete data in single call
 * 
 */
export const CompleteUserProfileSchema = BaseSchema.extend({
    profile: ProfileSchema,
    guide_data: GuideSchema.nullable().optional(),
    service_areas: z.array(GuideServiceAreaSchema).nullable().optional(),
    is_onboarding_completed: z.boolean().default(false),
});
export type CompleteUserProfile = z.infer<typeof CompleteUserProfileSchema> & BaseEntity;

/**
 * Bookings Schema
 */
export const BookingSchema = BaseSchema.extend({
    tourist_id: z.string().uuid("Invalid tourist ID"),
    guide_id: z.string().uuid("Invalid guide ID"),

    start_date: z.string(), // ISO date string (YYYY-MM-DD)
    end_date: z.string(), // ISO date string (YYYY-MM-DD)
    total_amount: z.number().min(0, "Amount cannot be negative"),
    message: z.string().nullable().optional(),

    status: BookingStatus.default('pending'),
    hired_at: z.string().optional(),
    destination_location: z.union([z.string(), GeoPointSchema]).nullable().optional(),
    destination_name: z.string().nullable().optional(),
    is_payment_recieved: z.boolean().default(false),
});

export type Booking = z.infer<typeof BookingSchema> & BaseEntity;


/**
 * Complete Booking Hydration Schema
 * Used to show detailed booking overview with linked profiles
 */
export const CompleteBookingDataSchema = BookingSchema.extend({
    guide: MinimalUserSchema.optional(),
    tourist: MinimalUserSchema.optional(),
});

export type CompleteBookingData = z.infer<typeof CompleteBookingDataSchema> & BaseEntity;

/**
 * Reviews Schema
 */
export const ReviewSchema = BaseSchema.extend({
    booking_id: z.string().uuid("Invalid booking ID"),
    guide_id: z.string().uuid("Invalid guide ID"),
    rating: z.number().min(1).max(5, "Rating must be between 1 and 5"),
    comment: z.string().nullable().optional(),
});
export type Review = z.infer<typeof ReviewSchema> & BaseEntity;

/**
 * Stories Schema
 */
export const StorySchema = BaseSchema.extend({
    uploader_id: z.string().uuid(),
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    tags: z.array(z.string()).default([]),
    likes_count: z.number().default(0),
    comments_count: z.number().default(0),
    is_archived: z.boolean().default(false),
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


/**
 * Complete Story Schema
 * this will be returned by the get_full_story_data rpc function
 * always use this data on stores because it is the most complete data in single call
 */
export const CompleteStoryDataSchema = StorySchema.omit({ uploader_id: true }).extend({
    author: MinimalUserSchema,
    comments: z.array(z.object({
        id: z.string().uuid(),
        content: z.string(),
        created_at: z.string(),
        user: MinimalUserSchema
    })).default([]),
    liked_by: z.array(z.string().uuid()).default([]),
});

export type CompleteStoryData = z.infer<typeof CompleteStoryDataSchema> & BaseEntity;


/**
 * Complete Guide Profile Schema
 * Used for initial hydration of the guide profile page via get_full_guide_data RPC
 */
export const CompleteGuideDataSchema = z.object({
    id: z.string().uuid(),
    full_name: z.string(),
    username: z.string(),
    avatar_url: z.string().url().nullable(),
    is_verified: z.boolean(),

    bio: z.string().nullable().optional(),
    known_languages: z.array(z.string()).default(["Nepali"]),
    hourly_rate: z.number().nullable().optional(),
    avg_rating: z.number().default(0),
    is_available: z.boolean().default(false),

    service_areas: z.array(z.object({
        id: z.string().uuid(),
        location_name: z.string().nullable().optional(),
        radius_meters: z.number(),
        coordinates: z.tuple([z.number(), z.number()]), // [longitude, latitude]
    })).default([]),

    reviews: z.array(z.object({
        id: z.string().uuid(),
        rating: z.number(),
        comment: z.string().nullable().optional(),
        created_at: z.string(),
        reviewer: MinimalUserSchema
    })).default([]),
});

export type CompleteGuideData = z.infer<typeof CompleteGuideDataSchema>;
