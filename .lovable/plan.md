# Histórico e evidências das sugestões de IA de vínculo de contratos

Três entregas complementares na fila `/contracts/links` e no detalhe do contrato:

1. Histórico persistente das sugestões (o que a IA propôs, se foi aplicado, ignorado ou reavaliado).
2. Evidências visíveis no diálogo de sugestões antes de aplicar.
3. Marcação em `contract_events` de que o vínculo veio de sugestão de IA, com confiança e motivo.

## 1. Histórico das sugestões

Nova tabela para guardar cada rodada de análise (hoje as sugestões vivem apenas em memória):

- Cada execução de "Analisar com IA" grava um lote (`run_id`) com as sugestões propostas: contrato pendente, contrato sugerido, tipo de vínculo, confiança, motivo, origem (regra ou IA) e as evidências usadas.
- Situações possíveis por sugestão: **Proposta**, **Aplicada**, **Ignorada** e **Reavaliada** (quando uma nova análise substitui uma proposta anterior ainda não decidida).
- Ao aplicar no diálogo, a sugestão vira Aplicada com data e autor; ao desmarcar/descartar, vira Ignorada.
- Nova análise marca as propostas pendentes do mesmo contrato como Reavaliadas, deixando claro quando a IA mudou de opinião.

Onde aparece:

- `/contracts/links`: card "Histórico de sugestões da IA" abaixo da fila, com rodadas mais recentes primeiro (contrato, par sugerido, confiança, situação, quem decidiu e quando), filtro por situação e link para cada contrato.
- Detalhe do contrato: card "Sugestões da IA" listando as propostas em que aquele contrato participou (como pendente ou como alvo), com a mesma informação de situação e data.

## 2. Evidências no diálogo de sugestões

Cada linha do diálogo passa a exibir, além do motivo já existente:

- papéis identificados (CONTRATANTE / CONTRATADA de cada lado);
- CNPJs extraídos dos dois contratos, com indicação de qual deles é uma empresa nossa do workspace;
- vigências (início e fim) dos dois contratos e se são compatíveis;
- número citado no documento, quando o casamento veio de referência explícita;
- origem: regra determinística ou análise por IA.

As evidências ficam em uma área expansível ("Ver evidências") para manter a lista densa e legível, com rótulos em pt-BR, foco visível e dark mode.

## 3. Auditoria em `contract_events`

Ao aplicar as associações pelo diálogo, o evento de vínculo (`parent_linked` / `amendment_linked`) passa a incluir no payload a origem `ai_suggestion` com confiança, motivo, origem (regra/IA) e o identificador da sugestão. O card "Histórico de vínculos" no detalhe do contrato mostra um selo "Sugerido pela IA · Confiança Alta" com o motivo, mantendo o texto atual para vínculos manuais.

## Detalhes técnicos

- Migration: tabela `contract_link_ai_suggestions` (`workspace_id`, `run_id`, `pending_contract_id`, `target_contract_id`, `kind`, `confidence`, `reason`, `source`, `evidence jsonb`, `status`, `decided_by`, `decided_at`, `created_at`, `updated_at`) com GRANTs para `authenticated`/`service_role`, RLS por membro do workspace, escrita exigindo permissão de contratos, índices por `workspace_id`, `run_id` e pelos dois contratos, e trigger de `updated_at`.
- `src/lib/contracts/link-suggest.functions.ts`: após montar as sugestões, grava o lote e marca as propostas pendentes anteriores como `superseded`; passa a devolver `suggestion_id` e `evidence` em cada linha.
- `src/lib/contracts/link-suggest.server.ts` / `link-suggest.ts`: função pura `buildSuggestionEvidence(pending, target, ownEntities)` gerando o objeto de evidências (papéis, CNPJs, flag de empresa própria, vigências, número citado), com testes em `src/lib/contracts/__tests__/link-suggest.test.ts`.
- Novas server functions em `src/lib/contracts/link-suggest.functions.ts`: `listContractLinkSuggestions({ contractId? , status?, limit })` e `decideContractLinkSuggestion({ id, status })`.
- `src/lib/contracts.functions.ts`: `linkContractParent` e `linkContractAmendment` recebem um campo opcional `origin` (`{ suggestion_id, confidence, reason, source }`) validado por Zod e incluído no payload de `contract_events`; `listContractLinkEvents` devolve esse campo.
- UI: evidências e `origin` em `src/components/contracts/ai-link-suggestions-dialog.tsx`; novo `src/components/contracts/ai-link-suggestions-history-card.tsx` reutilizado em `src/routes/_authenticated/contracts.links.tsx` e `src/routes/_authenticated/contracts.$id.tsx`; selo de IA em `src/components/contracts/contract-links-history-card.tsx`. Componentes oficiais (Card, Badge, Skeleton, Collapsible, EmptyState/erro) com loading, vazio e erro.
- Sem alteração de RLS existente, autenticação ou regra de negócio dos vínculos; nada é gravado sem revisão humana.
