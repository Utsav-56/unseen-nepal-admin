-- EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('tourist', 'guide', 'hotel_owner', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE id_type AS ENUM ('citizenship', 'nid', 'license', 'pan');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'reported');

/**
profike is where user stores their profile information
*/

CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text NOT NULL,
  avatar_url text,
  role user_role DEFAULT 'tourist' NOT NULL,
  is_verified boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now()
);

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

CREATE TABLE public.guides (
  id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  bio text,
  languages jsonb DEFAULT '["Nepali", "English"]',
  location text,
  hourly_rate numeric(10, 2),
  is_available boolean DEFAULT false NOT NULL,
  avg_rating numeric(2, 1) DEFAULT 0
);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES public.profiles(id) NOT NULL,
  guide_id uuid REFERENCES public.guides(id) NOT NULL,
  status booking_status DEFAULT 'pending' NOT NULL,
  hired_at timestamptz DEFAULT now(),
  payment_status text DEFAULT 'unpaid'
);

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) UNIQUE NOT NULL,
  tourist_id uuid REFERENCES public.profiles(id) NOT NULL,
  guide_id uuid REFERENCES public.guides(id) NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vault', 'vault', false);

-- INDEXES
CREATE INDEX idx_bookings_tourist_id ON public.bookings(tourist_id);
CREATE INDEX idx_bookings_guide_id ON public.bookings(guide_id);
CREATE INDEX idx_verification_user_id ON public.verification_requests(user_id);
CREATE INDEX idx_reviews_guide_id ON public.reviews(guide_id);