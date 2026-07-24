
INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system) VALUES
('techsales.prospecting.queue.view',         'techsales', 'prospecting_queue',         'view', 'workspace', 'Ver Fila de prospecção',            'Acessar a aba Fila em /prospecting', true),
('techsales.prospecting.questionnaires.view','techsales', 'prospecting_questionnaires','view', 'workspace', 'Ver Questionários de prospecção',   'Acessar a aba Questionários em /prospecting', true),
('techsales.prospecting.cadences.view',      'techsales', 'prospecting_cadences',      'view', 'workspace', 'Ver Cadências de prospecção',       'Acessar a aba Cadências em /prospecting', true),
('techsales.prospecting.scoring.view',       'techsales', 'prospecting_scoring',       'view', 'workspace', 'Ver Scoring de prospecção',         'Acessar a aba Scoring em /prospecting', true),
('techsales.prospecting.playbooks.view',     'techsales', 'prospecting_playbooks',     'view', 'workspace', 'Ver Playbooks de prospecção',       'Acessar a aba Playbooks em /prospecting', true),
('techsales.prospecting.enrichment.view',    'techsales', 'prospecting_enrichment',    'view', 'workspace', 'Ver Enrichment de prospecção',      'Acessar a aba Enrichment em /prospecting', true),
('techsales.prospecting.search.view',        'techsales', 'prospecting_search',        'view', 'workspace', 'Ver Busca de prospects',            'Acessar a aba Busca de prospects em /prospecting', true),
('techsales.prospecting.scripts.view',       'techsales', 'prospecting_scripts',       'view', 'workspace', 'Ver Scripts de prospecção',         'Acessar a aba Scripts em /prospecting', true),
('techsales.prospecting.voice.view',         'techsales', 'prospecting_voice',         'view', 'workspace', 'Ver Voice Agent de prospecção',     'Acessar a aba Voice Agent em /prospecting', true)
ON CONFLICT (key) DO NOTHING;
