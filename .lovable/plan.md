# Diagnóstico

O workflow **"Criar contrato"** (`1d204901-faa5-4108-9a9a-89e5f4ed31dc`) está publicado e habilitado, mas nunca dispara em produção por **três defeitos combinados** na configuração do gatilho:

Trigger atual salvo no banco:
```json
{ "event": "updated", "filters": [{ "field": "stage", "op": "eq", "value": 1018009924 }] }
```

Confrontado com os eventos reais gerados quando o deal muda para "Assinatura de Contrato" (verificado em `workflow_events`, ex. deal `a663fb77…`):
- `event_type = "stage_changed"`
- `after.stage_id = "1018009924"` (texto)
- `after.stage = "new"` (enum, valor totalmente diferente)

Falhas:

1. **Evento errado** — engine (linha 1130) compara `trig.event === event.event_type`. Como o gatilho é `updated`, todo evento `stage_changed` é ignorado. Movimentar etapa emite apenas `stage_changed`, nunca `updated`.
2. **Campo errado** — o filtro usa `field: "stage"`, mas mudança de etapa afeta `stage_id`. O `stage` é um enum de status (`"new" | "won" | …`), então o filtro compara `"new" === 1018009924` → sempre falso.
3. **Tipo do valor errado** — `stage_id` é `text` (ex.: `"1018009924"`), mas o filtro guardou `1018009924` como **number**. O `evalFilter` (`v === f.value`) trata `"1018009924" !== 1018009924` como falso — falharia mesmo se o campo estivesse certo.

Isso também explica por que o modo de Teste retorna "não passa": ele avalia os mesmos filtros contra o `after` do registro atual.

# Correção

## 1. Consertar o workflow existente (migration idempotente)

Atualizar `trigger` e `draft_trigger` do workflow `1d204901-faa5-4108-9a9a-89e5f4ed31dc` (e reaplicar em `published_version`) para:

```json
{
  "event": "stage_changed",
  "filters": [{ "field": "stage_id", "op": "changed_to", "value": "1018009924" }],
  "reenroll": { "enabled": false, "events": [] }
}
```

Justificativas:
- `stage_changed` bate com o evento real emitido pelo trigger de banco.
- `stage_id` é a coluna correta (text).
- `changed_to` garante que só dispara na transição para a etapa, evitando reprocessar deals que já estão nela (mais fiel ao objetivo "quando entra em Assinatura de Contrato").
- valor em **string**, casando com o tipo `text` do `after.stage_id`.

## 2. Endurecer o Workflow Builder para evitar regressão

Ajustes cirúrgicos em `src/components/workflows/workflow-builder.tsx`, sem mexer em lógica de negócio:

- **`FilterRow` (linhas ~1670-1695):** coagir tipo do valor conforme o `type` do campo do catálogo:
  - `type === "number"` → armazenar `Number(e.target.value)`;
  - qualquer outro → armazenar `String(e.target.value)`;
  - opções (select) já retornam string — manter.
- **Catálogo de campos de `deals`** (`getEntityFieldCatalog` em `src/lib/workflow-refs.functions.ts` ou constante `ENTITY_FIELDS`): garantir que `stage_id` esteja marcado como `type: "select"` com options a partir dos estágios do pipeline (já resolvido via referências), e que o campo enum `stage` seja rotulado de forma distinta ("Status do deal") para não ser confundido com "Etapa do pipeline".
- **Aviso quando `event = "updated"` e algum filtro é sobre `stage_id`:** exibir hint "Use o evento *Mudou de etapa* para reagir a mudanças de pipeline" abaixo do seletor de evento no `WorkflowTriggerEditor`. Sem bloqueio, apenas orientação.

Nenhuma alteração no engine (`src/lib/workflows/engine.server.ts`), nas RLS, nem em outros workflows.

## 3. Validação

- Rodar `SELECT trigger FROM workflows WHERE id = '1d204901…'` e confirmar JSON esperado.
- No módulo Deals, mover um deal de teste para a etapa `1018009924` e aguardar o próximo tick (≤ 60s):
  - `workflow_events` recebe `stage_changed` (já observado).
  - `workflow_runs` cria linha com `status='success'` para o workflow.
  - `tickets` recebe o chamado "Criar Contrato [<title>]" atribuído a `d473eff9…`.
- Testar no builder o modo Test com um deal já em `1018009924`: deve indicar "passa" e simular a criação do ticket.

# Detalhes técnicos

Arquivos a alterar:
- `supabase/migrations/<timestamp>_fix_criar_contrato_workflow_trigger.sql` — UPDATE no registro do workflow.
- `src/components/workflows/workflow-builder.tsx` — coerção de tipo no `FilterRow`, label do enum `stage`, hint condicional no editor do gatilho.
- (Se necessário) `src/lib/workflow-refs.functions.ts` — enriquecer o field catalog de `deals` para diferenciar `stage` (enum de status) de `stage_id` (etapa do pipeline com options).

Sem mudanças em: engine, RLS, schema de tabelas, outras rotas ou permissões.

# Riscos e pendências

- Outros workflows possivelmente afetados pelo mesmo padrão (event=updated + field=stage/stage_id + value numérico). Após corrigir este, farei uma varredura `SELECT` para listar candidatos e pedir sua confirmação antes de tocar em qualquer outro.
- A coerção de tipos no builder é aditiva; workflows já salvos com valores numéricos continuam existindo até serem re-editados. O fix da migration cobre apenas este workflow — os demais serão listados para você decidir.

# Como validar manualmente

1. Após aplicação: em `/settings/workflows`, abrir "Criar contrato" e confirmar que o gatilho aparece como "Mudou de etapa" com filtro "Etapa mudou para (AC) Assinatura de Contrato".
2. Mover um deal para essa etapa.
3. Aguardar ~60s e verificar em `/tickets` a criação do chamado.

# Próximo passo recomendado

Após a correção deste workflow, rodar uma auditoria dos demais workflows salvos (`SELECT id, name, trigger FROM workflows WHERE trigger::text ILIKE '%"field":"stage"%' OR trigger::text ~ '"value":\s*[0-9]'`) e reportar antes de qualquer alteração adicional.
