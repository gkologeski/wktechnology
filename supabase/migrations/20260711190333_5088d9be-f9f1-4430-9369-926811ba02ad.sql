
-- Wave 4: RBAC hardening on satellite tables

-- 1) Seed missing permission keys
INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description) VALUES
  ('techsales.tickets.create.own',        'techsales','tickets',   'create','own',      'Criar tickets',                'Criar tickets'),
  ('techsales.tickets.update.own',        'techsales','tickets',   'update','own',      'Editar próprios tickets',      'Editar tickets próprios'),
  ('techsales.tickets.update.workspace',  'techsales','tickets',   'update','workspace','Editar tickets',               'Editar tickets do workspace'),
  ('techsales.tickets.delete.workspace',  'techsales','tickets',   'delete','workspace','Excluir tickets',              'Excluir tickets do workspace'),

  ('techsales.activities.view.workspace',   'techsales','activities','view',  'workspace','Ver atividades',             'Ver atividades do workspace'),
  ('techsales.activities.create.own',       'techsales','activities','create','own',      'Criar atividades',           'Criar atividades'),
  ('techsales.activities.update.own',       'techsales','activities','update','own',      'Editar próprias atividades', 'Editar próprias atividades'),
  ('techsales.activities.update.workspace', 'techsales','activities','update','workspace','Editar atividades',          'Editar atividades do workspace'),
  ('techsales.activities.delete.workspace', 'techsales','activities','delete','workspace','Excluir atividades',         'Excluir atividades do workspace'),

  ('techsales.meetings.view.workspace',     'techsales','meetings',  'view',  'workspace','Ver reuniões',               'Ver reuniões do workspace'),
  ('techsales.meetings.create.own',         'techsales','meetings',  'create','own',      'Criar reuniões',             'Criar reuniões'),
  ('techsales.meetings.update.own',         'techsales','meetings',  'update','own',      'Editar próprias reuniões',   'Editar próprias reuniões'),
  ('techsales.meetings.update.workspace',   'techsales','meetings',  'update','workspace','Editar reuniões',            'Editar reuniões do workspace'),
  ('techsales.meetings.delete.workspace',   'techsales','meetings',  'delete','workspace','Excluir reuniões',           'Excluir reuniões do workspace'),

  ('techsales.quotes.view.workspace',       'techsales','quotes',    'view',  'workspace','Ver cotações',               'Ver cotações do workspace'),
  ('techsales.quotes.create.own',           'techsales','quotes',    'create','own',      'Criar cotações',             'Criar cotações'),
  ('techsales.quotes.update.own',           'techsales','quotes',    'update','own',      'Editar próprias cotações',   'Editar próprias cotações'),
  ('techsales.quotes.update.workspace',     'techsales','quotes',    'update','workspace','Editar cotações',            'Editar cotações do workspace'),
  ('techsales.quotes.delete.workspace',     'techsales','quotes',    'delete','workspace','Excluir cotações',           'Excluir cotações do workspace'),

  ('techsales.emails.view.workspace',       'techsales','emails',    'view',  'workspace','Ver e-mails',                'Ver e-mails do workspace'),
  ('techsales.emails.create.own',           'techsales','emails',    'create','own',      'Enviar e-mails',             'Enviar e-mails'),
  ('techsales.emails.delete.workspace',     'techsales','emails',    'delete','workspace','Excluir e-mails',            'Excluir e-mails do workspace'),

  ('techsales.whatsapp.view.workspace',     'techsales','whatsapp',  'view',  'workspace','Ver WhatsApp',               'Ver conversas WhatsApp'),
  ('techsales.whatsapp.create.own',         'techsales','whatsapp',  'create','own',      'Enviar WhatsApp',            'Enviar mensagens WhatsApp'),
  ('techsales.whatsapp.delete.workspace',   'techsales','whatsapp',  'delete','workspace','Excluir WhatsApp',           'Excluir mensagens WhatsApp')
ON CONFLICT (key) DO NOTHING;

