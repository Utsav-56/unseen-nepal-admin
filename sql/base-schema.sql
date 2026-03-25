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

-- USER STORIES (BLOG/MOMENTS)
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL, -- GFM Markdown
  featured_image_url text,
  tags text[] DEFAULT '{}',
  likes_count integer DEFAULT 0 NOT NULL,
  comments_count integer DEFAULT 0 NOT NULL,
  is_published boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.story_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(story_id, user_id)
);

CREATE TABLE public.story_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- STORY INDEXES
CREATE INDEX idx_stories_author_id ON public.stories(author_id);
CREATE INDEX idx_story_likes_story_id ON public.story_likes(story_id);
CREATE INDEX idx_story_comments_story_id ON public.story_comments(story_id);

-- TRIGGERS FOR COUNTS
CREATE OR REPLACE FUNCTION public.update_story_likes_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stories SET likes_count = likes_count + 1 WHERE id = NEW.story_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.stories SET likes_count = likes_count - 1 WHERE id = OLD.story_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql security definer;

CREATE TRIGGER on_story_like_change
  AFTER INSERT OR DELETE ON public.story_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_story_likes_count();

CREATE OR REPLACE FUNCTION public.update_story_comments_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stories SET comments_count = comments_count + 1 WHERE id = NEW.story_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.stories SET comments_count = comments_count - 1 WHERE id = OLD.story_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql security definer;

CREATE TRIGGER on_story_comment_change
  AFTER INSERT OR DELETE ON public.story_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_story_comments_count();

-- RLS POLICIES FOR STORIES
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;

-- Stories: Read by everyone, write by author
CREATE POLICY "Stories are publicly viewable" ON public.stories FOR SELECT USING (true);
CREATE POLICY "Authors can insert stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update own stories" ON public.stories FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete own stories" ON public.stories FOR DELETE USING (auth.uid() = author_id);

-- Likes: Read by everyone, write by authenticated user
CREATE POLICY "Story likes are publicly viewable" ON public.story_likes FOR SELECT USING (true);
CREATE POLICY "Auth users can like stories" ON public.story_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike stories" ON public.story_likes FOR DELETE USING (auth.uid() = user_id);

-- Comments: Read by everyone, write by authenticated user
CREATE POLICY "Story comments are publicly viewable" ON public.story_comments FOR SELECT USING (true);
CREATE POLICY "Auth users can comment on stories" ON public.story_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.story_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.story_comments FOR DELETE USING (auth.uid() = user_id);