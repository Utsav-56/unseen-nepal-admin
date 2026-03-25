-- ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Public profiles are viewable"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own info"
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (role = role AND is_verified = is_verified);


-- VERIFICATION REQUESTS
CREATE POLICY "Users view own request"
ON public.verification_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users submit request"
ON public.verification_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins full access"
ON public.verification_requests
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);


-- GUIDES
CREATE POLICY "Visible verified guides"
ON public.guides FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = guides.id AND is_verified = true
  )
);


-- REVIEWS
CREATE POLICY "Verified review insertion"
ON public.reviews FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE id = booking_id 
    AND tourist_id = auth.uid()
    AND status = 'completed'
  )
);

CREATE POLICY "Users can update own reviews"
ON public.reviews FOR UPDATE
USING (auth.uid() = tourist_id);


-- STORAGE POLICIES

CREATE POLICY "Users can upload restricted ID docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vault' AND 
  (storage.foldername(name))[1] = auth.uid()::text AND
  (storage.extension(name) = ANY (ARRAY['jpg', 'jpeg', 'png', 'pdf'])) AND
  (octet_length(content) < 5242880)
);

CREATE POLICY "Users can view their own ID documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'vault' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins have full access to vault"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'vault' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

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