-- 2) Attach new keys to all system sets except pure-view/auditor to preserve current write access.
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT ps.id, p.key
FROM public.permission_sets ps
CROSS JOIN public.permissions p
WHERE ps.is_system = true
  AND ps.name NOT IN ('Read-Only','Auditor','TechSales Viewer','TechHire Viewer')
  AND p.key IN (
    'techsales.tickets.create.own','techsales.tickets.update.own','techsales.tickets.update.workspace','techsales.tickets.delete.workspace',
    'techsales.activities.view.workspace','techsales.activities.create.own','techsales.activities.update.own','techsales.activities.update.workspace','techsales.activities.delete.workspace',
    'techsales.meetings.view.workspace','techsales.meetings.create.own','techsales.meetings.update.own','techsales.meetings.update.workspace','techsales.meetings.delete.workspace',
    'techsales.quotes.view.workspace','techsales.quotes.create.own','techsales.quotes.update.own','techsales.quotes.update.workspace','techsales.quotes.delete.workspace',
    'techsales.emails.view.workspace','techsales.emails.create.own','techsales.emails.delete.workspace',
    'techsales.whatsapp.view.workspace','techsales.whatsapp.create.own','techsales.whatsapp.delete.workspace'
  )
ON CONFLICT DO NOTHING;

-- Also grant view keys to viewer sets so they still can read.
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT ps.id, p.key
FROM public.permission_sets ps
CROSS JOIN public.permissions p
WHERE ps.is_system = true
  AND ps.name IN ('Read-Only','Auditor','TechSales Viewer')
  AND p.key IN (
    'techsales.activities.view.workspace',
    'techsales.meetings.view.workspace',
    'techsales.quotes.view.workspace',
    'techsales.emails.view.workspace',
    'techsales.whatsapp.view.workspace'
  )
ON CONFLICT DO NOTHING;

-- 3) Harden RLS write policies
-- tickets
DROP POLICY IF EXISTS ws_insert_tickets ON public.tickets;
CREATE POLICY ws_insert_tickets ON public.tickets FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.tickets.create.own')
      OR public.user_has_permission(auth.uid(), 'techsales.tickets.manage.workspace')
    )
  );

DROP POLICY IF EXISTS ws_update_tickets ON public.tickets;
CREATE POLICY ws_update_tickets ON public.tickets FOR UPDATE
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.tickets.update.workspace')
      OR public.user_has_permission(auth.uid(), 'techsales.tickets.manage.workspace')
      OR (public.user_has_permission(auth.uid(), 'techsales.tickets.update.own') AND (owner_id = auth.uid() OR assignee_id = auth.uid()))
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.tickets.update.workspace')
      OR public.user_has_permission(auth.uid(), 'techsales.tickets.manage.workspace')
      OR (public.user_has_permission(auth.uid(), 'techsales.tickets.update.own') AND (owner_id = auth.uid() OR assignee_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS ws_delete_tickets ON public.tickets;
CREATE POLICY ws_delete_tickets ON public.tickets FOR DELETE
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.tickets.delete.workspace')
      OR public.user_has_permission(auth.uid(), 'techsales.tickets.manage.workspace')
    )
  );

-- activities
DROP POLICY IF EXISTS ws_insert_activities ON public.activities;
CREATE POLICY ws_insert_activities ON public.activities FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND public.user_has_permission(auth.uid(), 'techsales.activities.create.own')
  );

DROP POLICY IF EXISTS ws_update_activities ON public.activities;
CREATE POLICY ws_update_activities ON public.activities FOR UPDATE
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.activities.update.workspace')
      OR (public.user_has_permission(auth.uid(), 'techsales.activities.update.own') AND owner_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.activities.update.workspace')
      OR (public.user_has_permission(auth.uid(), 'techsales.activities.update.own') AND owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS ws_delete_activities ON public.activities;
CREATE POLICY ws_delete_activities ON public.activities FOR DELETE
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.activities.delete.workspace')
      OR (public.user_has_permission(auth.uid(), 'techsales.activities.update.own') AND owner_id = auth.uid())
    )
  );

-- meetings
DROP POLICY IF EXISTS ws_insert_meetings ON public.meetings;
CREATE POLICY ws_insert_meetings ON public.meetings FOR INSERT
  WITH CHECK (
    ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())))
    AND public.user_has_permission(auth.uid(), 'techsales.meetings.create.own')
  );

DROP POLICY IF EXISTS meetings_write_update ON public.meetings;
CREATE POLICY meetings_write_update ON public.meetings FOR UPDATE
  USING (
    public.user_has_permission(auth.uid(), 'techsales.meetings.update.workspace')
    OR is_workspace_admin_of(owner_id, auth.uid())
    OR (public.user_has_permission(auth.uid(), 'techsales.meetings.update.own') AND can_write_owner(owner_id, auth.uid()))
  )
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'techsales.meetings.update.workspace')
    OR is_workspace_admin_of(owner_id, auth.uid())
    OR (public.user_has_permission(auth.uid(), 'techsales.meetings.update.own') AND can_write_owner(owner_id, auth.uid()))
  );

