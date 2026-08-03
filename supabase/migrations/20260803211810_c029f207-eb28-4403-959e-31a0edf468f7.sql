-- user_roles: restrict reads and writes
DROP POLICY IF EXISTS "roles readable by signed in" ON public.user_roles;
CREATE POLICY "own role or admin readable" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin manages roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- points: restrict reads to owner or admin
DROP POLICY IF EXISTS "points readable" ON public.points;
CREATE POLICY "own points or admin readable" ON public.points
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- leaderboard totals remain visible without exposing notes/awarded_by
CREATE OR REPLACE VIEW public.leaderboard
WITH (security_invoker = off) AS
  SELECT p.id AS user_id, p.display_name, COALESCE(SUM(pt.amount), 0)::int AS total_points
  FROM public.profiles p
  LEFT JOIN public.points pt ON pt.user_id = p.id
  GROUP BY p.id, p.display_name;

REVOKE ALL ON public.leaderboard FROM anon;
GRANT SELECT ON public.leaderboard TO authenticated;
GRANT ALL ON public.leaderboard TO service_role;

-- votes: restrict reads to involved parties or admin
DROP POLICY IF EXISTS "votes readable" ON public.votes;
CREATE POLICY "involved votes readable" ON public.votes
  FOR SELECT TO authenticated
  USING (voter_id = auth.uid() OR target_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- internal trigger functions should not be directly callable
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;