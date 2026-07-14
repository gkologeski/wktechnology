## Corrigir default de priority no create_ticket do engine de workflows

**Causa raiz**: em `src/lib/workflows/engine.server.ts:776`, a ação `create_ticket` faz `priority: action.priority ?? "normal"`. O enum `ticket_priority` do banco é `{low, medium, high, urgent}` — não existe `normal`. Toda execução do workflow "Criar contrato" (e qualquer outro `create_ticket` sem `priority` explícito) falha com `invalid input value for enum ticket_priority: "normal"`.

### Alteração

- `src/lib/workflows/engine.server.ts` linha 776: trocar `"normal"` por `"medium"` (equivalente semântico dentro do enum válido).

Nenhuma migration, nenhuma alteração de schema/RLS, nenhuma mudança no builder ou UI. Ações `create_ticket` que já definem `priority` explicitamente continuam intactas.

### Validação manual

1. Mover um deal para a etapa "(AC) Assinatura de Contrato" do funil "Análises e Consultorias".
2. Aguardar ≤ 60s (tick do engine).
3. Verificar em `workflow_runs` que o run mais recente do workflow `1d204901-...` tem `status='success'`.
4. Conferir no pipeline "FI - Solicitações" um novo chamado "Criar contrato" atribuído a Sabrina Maciel com `priority='medium'`.