DROP POLICY IF EXISTS meetings_write_delete ON public.meetings;
CREATE POLICY meetings_write_delete ON public.meetings FOR DELETE
  USING (
    public.user_has_permission(auth.uid(), 'techsales.meetings.delete.workspace')
    OR is_workspace_admin_of(owner_id, auth.uid())
  );

-- quotes
DROP POLICY IF EXISTS ws_insert_quotes ON public.quotes;
CREATE POLICY ws_insert_quotes ON public.quotes FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND public.user_has_permission(auth.uid(), 'techsales.quotes.create.own')
  );

DROP POLICY IF EXISTS ws_update_quotes ON public.quotes;
CREATE POLICY ws_update_quotes ON public.quotes FOR UPDATE
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.quotes.update.workspace')
      OR (public.user_has_permission(auth.uid(), 'techsales.quotes.update.own') AND owner_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.quotes.update.workspace')
      OR (public.user_has_permission(auth.uid(), 'techsales.quotes.update.own') AND owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS ws_delete_quotes ON public.quotes;
CREATE POLICY ws_delete_quotes ON public.quotes FOR DELETE
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND public.user_has_permission(auth.uid(), 'techsales.quotes.delete.workspace')
  );

-- quote_line_items
DROP POLICY IF EXISTS ws_insert_quote_line_items ON public.quote_line_items;
CREATE POLICY ws_insert_quote_line_items ON public.quote_line_items FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.quotes.create.own')
      OR public.user_has_permission(auth.uid(), 'techsales.quotes.update.workspace')
      OR (public.user_has_permission(auth.uid(), 'techsales.quotes.update.own') AND owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS quote_line_items_write_update ON public.quote_line_items;
CREATE POLICY quote_line_items_write_update ON public.quote_line_items FOR UPDATE
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.quotes.update.workspace')
      OR (public.user_has_permission(auth.uid(), 'techsales.quotes.update.own') AND owner_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.quotes.update.workspace')
      OR (public.user_has_permission(auth.uid(), 'techsales.quotes.update.own') AND owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS quote_line_items_write_delete ON public.quote_line_items;
CREATE POLICY quote_line_items_write_delete ON public.quote_line_items FOR DELETE
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.quotes.update.workspace')
      OR public.user_has_permission(auth.uid(), 'techsales.quotes.delete.workspace')
      OR (public.user_has_permission(auth.uid(), 'techsales.quotes.update.own') AND owner_id = auth.uid())
    )
  );

-- deal_line_items follow parent deal editability
DROP POLICY IF EXISTS ws_insert_deal_line_items ON public.deal_line_items;
CREATE POLICY ws_insert_deal_line_items ON public.deal_line_items FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.deals.update.workspace')
      OR public.user_has_permission(auth.uid(), 'techsales.deals.update.team')
      OR public.user_has_permission(auth.uid(), 'techsales.deals.update.own')
      OR public.user_has_permission(auth.uid(), 'techsales.deals.create.own')
    )
  );

DROP POLICY IF EXISTS ws_update_deal_line_items ON public.deal_line_items;
CREATE POLICY ws_update_deal_line_items ON public.deal_line_items FOR UPDATE
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.deals.update.workspace')
      OR public.user_has_permission(auth.uid(), 'techsales.deals.update.team')
      OR public.user_has_permission(auth.uid(), 'techsales.deals.update.own')
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.deals.update.workspace')
      OR public.user_has_permission(auth.uid(), 'techsales.deals.update.team')
      OR public.user_has_permission(auth.uid(), 'techsales.deals.update.own')
    )
  );

DROP POLICY IF EXISTS ws_delete_deal_line_items ON public.deal_line_items;
CREATE POLICY ws_delete_deal_line_items ON public.deal_line_items FOR DELETE
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), 'techsales.deals.update.workspace')
      OR public.user_has_permission(auth.uid(), 'techsales.deals.update.team')
      OR public.user_has_permission(auth.uid(), 'techsales.deals.update.own')
      OR public.user_has_permission(auth.uid(), 'techsales.deals.delete.workspace')
    )
  );
