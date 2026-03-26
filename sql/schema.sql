/* SATHI (PROJECT YATREE) - PRODUCTION BACKEND SCHEMA
  Architecture: Supabase (PostgreSQL + RLS)
  Focus: Tourism, Trust-based Verification, and Scalability.
*/

-- EXTENSIONS & ENUMS
-- Enabling pgcrypto for potential sensitive data encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;
create extension if not exists postgis;

-- We will call the markdown text as GFM
CREATE DOMAIN GFM AS TEXT;

-- Enums for strict data integrity
CREATE TYPE user_role AS ENUM ('tourist', 'guide', 'hotel_owner', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE id_type AS ENUM ('citizenship', 'nid', 'license', 'pan');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'reported');
CREATE TYPE application_status AS ENUM ('approved', 'rejected');

--  TABLES

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
-- Stores sensitive ID data. Entity_type allows adding Hotels/Drivers later.
CREATE TABLE public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  entity_type text DEFAULT 'guide' NOT NULL, -- e.g., 'guide', 'hotel'
  id_type id_type NOT NULL,
  id_number text NOT NULL, -- Recommended: Encrypt this if storing raw
  id_photo_url text NOT NULL, -- Path to private storage bucket
  status verification_status DEFAULT 'pending' NOT NULL,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


CREATE TABLE public.guide_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  document_type id_type NOT NULL ,
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


-- 1. Create the service areas table
CREATE TABLE public.guide_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id uuid REFERENCES public.guides(id) ON DELETE CASCADE NOT NULL,

  -- Use 'geography' for accurate measurements in meters over the Earth's curve
  -- POINT(longitude latitude)
  location geography(POINT, 4326) NOT NULL,


  -- Radius in meters (e.g., 5000 for 5km)
  radius_meters numeric NOT NULL CHECK (radius_meters > 0),
    -- The frontend should ask a map with radius support just like in facebook ads selection

  location_name text, -- Optional: "Itahari Central" or "Dharan Foothills"
  created_at timestamptz DEFAULT now()
);

-- 2. CREATE A SPATIAL INDEX (Crucial for performance)
-- GiST indexes allow the database to search geographical 'boxes' instantly
CREATE INDEX idx_guide_service_areas_location ON public.guide_service_areas USING GIST (location);

-- 3. RLS POLICIES
ALTER TABLE public.guide_service_areas ENABLE ROW LEVEL SECURITY;

-- Everyone can see where a guide works
CREATE POLICY "Service areas are public" ON public.guide_service_areas
FOR SELECT USING (true);

-- Only the guide can manage their own areas
CREATE POLICY "Guides manage own areas" ON public.guide_service_areas
FOR ALL USING (auth.uid() = guide_id);


-- Bookings: The link between Tourist and Guide
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES public.profiles(id) NOT NULL,
  guide_id uuid REFERENCES public.guides(id) NOT NULL,

    -- Pending means the guide havenot accepted it yet,
  status booking_status DEFAULT 'pending' NOT NULL,
  hired_at timestamptz DEFAULT now(),

    destination_location geography(POINT, 4326),
    destination_name text,
    -- payment is must before proceeding
  is_payment_recieved bool DEFAULT false
);

-- Index the booking locations for future analytics
-- (e.g., "Which spots are trending in Itahari?")
CREATE INDEX idx_bookings_destination_location ON public.bookings USING GIST (destination_location);


