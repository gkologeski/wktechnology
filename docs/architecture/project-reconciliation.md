# TechProjects — Ciclo 1: conciliação, vínculos, fila de pendências e painel

Escopo: só o workspace WK. Nada é alterado no Clockify, no Jibble nem no registro bruto
(staging). Ciclo 2 (provisionamento de negócio ganho) e redesigns ficaram de fora.

## Onde fica

- Tela: TechProjects › Configurações › **Conciliação de horas**
  (`/projects/settings/imports/reconciliation`, abas Cobertura, Conferência, Pendências, Vínculos).
  Só administrador ativo do workspace ativo.
- Painel: `/projects/dashboard` com filtro de período (`?from=&to=`) e fuso do navegador.

## Banco (migrações aditivas)

| Arquivo | md5 | O quê |
| --- | --- | --- |
| `drizzle/migrations/0169_techprojects_cycle1_reconciliation.sql` | `41903a89142cb25ac2bdf41d80e59a3b` | `projects.company_id`; tabelas `project_link_batches/changes/suggestions`, `project_reconciliation_issues/issue_events/refreshes` (GRANT → RLS → políticas); funções de fila, vínculo, reversão, visão geral, conferência e painel |
| `drizzle/migrations/0170_techprojects_cycle1_recon_admin_reads.sql` | `3457c1cf9290755e2f98eaf4adac5f3a` | leituras da central exigem admin explicitamente e não pagam RLS por linha (evitava estouro de tempo com ~110 mil registros) |
| `drizzle/migrations/0171_techprojects_cycle1_suggestion_guard.sql` | `a72bd1879bc77354413df26d4cf2bfff` | confirmar sugestão recusa pessoa já usada por outro usuário ou projeto que já tem outra empresa |

Regras: ver `src/lib/projects/AGENTS.md`.

## Critérios

- **Empresa do projeto**: só quando o `company_id` gravado pela importação no projeto existe,
  é do mesmo workspace, não está excluído e não diverge do mapeamento de cliente nem da outra
  fonte. Divergência vira sugestão "Origem e mapeamento divergem".
- **Pessoa do apontamento**: e-mail normalizado (minúsculo, sem espaços) único entre membros do
  workspace e único entre pessoas não arquivadas, pessoa sem perfil de outro usuário e sem uso por
  outro usuário. E-mail repetido e nome igual viram sugestão. Ninguém ganha login, convite ou
  papel; `people.profile_id` não é alterado.
- **Alocação**: só com pessoa já ligada, mesmo projeto e uma única alocação vigente na data.
- Cada vínculo grava antes/depois em `project_link_changes`; desvincular só desfaz o que ainda
  tem o valor gravado. Vínculo não recalcula duração, não muda `updated_at`, não gera auditoria
  genérica nem workflow.

## Fila de pendências

Tipos: data anterior a 2020 (com diagnóstico comparando o bruto), duração zero/negativa,
sobreposição por pessoa, mesmo horário em mais de um registro, eventos/intervalos em revisão do
Jibble (desconhecido, aberto, longo, sem projeto, coincide com outra fonte), horas sem horário do
Jibble não cobertas por intervalos no mesmo dia, e registros em revisão do Clockify. Um registro
pode ter vários alertas. Ações: procedente/descartar (justificativa obrigatória), adiar, reabrir;
tudo em `project_reconciliation_issue_events`. Exportação CSV síncrona até 20.000 alertas.

## Resultado real no WK (20/10/2026)

Linha de base antes de qualquer gravação (15:21 UTC) e depois dos vínculos (16:16 UTC):
hashes iguais para apontamentos (`5034e573…`, inclui data, horas, duração, carimbos, situação,
faturável, origem, id externo, `updated_at`), staging Jibble (`94fe2360…`), staging Clockify
(`fefad59a…`), vínculos Clockify (`0817d9b2…`) e projetos (`acdcbe12…`, inclui `updated_at` e
metadados). Auditoria genérica 112.507 → 112.507; eventos de workflow 524.335 → 524.335.
Avisos: 190 → 195, todos de mensagens de WhatsApp recebidas no período, sem relação.

- Fila conferida em 8,7 s: 4.993 alertas em 3.731 apontamentos distintos (3.463 sobreposições,
  890 horas sem horário do Jibble não cobertas = 7.174,37 h fora do ERP, 301 duração zero,
  224 mesmo horário, 79 eventos desconhecidos, 13 sem projeto, 9 coincidem com outra fonte,
  6 entradas sem saída, 4 intervalos longos, 4 datas anteriores a 2020 — as 4 já vêm assim no
  bruto do Clockify).
- Vínculos exatos: 157 de 172 projetos com empresa; 449 apontamentos de 7 usuários com pessoa;
  0 com alocação; 68 sugestões por nome igual aguardando decisão.
- ERP × coletado: Clockify 264.752:34:08 = 264.752:34:08; Jibble 1.508:13:30 = 1.508:13:30.
  O relatório de resumo do próprio Clockify (prévia de 20/10 02:31) aponta 12 pessoas com
  diferença entre coletado e informado pela origem (−3.851:12:08 no total): divergência
  informada pela origem, não reconsultada nem certificada.
- Clockify recusou (403): despesas, faturas, campos personalizados, políticas de folga e pedidos
  de aprovação — causa não comprovada (plano, papel da chave ou recurso desligado).

## Testes

- `bash tests/sql/project-reconciliation-isolated.sh drizzle/migrations/0169_*.sql drizzle/migrations/0170_*.sql drizzle/migrations/0171_*.sql`
  (banco descartável com a estrutura real, 6.000 apontamentos e 6.000 tarefas fictícios,
  dois workspaces, papéis próprio/negado/workspace/inativo, Ver Como, duas aplicações
  simultâneas): 65 asserções, todas passaram.
- `src/lib/projects/reconciliation-labels.test.ts`: período/fuso, segundos exatos, importado
  bloqueado ≠ aprovado, justificativa obrigatória, escape do CSV.

## Limites conhecidos

- A origem não é reconsultada; a tela compara ERP com o coletado.
- Horas sem horário do Jibble não viram apontamento (regra ainda não definida).
- Exportação acima de 20.000 alertas pede filtro (não há tarefa em segundo plano).
- Tela não testada no navegador com usuário não administrador; as permissões foram provadas no
  banco descartável.
