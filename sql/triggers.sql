-- PROFILE CREATION ON SIGNUP
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

-- VERIFICATION HANDLER
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

CREATE TRIGGER on_verification_status_change
  AFTER UPDATE OF status ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_verification_update();

-- GUIDE RATING AUTOMATION
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

-- STORY COUNTS AUTOMATION
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