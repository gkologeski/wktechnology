# Varredura de regras de acesso: criador/administrador vs. workspace/permissão

## O que já foi verificado nesta varredura

Consultei as 315 tabelas do banco e suas 1.478 regras de acesso, e cruzei com o código-fonte
(server functions e telas). O resultado preliminar já permite classificar tudo em 4 visões.
O entregável será um documento de auditoria com a lista completa, tabela por tabela e tela por tela.

### Visão 1 — Exige ser o criador (ou "administrador") para editar/excluir

**1a. Regra obrigatória (sobrepõe permissões) — 14 áreas:**
Contratos, Itens de linha de negócio, Itens de linha de cotação, Base de conhecimento,
Macros de atendimento, Políticas de SLA, Projetos, e em Pessoas: Alocações, Benefícios,
Documentos, Metas, Incidentes, 1:1s e Avaliações.
Nestas, a regra exige "criador OU administrador"; parte delas usa a verificação de
administrador antiga (`is_workspace_admin_of`/`resolve_workspace_id`, já corrigida na
migração 0019) e parte já usa a nova (`is_workspace_admin_v2` + permissão do módulo).

**1b. Somente o criador, sem nenhuma alternativa por permissão — 24 áreas:**
Chaves de API, Integrações, Contas de e-mail, Contas de calendário, Perfis de acesso
(+ permissões e ferramentas do perfil), Conjuntos de permissões e seus itens, Cargos
(conjuntos), Regras de permissão de campo, Papéis de usuário, Membros de time,
Modelos/execuções de onboarding, Preferências de grade, Notificações, Assinaturas push,
Copiloto (sessões e mensagens), Membros e mensagens de chat, Eventos de domínio,
Modelos e scores de ML, Log de mensagens Unipile, Webhooks de saída.
Parte dessas é dado pessoal (notificações, preferências, copiloto, push) e deve continuar
por usuário — isso será marcado como "correto por desenho" no documento, não como problema.

### Visão 2 — Já baseada em workspace/permissão
191 áreas, incluindo Negócios, Leads, Contatos, Empresas, Atividades, Propostas, Cotações,
Tickets, Financeiro, Projetos (listas/tarefas/timesheet), Pessoas (cadastro e eventos),
Workflows, Catálogo de serviços e presets de contratação.

### Visão 3 — Sem regra de acesso própria
`modules` e `permissions` (catálogos globais de plataforma, somente leitura).

### Visão 4 — Outra regra (será citada no documento)
27 áreas, com regras como: negação total (`app_settings`), somente administrador de
plataforma (`platform_admins`, alertas, sandboxes, planos), acesso por token público
(tokens de descadastro de e-mail), acesso pelo próprio perfil (`profiles`), fila/serviço
interno (logs de envio de e-mail, cursores, buckets de rate limit) e regras por aprovação
(`workflow_approvals`).
Em TechHire há ainda uma regra própria e legítima, `techhire_rbac_gate(...)`, usada em
Entrevistas, Publicações de vaga, Ofertas e Sourcing — baseada em permissão, será citada
na visão 4 como variante.

## Entregáveis

1. `docs/qa/access-rule-audit.md` — inventário completo e auditável:
   - uma linha por área do sistema, com módulo, tela/rota correspondente, visão (1 a 4),
     o texto real da regra e, quando visão 1, a ação recomendada;
   - seção separada para checagens feitas no código (server functions e telas que filtram
     por criador), já que regra de acesso do banco e código podem divergir;
   - seção "correto por desenho" para dados pessoais.
2. `scripts/audit-access-rules.ts` — script repetível que regenera a classificação a partir
   do banco e do código, para a auditoria não envelhecer.
3. Nenhuma alteração de regra, schema ou tela nesta etapa.

## Detalhes técnicos

- Fonte de verdade das regras: `pg_policies` no schema `public`, separando PERMISSIVE
  (que ampliam, em OR) de RESTRICTIVE (que restringem, em AND) — só as RESTRICTIVE podem
  bloquear quem já tem permissão, por isso a distinção aparece na visão 1a vs 1b.
- Classificação por marcadores: criador (`owner_id = auth.uid()`, `created_by = auth.uid()`,
  `is_workspace_admin_of`) vs. workspace/permissão (`workspace_id IN current_user_workspaces()`,
  `is_workspace_member`, `is_workspace_admin_v2`, `user_has_permission`, `user_can_act`,
  `techhire_rbac_gate`).
- Varredura de código: `rg` sobre todo `src/` buscando `.eq("owner_id", userId)`,
  `created_by === userId`, `isOwner`, e ausência de `assertPermission`/`assertAnyPermission`
  nos handlers de update/delete; mapeamento tabela → rota via `src/routes/**`.
- Sem migração nesta etapa. A correção da visão 1 entra em plano próprio, por módulo,
  sempre aditiva (`CREATE OR REPLACE` / `CREATE POLICY` nova), preservando o bloqueio
  entre workspaces.

## Próximo passo após a auditoria (não executado agora)

Plano de correção por módulo, na ordem: TechContracts e cotações → TechService (KB, macros,
SLA) → TechPeople → TechProjects → configurações administrativas (chaves de API,
integrações, perfis de acesso), cada um com verificação por papel antes e depois.
