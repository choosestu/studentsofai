CREATE TABLE public.conversation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_number integer NOT NULL,
  sessions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, prompt_number)
);

GRANT SELECT, INSERT, UPDATE ON public.conversation_logs TO authenticated;
GRANT ALL ON public.conversation_logs TO service_role;

ALTER TABLE public.conversation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own logs readable" ON public.conversation_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert own log" ON public.conversation_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own log" ON public.conversation_logs FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_conversation_logs_updated_at
BEFORE UPDATE ON public.conversation_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();