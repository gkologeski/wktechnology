CREATE TABLE public.user_grid_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  grid_key TEXT NOT NULL,
  visible_columns TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, grid_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_grid_preferences TO authenticated;
GRANT ALL ON public.user_grid_preferences TO service_role;

ALTER TABLE public.user_grid_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own grid prefs"
ON public.user_grid_preferences FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own grid prefs"
ON public.user_grid_preferences FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own grid prefs"
ON public.user_grid_preferences FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own grid prefs"
ON public.user_grid_preferences FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_user_grid_preferences_updated_at
BEFORE UPDATE ON public.user_grid_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_user_grid_preferences_user ON public.user_grid_preferences(user_id);