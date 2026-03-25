/* SATHI (PROJECT YATREE) - PRODUCTION BACKEND SCHEMA
  Architecture: Supabase (PostgreSQL + RLS)
  Focus: Tourism, Trust-based Verification, and Scalability.
*/

-- EXTENSIONS & ENUMS
-- Enabling pgcrypto for potential sensitive data encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums for strict data integrity
CREATE TYPE user_role AS ENUM ('tourist', 'guide', 'hotel_owner', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE id_type AS ENUM ('citizenship', 'nid', 'license', 'pan');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'reported');

--  TABLES

-- Profiles: Extends Supabase Auth.users
-- Security: Users cannot change their own 'role' or 'is_verified' status.
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text NOT NULL,
  avatar_url text,
  role user_role DEFAULT 'tourist' NOT NULL,
  is_verified boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now()
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

-- Guides: The public listing table
CREATE TABLE public.guides (
  id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  bio text,
  languages jsonb DEFAULT '["Nepali", "English"]',
  location text,
  hourly_rate numeric(10, 2),
  is_available boolean DEFAULT false NOT NULL,
  avg_rating numeric(2, 1) DEFAULT 0
);

-- Bookings: The link between Tourist and Guide
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES public.profiles(id) NOT NULL,
  guide_id uuid REFERENCES public.guides(id) NOT NULL,
  status booking_status DEFAULT 'pending' NOT NULL,
  hired_at timestamptz DEFAULT now(),
  payment_status text DEFAULT 'unpaid'
);

-- Reviews: Only for completed bookings
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) UNIQUE NOT NULL,
  tourist_id uuid REFERENCES public.profiles(id) NOT NULL,
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
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
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

    UPDATE public.profiles SET is_verified = true, role = NEW.entity_type::user_role WHERE id = NEW.user_id;

    IF NEW.entity_type = 'admin' THEN
      RAISE EXCEPTION 'Cannot promote to Admin via verification request';
    END IF;

    IF NEW.entity_type = 'guide' THEN
      INSERT INTO public.guides (id, is_available) VALUES (NEW.user_id, true)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.profiles SET is_verified = false WHERE id = NEW.user_id;
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
  IF NEW.role <> OLD.role OR NEW.is_verified <> OLD.is_verified THEN
    RAISE EXCEPTION 'You cannot change role or verification status';
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