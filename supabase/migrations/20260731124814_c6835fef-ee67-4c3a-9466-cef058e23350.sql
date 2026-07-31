-- 1) Catálogo granular de Prospecção
INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system) VALUES
  ('techsales.prospecting.queue.view.own',        'techsales','prospecting_queue','view','own','Ver minhas filas de prospecção',NULL,true),
  ('techsales.prospecting.queue.view.team',       'techsales','prospecting_queue','view','team','Ver filas de prospecção da equipe',NULL,true),
  ('techsales.prospecting.queue.create.own',      'techsales','prospecting_queue','create','own','Criar filas de prospecção',NULL,true),
  ('techsales.prospecting.queue.create.workspace','techsales','prospecting_queue','create','workspace','Criar filas de prospecção no workspace',NULL,true),
  ('techsales.prospecting.queue.update.own',      'techsales','prospecting_queue','update','own','Editar minhas filas de prospecção',NULL,true),
  ('techsales.prospecting.queue.update.workspace','techsales','prospecting_queue','update','workspace','Editar filas de prospecção do workspace',NULL,true),
  ('techsales.prospecting.queue.delete.own',      'techsales','prospecting_queue','delete','own','Excluir minhas filas de prospecção',NULL,true),
  ('techsales.prospecting.queue.delete.workspace','techsales','prospecting_queue','delete','workspace','Excluir filas de prospecção do workspace',NULL,true),
  ('techsales.prospecting.queue.assign.workspace','techsales','prospecting_queue','assign','workspace','Atribuir responsável em filas de prospecção',NULL,true),

  ('techsales.prospecting.cadences.view.own',        'techsales','prospecting_cadences','view','own','Ver minhas cadências de prospecção',NULL,true),
  ('techsales.prospecting.cadences.create.own',      'techsales','prospecting_cadences','create','own','Criar cadências de prospecção',NULL,true),
  ('techsales.prospecting.cadences.create.workspace','techsales','prospecting_cadences','create','workspace','Criar cadências no workspace',NULL,true),
  ('techsales.prospecting.cadences.update.own',      'techsales','prospecting_cadences','update','own','Editar minhas cadências de prospecção',NULL,true),
  ('techsales.prospecting.cadences.update.workspace','techsales','prospecting_cadences','update','workspace','Editar cadências do workspace',NULL,true),
  ('techsales.prospecting.cadences.delete.own',      'techsales','prospecting_cadences','delete','own','Excluir minhas cadências de prospecção',NULL,true),
  ('techsales.prospecting.cadences.delete.workspace','techsales','prospecting_cadences','delete','workspace','Excluir cadências do workspace',NULL,true),

  ('techsales.prospecting.questionnaires.view.own',        'techsales','prospecting_questionnaires','view','own','Ver meus questionários de prospecção',NULL,true),
  ('techsales.prospecting.questionnaires.create.own',      'techsales','prospecting_questionnaires','create','own','Criar questionários de prospecção',NULL,true),
  ('techsales.prospecting.questionnaires.create.workspace','techsales','prospecting_questionnaires','create','workspace','Criar questionários no workspace',NULL,true),
  ('techsales.prospecting.questionnaires.update.own',      'techsales','prospecting_questionnaires','update','own','Editar meus questionários de prospecção',NULL,true),
  ('techsales.prospecting.questionnaires.update.workspace','techsales','prospecting_questionnaires','update','workspace','Editar questionários do workspace',NULL,true),
  ('techsales.prospecting.questionnaires.delete.own',      'techsales','prospecting_questionnaires','delete','own','Excluir meus questionários de prospecção',NULL,true),
  ('techsales.prospecting.questionnaires.delete.workspace','techsales','prospecting_questionnaires','delete','workspace','Excluir questionários do workspace',NULL,true),

  ('techsales.prospecting.scripts.create.own',      'techsales','prospecting_scripts','create','own','Criar scripts de prospecção',NULL,true),
  ('techsales.prospecting.scripts.create.workspace','techsales','prospecting_scripts','create','workspace','Criar scripts no workspace',NULL,true),
  ('techsales.prospecting.scripts.update.own',      'techsales','prospecting_scripts','update','own','Editar meus scripts de prospecção',NULL,true),
  ('techsales.prospecting.scripts.update.workspace','techsales','prospecting_scripts','update','workspace','Editar scripts do workspace',NULL,true),
  ('techsales.prospecting.scripts.delete.own',      'techsales','prospecting_scripts','delete','own','Excluir meus scripts de prospecção',NULL,true),
  ('techsales.prospecting.scripts.delete.workspace','techsales','prospecting_scripts','delete','workspace','Excluir scripts do workspace',NULL,true),

  ('techsales.prospecting.playbooks.create.own',      'techsales','prospecting_playbooks','create','own','Criar playbooks de prospecção',NULL,true),
  ('techsales.prospecting.playbooks.create.workspace','techsales','prospecting_playbooks','create','workspace','Criar playbooks no workspace',NULL,true),
  ('techsales.prospecting.playbooks.update.own',      'techsales','prospecting_playbooks','update','own','Editar meus playbooks de prospecção',NULL,true),
  ('techsales.prospecting.playbooks.update.workspace','techsales','prospecting_playbooks','update','workspace','Editar playbooks do workspace',NULL,true),
  ('techsales.prospecting.playbooks.delete.own',      'techsales','prospecting_playbooks','delete','own','Excluir meus playbooks de prospecção',NULL,true),
  ('techsales.prospecting.playbooks.delete.workspace','techsales','prospecting_playbooks','delete','workspace','Excluir playbooks do workspace',NULL,true),

  ('techsales.prospecting.scoring.update.workspace',   'techsales','prospecting_scoring','update','workspace','Configurar scoring de prospecção',NULL,true),
  ('techsales.prospecting.voice.update.workspace',     'techsales','prospecting_voice','update','workspace','Configurar Voice Agent de prospecção',NULL,true),
  ('techsales.prospecting.enrichment.create.workspace','techsales','prospecting_enrichment','create','workspace','Executar enriquecimento de prospects',NULL,true),
  ('techsales.prospecting.enrichment.export.workspace','techsales','prospecting_enrichment','export','workspace','Exportar resultados de enriquecimento',NULL,true),
  ('techsales.prospecting.search.create.workspace',    'techsales','prospecting_search','create','workspace','Executar buscas de prospects',NULL,true),
  ('techsales.prospecting.search.export.workspace',    'techsales','prospecting_search','export','workspace','Importar/exportar resultados de busca',NULL,true)
