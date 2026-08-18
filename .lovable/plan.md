# Isolamento de workspace (cliente) e licenças por módulo

## O que a auditoria encontrou

Verifiquei o banco (colunas, políticas de acesso, funções auxiliares) e o código dos módulos. O conceito está correto em parte do sistema, mas há três problemas estruturais reais.

### 1. Duas semânticas diferentes para "dono" do registro
Hoje o campo `owner_id` significa coisas diferentes dependendo da tabela:
- CRM (empresas, contatos, leads, negócios, atividades, contratos): `owner_id` = usuário, e o isolamento real vem de `workspace_id`. Correto.
- People: `owner_id` guarda o **id do workspace** (185 registros).
- ATS e vários satélites: não existe `workspace_id`; o isolamento depende de funções que "adivinham" o workspace a partir do criador do registro.

Números medidos: 312 tabelas no schema público — 185 com `workspace_id`, **82 sem `workspace_id` e isoladas apenas por dono**, 45 sem nenhuma das duas.

### 2. Isolamento por dono deixa dados invisíveis ou vazáveis
Nas 82 tabelas sem `workspace_id` (entrevistas, propostas de vaga, scorecards, kits, pools, sequências de sourcing, e-mails de etapa, prospecção/SDR, Unipile, arquivos do usuário, feature flags, cargos, rascunhos de mensagem, conjuntos de permissão, modelos de ML, eventos de domínio, chamados internos) as regras usam `owner_id = usuário atual` ou "compartilha algum workspace com o criador". Consequências:
- Colega do mesmo workspace não vê o registro (é a mesma causa das vagas/pipelines invisíveis já corrigidas caso a caso).
- A função `shares_workspace_with` ignora o workspace **ativo**: se um usuário pertencer a dois clientes, ela libera o registro em qualquer contexto — vazamento entre clientes. Hoje ninguém está em dois workspaces, então o risco está latente, não materializado.

### 3. Licença de módulo existe, mas não é aplicada nem protegida
- `workspace_modules` + `plans` + `plan_entitlements` já modelam "workspace com uma ou mais licenças".
- Porém o consumo dessa tabela só aparece nas telas de configuração/billing. Menu, `ModuleSwitcher` e rotas **não** verificam se o módulo está licenciado — qualquer usuário acessa qualquer módulo pela URL.
- `setWorkspaceModuleEnabled` e `setWorkspaceModulePlan` rodam com privilégio de servidor e não checam se quem chama é administrador do workspace: qualquer membro pode ativar/desativar módulos e trocar de plano.
- Existem três resoluções diferentes de "workspace ativo". A de `src/lib/workspace/modules.functions.ts` pega a primeira associação encontrada e ignora `profiles.active_workspace_id`, então mostraria o módulo do cliente errado para quem tem mais de um workspace.

### 4. Visão do administrador
`platform_admins` e `is_platform_admin` existem, mas o bypass está presente em apenas 15 tabelas. Falta um padrão único de "administrador vê tudo".

## Ajustes propostos (por fases, aditivo e reversível)

**Fase 1 — Fundação de workspace (sem mudança visível)**
- Adicionar `workspace_id` (FK + índice) nas tabelas de negócio que hoje não têm, começando pelos satélites de ATS, prospecção/SDR e arquivos.
- Backfill derivando do registro pai (vaga, candidato, lead) e, sem pai, do workspace ativo do criador.
- Trigger de preenchimento automático em cada tabela, igual ao já usado no ATS.
- Padronizar People: passar a usar `workspace_id` e deixar `owner_id` como responsável (usuário).

**Fase 2 — Regras de acesso padronizadas**
- Reescrever as políticas dessas tabelas no padrão já validado no CRM: `workspace_id ∈ workspaces do usuário` **e** permissão granular (workspace/equipe/próprio), com bypass de administrador de plataforma.
- Substituir `shares_workspace_with` por checagem baseada no workspace do registro, eliminando o vazamento latente para usuários multi-workspace.
- Aposentar `resolve_workspace_id(owner_id)` como fonte de verdade nas tabelas já convertidas.

**Fase 3 — Licenciamento aplicado**
- Fonte única de "workspace ativo" no servidor (`resolveActiveWorkspace`), removendo as variantes duplicadas.
- Gate de licença: menu, `ModuleSwitcher`, grade da home e rotas de módulo passam a respeitar `workspace_modules.enabled`; módulo não licenciado exibe tela de "não contratado" com próxima ação, em vez de erro.
- Exigir administrador do workspace para ativar/desativar módulo e trocar plano, com registro em auditoria.

**Fase 4 — Verificação**
- Consulta de conformidade listando tabelas de negócio sem `workspace_id` ou sem política de workspace, para acompanhar até zerar.
- Teste manual com dois workspaces e um usuário membro de ambos, confirmando que a troca de workspace muda os dados e que o administrador continua vendo tudo.

## Detalhes técnicos

- Tabelas alvo da Fase 1/2 (grupo inicial): `ats_interviews`, `ats_offers`, `ats_scorecards`, `ats_scorecard_responses`, `ats_interview_kits`, `ats_interviewer_pools`, `ats_interviewer_pool_members`, `ats_talent_pools`, `ats_hunting_captures`, `ats_hunting_templates`, `ats_job_postings`, `ats_stage_emails`, `ats_stage_email_log`, `ats_sourcing_sequences`, `ats_application_events`, `ats_match_scores`, `prospecting_*`, `sdr_*`, `user_files`, `user_file_folders`, `message_drafts`, `feature_flags`, `job_roles`, `permission_sets`, `lead_sources`.
- Padrão de política: `workspace_id IN (SELECT current_user_workspaces())` + `user_has_permission(auth.uid(), workspace_id, '<modulo>.<recurso>.<acao>.<escopo>')` + `is_platform_admin(auth.uid())`.
- Arquivos de servidor a ajustar: `src/lib/ats/*.functions.ts`, `src/lib/prospecting*`, `src/lib/files.functions.ts`, `src/lib/modules/workspace-modules.functions.ts`, `src/lib/workspace/modules.functions.ts`, `src/lib/active-workspace.server.ts`.
- Gate de UI: `src/lib/modules/registry.ts`/`active-module.ts`, `ModuleSwitcher`, `src/routes/_authenticated/modules.index.tsx` e layout do sidebar.
- Nada de remoção de funcionalidade: políticas antigas só caem depois que a nova cobre o mesmo caso.

## Como validar depois

1. Entrar com um usuário comum e conferir que vê os registros dos colegas do mesmo cliente (vagas, entrevistas, arquivos, prospecção).
2. Criar um segundo workspace, alternar entre eles e confirmar que listas e dashboards mudam por completo.
3. Desativar um módulo em um workspace e confirmar que o menu esconde e a rota bloqueia.
4. Tentar ativar módulo com usuário não administrador e confirmar a recusa.
