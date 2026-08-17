# Corrigir divergência de etapa entre grid e detalhe do Lead

## Diagnóstico (verificado)

O lead Anderson Furuuti tem `stage_id = null`, `pipeline_id = null` e `status = "qualified"`.

O Funil de Leads configurado não possui nenhuma etapa com o valor `qualified` — as etapas são: `new` (Novo), `contacting` (Em Contato), `qualifying` (Em qualificação), `oportunity` (Oportunidade, tipo won) e `disqualified` (Desqualificado).

Com isso, os dois lugares tratam o valor órfão de formas diferentes:

- **Grid**: `resolveLeadStageValue` não encontra correspondência e devolve o próprio `status` (`"qualified"`), então o pill mostra o texto cru `qualified`.
- **Detalhe**: o `StageTracker` não acha a etapa e cai no índice 0, destacando **1. Novo** (o destaque em "4. Oportunidade" na captura é o efeito de hover do mouse).

Não é bug de renderização: é um valor de status legado sem etapa equivalente no funil atual. Hoje existem 5.802 leads com `stage_id` nulo (5.459 `disqualified`, 239 `qualified`, 70 `new`, 29 `contacted`, 5 `nurturing`).

## O que fazer

### 1. Resolução consistente (frontend, `src/lib/leads/stages.ts`)

Adicionar um fallback semântico em `resolveLeadStageValue`, aplicado quando não há `stage_id` nem etapa com o mesmo valor do status legado:

```text
qualified     -> primeira etapa type = "won"       (Oportunidade)
disqualified  -> primeira etapa type = "lost"      (Desqualificado)
contacted     -> 2ª etapa "open", se existir       (Em Contato)
nurturing     -> etapa "open" seguinte disponível
new / outros  -> primeira etapa do funil           (Novo)
```

Assim grid, detalhe, filtros e kanban passam a derivar a mesma etapa do mesmo valor. Nenhuma outra tela precisa mudar, pois todas já usam essa função.

### 2. Pill nunca mostra valor cru

Garantir que, quando a etapa não for encontrada, o `StagePill` exiba um rótulo traduzido em português (nunca o valor técnico em inglês como `qualified`).

### 3. Backfill de dados (migration)

Preencher `pipeline_id` (Funil de Leads padrão) e `stage_id` dos leads com `stage_id` nulo usando exatamente o mesmo mapeamento acima, sem alterar o campo `status` (mantendo compatibilidade com filtros/relatórios legados). Migration idempotente, aplicada apenas onde `stage_id is null`.

## Detalhes técnicos

- Arquivos alterados: `src/lib/leads/stages.ts` (fallback por tipo) e o componente do `StagePill` (rótulo de fallback).
- `StageTracker` não muda: com a etapa corretamente resolvida, o índice passa a ser o correto.
- Migration de UPDATE em `public.leads` limitada a linhas com `stage_id is null`, resolvendo a etapa a partir do JSON de `pipelines.stages` do funil de leads do próprio workspace.
- Nenhuma alteração em RLS, permissões, schema ou regra de negócio.

## Como validar

1. Abrir o lead Anderson Furuuti: a trilha deve destacar **4. Oportunidade** e o grid deve mostrar o mesmo rótulo.
2. Conferir alguns leads `disqualified` e `new` — grid e detalhe coerentes.
3. Filtrar por etapa em /leads e confirmar contagens compatíveis.
