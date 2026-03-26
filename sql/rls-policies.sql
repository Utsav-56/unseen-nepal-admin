-- ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;

-- PROFILES
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


-- GUIDE APPLICATIONS
CREATE POLICY "Users view own application" ON public.guide_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users submit application" ON public.guide_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins full access" ON public.guide_applications USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- GUIDES
CREATE POLICY "Visible verified guides" ON public.guides FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = guides.id AND is_verified = true));

-- SERVICE AREAS
CREATE POLICY "Service areas are public" ON public.guide_service_areas FOR SELECT USING (true);
CREATE POLICY "Guides manage own areas" ON public.guide_service_areas FOR ALL USING (auth.uid() = guide_id);

-- REVIEWS
CREATE POLICY "Verified review insertion" ON public.reviews FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE id = booking_id 
    AND tourist_id = auth.uid()
    AND status = 'completed'
  )
);
CREATE POLICY "Users can update own reviews" ON public.reviews FOR UPDATE USING (auth.uid() = tourist_id);

-- STORAGE (Vault Bucket)
-- Bucket creation
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vault', 'vault', false)
ON CONFLICT (id) DO NOTHING;

-- UPLOAD POLICY
CREATE POLICY "Users can upload restricted ID docs" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vault' AND 
  (storage.foldername(name))[1] = auth.uid()::text AND
  (storage.extension(name) = ANY (ARRAY['jpg', 'jpeg', 'png', 'pdf'])) AND
  (metadata->>'size')::int < 10485760
);

-- VIEW POLICY
CREATE POLICY "Users can view their own ID documents" ON storage.objects FOR SELECT
USING (
  bucket_id = 'vault' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ADMIN POLICY
CREATE POLICY "Admins have full access to vault" ON storage.objects FOR SELECT
USING (
  bucket_id = 'vault' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- DELETE POLICY
CREATE POLICY "Only admins can delete from vault" ON storage.objects FOR DELETE
USING (
  bucket_id = 'vault' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Users can delete own pending docs" ON storage.objects FOR DELETE
USING (
  bucket_id = 'vault' AND 
  (storage.foldername(name))[1] = auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM public.guide_applications 
    WHERE user_id = auth.uid() AND status = 'pending'
  )
);

-- STORIES
CREATE POLICY "Stories are viewed by everyone" ON public.stories FOR SELECT USING (true);
CREATE POLICY "Users can create stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors manage own stories" ON public.stories FOR ALL USING (auth.uid() = author_id);

-- LIKES
CREATE POLICY "Likes are viewed by everyone" ON public.story_likes FOR SELECT USING (true);
CREATE POLICY "Users can like once" ON public.story_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.story_likes FOR DELETE USING (auth.uid() = user_id);

-- COMMENTS
CREATE POLICY "Comments are viewed by everyone" ON public.story_comments FOR SELECT USING (true);
CREATE POLICY "Users can post comments" ON public.story_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own comments" ON public.story_comments FOR ALL USING (auth.uid() = user_id);