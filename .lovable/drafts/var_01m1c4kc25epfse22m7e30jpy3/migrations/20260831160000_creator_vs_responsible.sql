-- Criador (owner_id/created_by) x Responsável (assigned_to) — padrão HubSpot.
-- Migração aditiva: nenhuma coluna é removida, renomeada ou tem o tipo alterado.

-- ---------------------------------------------------------------------------
-- 1) Chamados já possuem a coluna de responsável (`assignee_id`);
--    nenhuma coluna nova é criada — apenas índice de apoio.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS tickets_assignee_id_idx ON public.tickets (assignee_id);

-- ---------------------------------------------------------------------------
-- 2) Função única de "registro é meu" (responsável OU criador)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_own_record(_owner_id uuid, _assigned_to uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (_assigned_to = auth.uid() OR (_assigned_to IS NULL AND _owner_id = auth.uid()));
$$;

GRANT EXECUTE ON FUNCTION public.is_own_record(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Backfill: assigned_to passa a ser a fonte do responsável
--    (usa assigned_user_id quando existir, senão owner_id)
-- ---------------------------------------------------------------------------
DO $backfill$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name,
           bool_or(c.column_name = 'assigned_user_id') AS has_legacy
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.column_name IN ('assigned_to', 'owner_id', 'assigned_user_id')
     GROUP BY c.table_name
    HAVING bool_or(c.column_name = 'assigned_to')
       AND bool_or(c.column_name = 'owner_id')
  LOOP
    IF r.has_legacy THEN
      EXECUTE format(
        'UPDATE public.%I SET assigned_to = COALESCE(assigned_user_id, owner_id)
          WHERE assigned_to IS DISTINCT FROM COALESCE(assigned_user_id, owner_id)
            AND COALESCE(assigned_user_id, owner_id) IS NOT NULL
            AND assigned_to IS NULL', r.table_name);
      -- divergências antigas: o valor exibido na interface era assigned_user_id
      EXECUTE format(
        'UPDATE public.%I SET assigned_to = assigned_user_id
          WHERE assigned_user_id IS NOT NULL
            AND assigned_to IS NOT NULL
            AND assigned_to <> assigned_user_id', r.table_name);
    ELSE
      EXECUTE format(
        'UPDATE public.%I SET assigned_to = owner_id
          WHERE assigned_to IS NULL AND owner_id IS NOT NULL', r.table_name);
    END IF;
  END LOOP;
END
$backfill$;

-- Chamados: responsável default = criador quando ainda vazio
UPDATE public.tickets SET assignee_id = owner_id WHERE assignee_id IS NULL AND owner_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) Gatilho: assigned_to default na criação + espelho da coluna legada
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_responsible_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec jsonb := to_jsonb(NEW);
BEGIN
  -- Responsável default = criador na criação
  IF TG_OP = 'INSERT' AND (rec ? 'assigned_to') AND NEW.assigned_to IS NULL THEN
    IF (rec ? 'owner_id') THEN
      NEW.assigned_to := NEW.owner_id;
    END IF;
  END IF;

  -- Espelha a coluna legada assigned_user_id, quando a tabela a possui
  IF (rec ? 'assigned_user_id') AND (rec ? 'assigned_to') THEN
    NEW.assigned_user_id := NEW.assigned_to;
  END IF;

  RETURN NEW;
END
$$;

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

-- ---------------------------------------------------------------------------
-- 5) Escopo "próprio" do RBAC passa a considerar o responsável (CRM primeiro)
--    Reescreve apenas o predicado `owner_id = auth.uid()` das políticas
--    existentes, sem afrouxar nenhuma outra condição.
-- ---------------------------------------------------------------------------
DO $policies$
DECLARE
  p record;
  new_qual text;
  new_check text;
  cmd text;
  roles text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('leads', 'contacts', 'companies', 'deals', 'activities')
       AND (qual LIKE '%owner_id = auth.uid()%' OR with_check LIKE '%owner_id = auth.uid()%')
  LOOP
    new_qual := replace(
      COALESCE(p.qual, ''), 'owner_id = auth.uid()',
      'is_own_record(owner_id, assigned_to)');
    new_check := replace(
      COALESCE(p.with_check, ''), 'owner_id = auth.uid()',
      'is_own_record(owner_id, assigned_to)');

    -- INSERT continua exigindo que o criador seja o próprio usuário
    IF p.cmd = 'INSERT' THEN
      CONTINUE;
    END IF;

    cmd := CASE p.cmd WHEN 'ALL' THEN 'ALL' ELSE p.cmd END;
    roles := array_to_string(p.roles, ', ');

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s %s %s',
      p.policyname,
      p.tablename,
      CASE WHEN p.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      cmd,
      roles,
      CASE WHEN new_qual = '' THEN '' ELSE 'USING (' || new_qual || ')' END,
      CASE WHEN new_check = '' THEN '' ELSE 'WITH CHECK (' || new_check || ')' END
    );
  END LOOP;
END
$policies$;

-- ---------------------------------------------------------------------------
-- 6) Chamados: gatilho de responsável default + escopo "meus registros"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tickets_sync_responsible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.assignee_id IS NULL THEN
    NEW.assignee_id := NEW.owner_id;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_tickets_sync_responsible ON public.tickets;
CREATE TRIGGER trg_tickets_sync_responsible
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_sync_responsible();

DO $ticket_policies$
DECLARE
  p record;
  new_qual text;
  new_check text;
BEGIN
  FOR p IN
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'tickets'
       AND cmd <> 'INSERT'
       AND (qual LIKE '%owner_id = auth.uid()%' OR with_check LIKE '%owner_id = auth.uid()%')
  LOOP
    new_qual := replace(COALESCE(p.qual, ''), 'owner_id = auth.uid()',
                        'is_own_record(owner_id, assignee_id)');
    new_check := replace(COALESCE(p.with_check, ''), 'owner_id = auth.uid()',
                         'is_own_record(owner_id, assignee_id)');

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tickets', p.policyname);
    EXECUTE format(
      'CREATE POLICY %I ON public.tickets AS %s FOR %s TO %s %s %s',
      p.policyname,
      CASE WHEN p.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      p.cmd,
      array_to_string(p.roles, ', '),
      CASE WHEN new_qual = '' THEN '' ELSE 'USING (' || new_qual || ')' END,
      CASE WHEN new_check = '' THEN '' ELSE 'WITH CHECK (' || new_check || ')' END
    );
  END LOOP;
END
$ticket_policies$;
