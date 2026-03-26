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