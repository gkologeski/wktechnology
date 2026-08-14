# Desqualificar deve mover o lead para a etapa Desqualificado

## Causa confirmada

No painel de qualificação, ao concluir "Desqualificar" o lead recebe apenas
`status: "disqualified"` — a etapa do funil (`stage_id`) não é atualizada.
Como a etapa exibida é resolvida primeiro por `stage_id` (fallback no `status`),
o lead continua visualmente na última etapa (ex.: "Em Contato" ou "Qualificado").
O caminho "Qualificar" já grava `stage_id` da etapa de qualificação — só a
desqualificação ficou de fora.

O envio para nutrição (server function) também grava apenas
`status: "nurturing"`, sem etapa.

## O que será feito

1. **Desqualificar**: junto do status, gravar a etapa de perda do funil de Leads
   (etapa com valor `disqualified` ou, na falta dela, a primeira etapa do tipo
   "perdido"), com o `pipeline_id` correspondente. Se o funil não tiver etapa de
   perda, mantém apenas o status (comportamento atual, sem regressão).
2. **Nutrição**: mesma lógica de forma aditiva — se existir no funil uma etapa
   equivalente a nutrição (valor `nurturing`), gravar também `stage_id`;
   caso não exista, nada muda.
3. Após a decisão, as invalidações de cache já existentes continuam garantindo
   que a trilha de etapas no detalhe do lead atualize sozinha.

## Fora do escopo

Sem mudança de schema, RLS, permissões, regras de score ou de decisão. Nenhuma
alteração visual além da etapa passar a refletir a decisão.

## Detalhes técnicos

- `src/components/prospecting/qualification-panel.tsx`: além de `qualifiedStage`,
  derivar `lostStage` e `nurtureStage` de `useLeadStages()` (que já expõe
  `pipelineId`); em `confirmDisqualify`, o patch passa a incluir `stage_id` e
  `pipeline_id` quando a etapa existir, mantendo `.select("id")` e a checagem de
  permissão (`PermissionDeniedError`) já implementada.
- `src/lib/prospecting/qualifications.functions.ts` (nutrição): aceitar
  `stage_id`/`pipeline_id` opcionais enviados pelo painel e incluí-los no update
  do lead apenas quando informados.
- Validações: `bun run typecheck` e verificação manual do detalhe do lead.

## Como validar

1. Mover um lead para "Qualificado" → no modal, escolher "Desqualificar" com
   motivo: a trilha passa para "Desqualificado" sem recarregar a página.
2. Repetir com "Enviar para nutrição": se o funil tiver etapa de nutrição, o lead
   vai para ela; se não tiver, permanece como hoje.
3. Fluxo de "Qualificar" segue igual.
