ALTER TABLE public.user_grid_preferences
  ADD COLUMN IF NOT EXISTS sort_key text,
  ADD COLUMN IF NOT EXISTS sort_dir text;

ALTER TABLE public.user_grid_preferences
  DROP CONSTRAINT IF EXISTS user_grid_preferences_sort_dir_check;

ALTER TABLE public.user_grid_preferences
  ADD CONSTRAINT user_grid_preferences_sort_dir_check
  CHECK (sort_dir IS NULL OR sort_dir IN ('asc', 'desc'));