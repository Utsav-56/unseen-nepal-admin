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




/**
Used for initial hydration of the guide profile page
then the need data will be granularly requested
*/
CREATE OR REPLACE FUNCTION public.get_full_guide_data(target_guide_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        -- Profile & Identity
        'id', p.id,
        'full_name', p.first_name || ' ' || COALESCE(p.middle_name || ' ', '') || p.last_name,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'is_verified', p.is_verified,
        
        -- Guide Specifics
        'bio', g.bio,
        'known_languages', g.known_languages,
        'hourly_rate', g.hourly_rate,
        'avg_rating', g.avg_rating,
        'is_available', g.is_available,

        -- Service Areas (PostGIS Geography to GeoJSON)
        'service_areas', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', sa.id,
                'location_name', sa.location_name,
                'radius_meters', sa.radius_meters,
                'coordinates', ST_AsGeoJSON(sa.location)::jsonb->'coordinates'
            )), '[]'::jsonb)
            FROM public.guide_service_areas sa
            WHERE sa.guide_id = g.id
        ),

        -- Reviews with Reviewer Info
        'reviews', (
            SELECT COALESCE(jsonb_agg(review_node), '[]'::jsonb)
            FROM (
                SELECT jsonb_build_object(
                    'id', r.id,
                    'rating', r.rating,
                    'comment', r.comment,
                    'created_at', r.created_at,
                    'reviewer', (
                        SELECT jsonb_build_object(
                            'id', m.id,
                            'name', m.full_name,
                            'username', m.username,
                            'avatar', m.avatar_url
                        )
                        FROM public.minimal_user_info m
                        WHERE m.id = (SELECT tourist_id FROM public.bookings WHERE id = r.booking_id)
                    )
                ) as review_node
                FROM public.reviews r
                WHERE r.guide_id = g.id
                ORDER BY r.created_at DESC
                LIMIT 20 -- Keep the initial load light
            ) sub
        )
    ) INTO result
    FROM public.profiles p
    JOIN public.guides g ON p.id = g.id
    WHERE p.id = target_guide_id;

    RETURN result;
END;
$$;


/**
Get detailed booking information with guide and tourist profiles
*/
CREATE OR REPLACE FUNCTION public.get_detailed_booking(target_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'id', b.id,
        'tourist_id', b.tourist_id,
        'guide_id', b.guide_id,
        'status', b.status,
        'start_date', b.start_date,
        'end_date', b.end_date,
        'total_amount', b.total_amount,
        'message', b.message,
        'hired_at', b.hired_at,
        'destination_name', b.destination_name,
        'is_payment_recieved', b.is_payment_recieved,
        
        -- Nested Guide Info
        'guide', (
            SELECT jsonb_build_object(
                'id', m.id,
                'name', m.full_name,
                'username', m.username,
                'avatar', m.avatar_url
            )
            FROM public.minimal_user_info m
            WHERE m.id = b.guide_id
        ),

        -- Nested Tourist Info
        'tourist', (
            SELECT jsonb_build_object(
                'id', m.id,
                'name', m.full_name,
                'username', m.username,
                'avatar', m.avatar_url
            )
            FROM public.minimal_user_info m
            WHERE m.id = b.tourist_id
        )
    ) INTO result
    FROM public.bookings b
    WHERE b.id = target_booking_id;

    RETURN result;
END;
$$;


/**
Get list of bookings for a user by role ('tourist' or 'guide')
*/
CREATE OR REPLACE FUNCTION public.get_user_bookings(target_user_id uuid, user_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT COALESCE(jsonb_agg(booking_node), '[]'::jsonb) INTO result
    FROM (
        SELECT jsonb_build_object(
            'id', b.id,
            'status', b.status,
            'start_date', b.start_date,
            'end_date', b.end_date,
            'total_amount', b.total_amount,
            'destination_name', b.destination_name,
            'guide', (
                SELECT jsonb_build_object('name', m.full_name, 'avatar', m.avatar_url)
                FROM public.minimal_user_info m WHERE m.id = b.guide_id
            ),
            'tourist', (
                SELECT jsonb_build_object('name', m.full_name, 'avatar', m.avatar_url)
                FROM public.minimal_user_info m WHERE m.id = b.tourist_id
            )
        ) as booking_node
        FROM public.bookings b
        WHERE 
            (user_role = 'tourist' AND b.tourist_id = target_user_id) OR
            (user_role = 'guide' AND b.guide_id = target_user_id)
        ORDER BY b.hired_at DESC
    ) sub;

    RETURN result;
END;
$$;