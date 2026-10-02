CREATE TABLE public.proposal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  html text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_templates TO authenticated;
GRANT ALL ON public.proposal_templates TO service_role;
ALTER TABLE public.proposal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY proposal_templates_select ON public.proposal_templates FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY proposal_templates_write ON public.proposal_templates FOR ALL TO authenticated USING (public.is_workspace_admin(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));
CREATE INDEX proposal_templates_ws_idx ON public.proposal_templates(workspace_id);

CREATE TABLE public.proposal_template_services (
  template_id uuid NOT NULL REFERENCES public.proposal_templates(id) ON DELETE CASCADE,
  service_catalog_id uuid NOT NULL REFERENCES public.service_catalog(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  PRIMARY KEY (template_id, service_catalog_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_template_services TO authenticated;
GRANT ALL ON public.proposal_template_services TO service_role;
ALTER TABLE public.proposal_template_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY pts_select ON public.proposal_template_services FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY pts_write ON public.proposal_template_services FOR ALL TO authenticated USING (public.is_workspace_admin(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

ALTER TABLE public.proposals ADD COLUMN public_token text UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex');
ALTER TABLE public.proposals ADD COLUMN proposal_template_id uuid REFERENCES public.proposal_templates(id) ON DELETE SET NULL;
UPDATE public.proposals SET public_token = encode(extensions.gen_random_bytes(24), 'hex') WHERE public_token IS NULL;

WITH t AS (
  INSERT INTO public.proposal_templates (workspace_id, name, description, html, is_default)
  SELECT w.id, 'Proposta — Outsourcing', 'Modelo inicial de Outsourcing', '<p>À <strong>{{company.name}}</strong>{{#if contact.name}}, aos cuidados de {{contact.name}}{{/if}}.</p><p>Apresentamos nossa proposta referente a <strong>{{deal.name}}</strong>.</p><h2>Perfil dos profissionais</h2><p>Descrever perfis, senioridade, tecnologias e quantidade de profissionais alocados.</p><h2>Jornada e alocação</h2><p>Jornada de referência de 160 horas/mês por profissional, em regime remoto, híbrido ou presencial conforme acordado.</p><h2>SLA de início e substituição</h2><p>Apresentação de candidatos em até 10 dias úteis; substituição de profissional em até 15 dias úteis, sem custo adicional.</p><h2>Gestão operacional</h2><p>Acompanhamento mensal de desempenho, relatório de horas e ponto focal de gestão da conta.</p><h2>Reajuste</h2><p>Valores reajustados anualmente pelo índice acordado (ex.: IPCA), a partir da data de início da alocação.</p><h2>Investimento</h2><table><thead><tr><th>Item</th><th>Cobrança</th></tr></thead><tbody>{{#each items}}<tr><td>{{name}}</td><td>{{billing}}</td></tr>{{/each}}</tbody></table><p><strong>Total:</strong> {{total}}</p>{{#if valid_until}}<p>Proposta válida até {{valid_until}}.</p>{{/if}}', true FROM public.workspaces w
  RETURNING id, workspace_id
)
INSERT INTO public.proposal_template_services (template_id, service_catalog_id, workspace_id)
SELECT t.id, s.id, t.workspace_id FROM t JOIN public.service_catalog s ON s.workspace_id = t.workspace_id AND s.name ILIKE '%outsourcing%';

WITH t AS (
  INSERT INTO public.proposal_templates (workspace_id, name, description, html, is_default)
  SELECT w.id, 'Proposta — Fábrica de software', 'Modelo inicial de Fábrica de software', '<p>À <strong>{{company.name}}</strong>{{#if contact.name}}, aos cuidados de {{contact.name}}{{/if}}.</p><p>Apresentamos nossa proposta referente a <strong>{{deal.name}}</strong>.</p><h2>Entendimento do projeto</h2><p>Contexto do cliente, objetivos de negócio e problema a ser resolvido.</p><h2>Escopo funcional</h2><p>Funcionalidades incluídas e, expressamente, o que está fora do escopo.</p><h2>Metodologia e sprints</h2><p>Desenvolvimento ágil em sprints de 2 semanas, com cerimônias de planejamento, revisão e retrospectiva.</p><h2>Marcos de entrega</h2><p>Relação dos marcos, datas previstas e entregáveis de cada marco.</p><h2>Critérios de aceite</h2><p>Homologação pelo cliente em até 5 dias úteis após cada entrega; ausência de manifestação implica aceite.</p><h2>Garantia técnica</h2><p>Correção de defeitos sem custo por 90 dias após o aceite final.</p><h2>Cronograma financeiro</h2><p>Pagamentos vinculados ao aceite de cada marco de entrega.</p><h2>Investimento</h2><table><thead><tr><th>Item</th><th>Cobrança</th></tr></thead><tbody>{{#each items}}<tr><td>{{name}}</td><td>{{billing}}</td></tr>{{/each}}</tbody></table><p><strong>Total:</strong> {{total}}</p>{{#if valid_until}}<p>Proposta válida até {{valid_until}}.</p>{{/if}}', true FROM public.workspaces w
  RETURNING id, workspace_id
)
INSERT INTO public.proposal_template_services (template_id, service_catalog_id, workspace_id)
SELECT t.id, s.id, t.workspace_id FROM t JOIN public.service_catalog s ON s.workspace_id = t.workspace_id AND s.name ILIKE '%fábrica%';

WITH t AS (
  INSERT INTO public.proposal_templates (workspace_id, name, description, html, is_default)
  SELECT w.id, 'Proposta — Hunting', 'Modelo inicial de Hunting', '<p>À <strong>{{company.name}}</strong>{{#if contact.name}}, aos cuidados de {{contact.name}}{{/if}}.</p><p>Apresentamos nossa proposta referente a <strong>{{deal.name}}</strong>.</p><h2>Perfil da vaga</h2><p>Cargo, responsabilidades, requisitos técnicos e comportamentais, faixa salarial e modelo de trabalho.</p><h2>Metodologia</h2><p>Mapeamento de mercado, abordagem ativa, entrevistas técnicas e comportamentais e apresentação de parecer.</p><h2>Prazos</h2><p>Apresentação da shortlist em até 15 dias úteis a partir do kick-off.</p><h2>Garantia de reposição</h2><p>Reposição sem custo caso o profissional seja desligado em até 90 dias da admissão.</p><h2>Honorários</h2><p>Taxa de sucesso sobre o salário anual do contratado, faturada na data de admissão.</p><h2>Investimento</h2><table><thead><tr><th>Item</th><th>Cobrança</th></tr></thead><tbody>{{#each items}}<tr><td>{{name}}</td><td>{{billing}}</td></tr>{{/each}}</tbody></table><p><strong>Total:</strong> {{total}}</p>{{#if valid_until}}<p>Proposta válida até {{valid_until}}.</p>{{/if}}', true FROM public.workspaces w
  RETURNING id, workspace_id
)
INSERT INTO public.proposal_template_services (template_id, service_catalog_id, workspace_id)
SELECT t.id, s.id, t.workspace_id FROM t JOIN public.service_catalog s ON s.workspace_id = t.workspace_id AND s.name ILIKE '%hunting%';

WITH t AS (
  INSERT INTO public.proposal_templates (workspace_id, name, description, html, is_default)
  SELECT w.id, 'Proposta — Consultoria', 'Modelo inicial de Consultoria', '<p>À <strong>{{company.name}}</strong>{{#if contact.name}}, aos cuidados de {{contact.name}}{{/if}}.</p><p>Apresentamos nossa proposta referente a <strong>{{deal.name}}</strong>.</p><h2>Diagnóstico inicial</h2><p>Levantamento da situação atual, entrevistas com áreas envolvidas e análise de processos e sistemas.</p><h2>Metodologia</h2><p>Etapas do trabalho, reuniões e workshops previstos e forma de validação com o cliente.</p><h2>Entregáveis</h2><p>Relatórios, recomendações e plano de ação executivo.</p><h2>Cronograma</h2><p>Duração prevista por etapa e data de apresentação final.</p><h2>Especialistas alocados</h2><p>Perfil e dedicação dos consultores envolvidos.</p><h2>Investimento</h2><table><thead><tr><th>Item</th><th>Cobrança</th></tr></thead><tbody>{{#each items}}<tr><td>{{name}}</td><td>{{billing}}</td></tr>{{/each}}</tbody></table><p><strong>Total:</strong> {{total}}</p>{{#if valid_until}}<p>Proposta válida até {{valid_until}}.</p>{{/if}}', true FROM public.workspaces w
  RETURNING id, workspace_id
)
INSERT INTO public.proposal_template_services (template_id, service_catalog_id, workspace_id)
SELECT t.id, s.id, t.workspace_id FROM t JOIN public.service_catalog s ON s.workspace_id = t.workspace_id AND s.name ILIKE '%consultoria%';
