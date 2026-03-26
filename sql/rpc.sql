/**
Returns the complete user profile including the guide data and service areas

uf he/she is guide then it will also return guide data and service areas
or else if not then the guide data is null
but the other data will always be there
*/
CREATE OR REPLACE FUNCTION public.get_complete_user_profile(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'id', p.id,
        'created_at', p.created_at,
        'profile', p.*,
        'guide_data', (
            SELECT to_jsonb(g.*)
            FROM public.guides g
            WHERE g.id = p.id
        ),
        'service_areas', (
            SELECT jsonb_agg(sa.*)
            FROM public.guide_service_areas sa
            WHERE sa.guide_id = p.id
        ),
        'is_onbording_completed', p.onboarding_completed
    ) INTO result
    FROM public.profiles p
    WHERE p.id = user_id;

    RETURN result;
END;
$$;


-- RPC FUNCTION for handling the processing in the server side and returning the result to the client
CREATE OR REPLACE FUNCTION public.find_guides_for_destination(
  dest_lat float,
  dest_lon float
)
RETURNS TABLE (
  guide_id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  bio GFM,
  hourly_rate numeric,
  avg_rating numeric,
  distance_from_center float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    g.bio,
    g.hourly_rate,
    g.avg_rating,
    ST_Distance(
      sa.location,
      ST_SetSRID(ST_MakePoint(dest_lon, dest_lat), 4326)::geography
    ) as distance_from_center
  FROM public.guide_service_areas sa
  JOIN public.guides g ON sa.guide_id = g.id
  JOIN public.profiles p ON g.id = p.id
  WHERE
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


CREATE OR REPLACE VIEW public.minimal_user_info AS
SELECT 
    id, 
    COALESCE(first_name || ' ' || last_name, username) as full_name, 
    username, 
    avatar_url
FROM public.profiles;

CREATE OR REPLACE FUNCTION public.get_full_story_data(target_story_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'description', s.description,
        'tags', s.tags,
        'likes_count', s.likes_count,
        'comments_count', s.comments_count,
        'is_archived', s.is_archived,
        'created_at', s.created_at,
        'updated_at', s.updated_at,
        
        -- Author Object
        'author', (
            SELECT jsonb_build_object(
                'id', m.id,
                'name', m.full_name,
                'username', m.username,
                'avatar', m.avatar_url
            )
            FROM public.minimal_user_info m
            WHERE m.id = s.uploader_id
        ),

        -- Top 10 Comments (Still nested objects)
        'comments', (
            SELECT COALESCE(jsonb_agg(comment_node), '[]'::jsonb)
            FROM (
                SELECT jsonb_build_object(
                    'id', sc.id,
                    'content', sc.content,
                    'created_at', sc.created_at,
                    'user', (
                        SELECT jsonb_build_object(
                            'id', mu.id,
                            'name', mu.full_name,
                            'username', mu.username,
                            'avatar', mu.avatar_url
                        )
                        FROM public.minimal_user_info mu
                        WHERE mu.id = sc.user_id
                    )
                ) as comment_node
                FROM public.story_comments sc
                WHERE sc.story_id = s.id
                ORDER BY sc.created_at DESC
                LIMIT 10
            ) sub
        ),

        -- Liked By UUID Array
        'liked_by', (
            SELECT COALESCE(array_agg(user_id), '{}'::uuid[])
            FROM public.story_likes
            WHERE story_id = s.id
        )
    ) INTO result
    FROM public.stories s
    WHERE s.id = target_story_id AND s.is_archived = false;

    RETURN result;
END;
$$;