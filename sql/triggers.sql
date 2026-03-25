-- PROFILE CREATION
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


-- VERIFICATION HANDLER
CREATE OR REPLACE FUNCTION public.handle_verification_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'approved' THEN

    IF NEW.entity_type = 'admin' THEN
      RAISE EXCEPTION 'Cannot promote to Admin via verification request';
    END IF;

    UPDATE public.profiles 
    SET is_verified = true, role = NEW.entity_type::user_role 
    WHERE id = NEW.user_id;

    IF NEW.entity_type = 'guide' THEN
      INSERT INTO public.guides (id, is_available)
      VALUES (NEW.user_id, true)
      ON CONFLICT (id) DO NOTHING;
    END IF;

  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.profiles 
    SET is_verified = false 
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql security definer;

CREATE TRIGGER on_verification_status_change
AFTER UPDATE OF status ON public.verification_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_verification_update();


-- GUIDE RATING UPDATE
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