CREATE OR REPLACE FUNCTION public.find_guides_for_destination(
  dest_lat float,
  dest_lon float
)
RETURNS TABLE (
  guide_id uuid,
  full_name text,
  avatar_url text,
  bio GFM,
  hourly_rate numeric,
  avg_rating numeric,
  distance_from_center float -- Useful if you want to sort by proximity
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    g.bio,
    g.hourly_rate,
    g.avg_rating,
    -- Calculate how far the center of the guide's area is from the chosen spot
    ST_Distance(
      sa.location,
      ST_SetSRID(ST_MakePoint(dest_lon, dest_lat), 4326)::geography
    ) as distance_from_center
  FROM public.guide_service_areas sa
  JOIN public.guides g ON sa.guide_id = g.id
  JOIN public.profiles p ON g.id = p.id
  WHERE
    -- The Core Logic: Is the destination point inside the guide's radius?
    ST_DWithin(
      sa.location,
      ST_SetSRID(ST_MakePoint(dest_lon, dest_lat), 4326)::geography,
      sa.radius_meters
    )
    AND p.is_verified = true
    AND g.is_available = true
  ORDER BY g.avg_rating DESC, distance_from_center ASC;
END;
$$;

/**
  Frontend Implementation (Next.js/Flutter Logic)
When the user selects "Bhedetar Hills Park" on the map, your app should:
Grab the lat and lng from the Google Maps/Leaflet API.
Call the RPC to update the "Available Guides" list instantly.
When the user hits "Confirm Booking," send that point to the bookings table.
 */

-- Reviews: Only for completed bookings
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) UNIQUE NOT NULL,

    -- We dont need tourist id because we can derive it from booking id itself

  guide_id uuid REFERENCES public.guides(id) NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),

  comment text,

  created_at timestamptz DEFAULT now()
);

-- TRIGGERS & FUNCTIONS

-- Function to handle Profile Creation on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, avatar_url, username)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'first_name', 
    new.raw_user_meta_data->>'last_name', 
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql security definer;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to handle Verification Approval
-- When admin sets status to 'approved', it updates profile and creates guide entry.
CREATE OR REPLACE FUNCTION public.handle_verification_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    IF NEW.entity_type NOT IN ('guide', 'tourist', 'hotel_owner') THEN
      RAISE EXCEPTION 'Invalid role assignment';
    END IF;

    IF NEW.entity_type = 'admin' THEN
      RAISE EXCEPTION 'Cannot promote to Admin via verification request';
    END IF;

    UPDATE public.profiles 
    SET is_verified = true, 
        role = NEW.entity_type::user_role,
        is_guide = (NEW.entity_type = 'guide'),
        is_admin = (NEW.entity_type = 'admin')
    WHERE id = NEW.user_id;

    IF NEW.entity_type = 'guide' THEN
      INSERT INTO public.guides (id, is_available) VALUES (NEW.user_id, true)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.profiles SET is_verified = false, is_guide = false WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql security definer;


CREATE OR REPLACE FUNCTION public.update_guide_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE public.guides
  SET avg_rating = (
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM public.reviews
    WHERE guide_id = COALESCE(NEW.guide_id, OLD.guide_id)
  )
  WHERE id = COALESCE(NEW.guide_id, OLD.guide_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql security definer;

CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_guide_rating();



CREATE TRIGGER on_verification_status_change
  AFTER UPDATE OF status ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_verification_update();

-- ROW LEVEL SECURITY (RLS)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Profiles: Everyone can see, only user can update non-critical fields
CREATE POLICY "Public profiles are viewable" ON public.profiles FOR SELECT USING (true);


CREATE OR REPLACE FUNCTION public.prevent_sensitive_profile_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.role <> OLD.role 
     OR NEW.is_verified <> OLD.is_verified 
     OR NEW.is_guide <> OLD.is_guide 
     OR NEW.is_admin <> OLD.is_admin THEN
    RAISE EXCEPTION 'You cannot change role, verification status, or admin/guide flags';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER block_sensitive_profile_changes
BEFORE UPDATE ON public.profiles
FOR EACH ROW
WHEN (auth.uid() = OLD.id)
EXECUTE FUNCTION public.prevent_sensitive_profile_update();




-- Verification: Owners can see/submit, Admins see all
CREATE POLICY "Users view own request" ON public.verification_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users submit request" ON public.verification_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins full access" ON public.verification_requests USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Guides: Only verified guides are visible to the public
CREATE POLICY "Visible verified guides" ON public.guides FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = guides.id AND is_verified = true));

-- Reviews:only tourists who completed a booking can review.
-- 
CREATE POLICY "Verified review insertion" ON public.reviews FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE id = booking_id 
    AND tourist_id = auth.uid()
    AND status = 'completed'
  )
);

CREATE POLICY "Users can update own reviews" ON public.reviews 
FOR UPDATE USING (auth.uid() = tourist_id);

