DO $triggers$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND t.table_type = 'BASE TABLE'
       AND c.column_name = 'assigned_to'
     GROUP BY c.table_name
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_responsible ON public.%I', r.table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_sync_responsible BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.sync_responsible_columns()', r.table_name);
  END LOOP;
END
$triggers$;