ON CONFLICT (key) DO NOTHING;

-- 2) Helper SECURITY DEFINER: usuário atual compartilha workspace com o dono da fila?
CREATE OR REPLACE FUNCTION public.shares_workspace_with(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_members a
      JOIN public.workspace_members b ON b.workspace_id = a.workspace_id
     WHERE a.user_id = _other
       AND b.user_id = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION public.shares_workspace_with(uuid) TO authenticated;

-- 3) Policies granulares em prospecting_queues
DROP POLICY IF EXISTS "prospecting_queues owner all" ON public.prospecting_queues;

CREATE POLICY "prospecting_queues select" ON public.prospecting_queues
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR assigned_to = auth.uid()
  OR (
    public.shares_workspace_with(owner_id)
    AND (
      is_shared
      OR public.user_has_permission(auth.uid(), 'techsales.prospecting.queue.view.workspace')
    )
  )
);

CREATE POLICY "prospecting_queues insert own" ON public.prospecting_queues
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "prospecting_queues update" ON public.prospecting_queues
FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    public.shares_workspace_with(owner_id)
    AND public.user_has_permission(auth.uid(), 'techsales.prospecting.queue.update.workspace')
  )
)
WITH CHECK (
  owner_id = auth.uid()
  OR (
    public.shares_workspace_with(owner_id)
    AND public.user_has_permission(auth.uid(), 'techsales.prospecting.queue.update.workspace')
  )
);

CREATE POLICY "prospecting_queues delete" ON public.prospecting_queues
FOR DELETE TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    public.shares_workspace_with(owner_id)
    AND public.user_has_permission(auth.uid(), 'techsales.prospecting.queue.delete.workspace')
  )
);