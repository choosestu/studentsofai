DROP VIEW IF EXISTS public.leaderboard;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_points integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recalc_profile_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    UPDATE public.profiles p
      SET total_points = COALESCE((SELECT SUM(amount) FROM public.points WHERE user_id = OLD.user_id), 0)
      WHERE p.id = OLD.user_id;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    UPDATE public.profiles p
      SET total_points = COALESCE((SELECT SUM(amount) FROM public.points WHERE user_id = NEW.user_id), 0)
      WHERE p.id = NEW.user_id;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_profile_points() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS points_recalc_profile ON public.points;
CREATE TRIGGER points_recalc_profile
AFTER INSERT OR UPDATE OR DELETE ON public.points
FOR EACH ROW EXECUTE FUNCTION public.recalc_profile_points();

UPDATE public.profiles p
SET total_points = COALESCE((SELECT SUM(amount) FROM public.points WHERE user_id = p.id), 0);