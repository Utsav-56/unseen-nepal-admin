-- EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS pgcrypto;
create extension if not exists postgis;

-- We will call the markdown text as GFM
CREATE DOMAIN GFM AS TEXT;

-- Enums for strict data integrity
CREATE TYPE user_role AS ENUM ('tourist', 'guide', 'hotel_owner', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE id_type AS ENUM ('citizenship', 'nid', 'license', 'pan');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'reported');
CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');

-- TABLES

-- Profiles: Extends Supabase Auth.users
-- Security: Users cannot change their own 'role', 'is_verified', 'is_guide', or 'is_admin' status.
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  first_name text,
  middle_name text,
  last_name text,
  username text UNIQUE,
  phone_number text,
  emergency_contact text,
  avatar_url text,
  role user_role DEFAULT 'tourist' NOT NULL,
  
  onboarding_completed boolean DEFAULT false NOT NULL,
  preferences text[] DEFAULT '{}',
  home_location geography(POINT, 4326),

  is_verified boolean DEFAULT false NOT NULL,
  is_guide boolean DEFAULT false NOT NULL,
  is_admin boolean DEFAULT false NOT NULL,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Verification Requests: The "Trust" engine
CREATE TABLE public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  entity_type text DEFAULT 'guide' NOT NULL,
  id_type id_type NOT NULL,
  id_number text NOT NULL,
  id_photo_url text NOT NULL,
  status verification_status DEFAULT 'pending' NOT NULL,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Guide Applications
CREATE TABLE public.guide_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  document_type id_type NOT NULL,
  description GFM,
  previous_experience TEXT,
  known_languages jsonb DEFAULT '[]',
  status application_status default 'pending' not null,
  admin_feedback GFM,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Guides: The public listing table
CREATE TABLE public.guides (
  id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  bio GFM,
  known_languages jsonb DEFAULT '["Nepali"]',
  location text,
  hourly_rate numeric(10, 2),
  is_available boolean DEFAULT false NOT NULL,
  avg_rating numeric(2, 1) DEFAULT 0
);

-- Service Areas
CREATE TABLE public.guide_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id uuid REFERENCES public.guides(id) ON DELETE CASCADE NOT NULL,
  location geography(POINT, 4326) NOT NULL,
  radius_meters numeric NOT NULL CHECK (radius_meters > 0),
  location_name text,
  created_at timestamptz DEFAULT now()
);

-- Bookings: The link between Tourist and Guide
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES public.profiles(id) NOT NULL,
  guide_id uuid REFERENCES public.guides(id) NOT NULL,
  status booking_status DEFAULT 'pending' NOT NULL,
  hired_at timestamptz DEFAULT now(),
  destination_location geography(POINT, 4326),
  destination_name text,
  is_payment_recieved bool DEFAULT false
);

-- Reviews: Only for completed bookings
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) UNIQUE NOT NULL,
  guide_id uuid REFERENCES public.guides(id) NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- USER STORIES SECTION
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description GFM NOT NULL,
  tags text[] DEFAULT '{}',
  likes_count integer DEFAULT 0 NOT NULL,
  comments_count integer DEFAULT 0 NOT NULL,
  is_archived boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Story Likes
CREATE TABLE public.story_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- Story Comments
CREATE TABLE public.story_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- INDEXES
CREATE INDEX idx_guide_service_areas_location ON public.guide_service_areas USING GIST (location);
CREATE INDEX idx_bookings_destination_location ON public.bookings USING GIST (destination_location);
CREATE INDEX idx_bookings_tourist_id ON public.bookings(tourist_id);
CREATE INDEX idx_bookings_guide_id ON public.bookings(guide_id);
CREATE INDEX idx_verification_user_id ON public.verification_requests(user_id);
CREATE INDEX idx_reviews_guide_id ON public.reviews(guide_id);
CREATE INDEX idx_stories_uploader_id ON public.stories(uploader_id);
CREATE INDEX idx_stories_is_archived ON public.stories(is_archived);
CREATE INDEX idx_story_likes_story_id ON public.story_likes(story_id);
CREATE INDEX idx_story_comments_story_id ON public.story_comments(story_id);