-- Create a private bucket for sensitive identity documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vault', 'vault', false);


-- UPLOAD POLICY


-- Updated Upload Policy with constraints
CREATE POLICY "Users can upload restricted ID docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vault' AND 
  (storage.foldername(name))[1] = auth.uid()::text AND
  (storage.extension(name) = ANY (ARRAY['jpg', 'jpeg', 'png', 'pdf'])) AND
  (metadata->>'size')::int < 10485760
);

-- VIEW POLICY (Owner)
-- Allows users to see/download their own documents
CREATE POLICY "Users can view their own ID documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'vault' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ADMIN POLICY
-- Allows users with the 'admin' role in the profiles table to see all documents
CREATE POLICY "Admins have full access to vault"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'vault' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- DELETE POLICY (Safety)
-- Users can replace their docs, but only admins can truly delete from the vault
CREATE POLICY "Only admins can delete from vault"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vault' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Users can delete own pending docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vault' AND 
  (storage.foldername(name))[1] = auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM public.verification_requests 
    WHERE user_id = auth.uid() AND status = 'pending'
  )
);

-- Performance Enhancement indexes
CREATE INDEX idx_bookings_tourist_id ON public.bookings(tourist_id);
CREATE INDEX idx_bookings_guide_id ON public.bookings(guide_id);
CREATE INDEX idx_verification_user_id ON public.verification_requests(user_id);
CREATE INDEX idx_reviews_guide_id ON public.reviews(guide_id);

--  USER STORIES SECTION
-- Production-grade table for Markdown stories
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  title text NOT NULL,
  description GFM NOT NULL, -- GFM Markdown content

  tags text[] DEFAULT '{}',

  likes_count integer DEFAULT 0 NOT NULL,
  comments_count integer DEFAULT 0 NOT NULL,

    -- Archived means user havent made it public same as draft
  is_archived boolean DEFAULT false NOT NULL,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Story Likes: Trust-based engagement
CREATE TABLE public.story_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- Story Comments: Community interaction
CREATE TABLE public.story_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  content text NOT NULL,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Story Performance Indexes
CREATE INDEX idx_stories_author_id ON public.stories(author_id);
CREATE INDEX idx_stories_is_published ON public.stories(is_published);
CREATE INDEX idx_story_likes_story_id ON public.story_likes(story_id);
CREATE INDEX idx_story_comments_story_id ON public.story_comments(story_id);

-- AUTOMATION: Counts Management
CREATE OR REPLACE FUNCTION public.manage_story_counts()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'story_likes' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.stories SET likes_count = likes_count + 1 WHERE id = NEW.story_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.stories SET likes_count = likes_count - 1 WHERE id = OLD.story_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'story_comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.stories SET comments_count = comments_count + 1 WHERE id = NEW.story_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.stories SET comments_count = comments_count - 1 WHERE id = OLD.story_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql security definer;

CREATE TRIGGER on_story_like_change
  AFTER INSERT OR DELETE ON public.story_likes
  FOR EACH ROW EXECUTE FUNCTION public.manage_story_counts();

CREATE TRIGGER on_story_comment_change
  AFTER INSERT OR DELETE ON public.story_comments
  FOR EACH ROW EXECUTE FUNCTION public.manage_story_counts();

-- RLS: Security Policies
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;

-- Stories: Publicly readable, restricted write
CREATE POLICY "Stories are viewed by everyone" ON public.stories FOR SELECT USING (true);
CREATE POLICY "Users can create stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors manage own stories" ON public.stories FOR ALL USING (auth.uid() = author_id);

-- Likes: Publicly readable, restricted write
CREATE POLICY "Likes are viewed by everyone" ON public.story_likes FOR SELECT USING (true);
CREATE POLICY "Users can like once" ON public.story_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.story_likes FOR DELETE USING (auth.uid() = user_id);

-- Comments: Publicly readable, restricted write
CREATE POLICY "Comments are viewed by everyone" ON public.story_comments FOR SELECT USING (true);
CREATE POLICY "Users can post comments" ON public.story_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own comments" ON public.story_comments FOR ALL USING (auth.uid() = user_id);