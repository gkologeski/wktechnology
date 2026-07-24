## Ajustes na Fila de Prospecção (`/prospecting`)

Alvo: `src/components/prospecting/queue-tab.tsx` (apenas apresentação).

### 1. Nome do lead aparecendo como "—"
Em `QueueItemRow`, para `entity === "lead"` o código lê `item.name`, mas o SELECT no server retorna `first_name` + `last_name` (e há também `company_name`). Ajustar a montagem do nome:
- Lead: `` `${first_name ?? ""} ${last_name ?? ""}`.trim() `` → fallback para `email` → fallback para `company_name` → `"—"`.
- Contato: manter lógica atual (já correta).

Também corrigir o campo de score: o SELECT retorna `score` (não `lead_score`). Ajustar `QueueItemRow` para ler `item.score`.

### 2. Status em Português-BR
Criar um pequeno mapa local no arquivo (`LEAD_STATUS_LABELS` / `CONTACT_LIFECYCLE_LABELS`) cobrindo os valores usados no sistema:

- Leads (`status`): `new → Novo`, `working → Em trabalho`, `contacted → Contatado`, `qualified → Qualificado`, `unqualified → Desqualificado`, `converted → Convertido`, `lost → Perdido`, `nurturing → Em nutrição`.
- Contatos (`lifecycle_stage`): `subscriber → Assinante`, `lead → Lead`, `mql → MQL`, `sql → SQL`, `opportunity → Oportunidade`, `customer → Cliente`, `evangelist → Evangelista`, `other → Outro`.

Fallback: valor original com primeira letra maiúscula. Usar o label no `<Badge>` do item.

### 3. Quantidade na lista lateral de filas
Na sidebar (`queues.map`), exibir o count ao lado do nome:

- Fila `manual`: já mostra `Manual · N` — manter, com N = `item_ids.length`.
- Fila `dynamic`: adicionar badge com o total. Para evitar N+1 chamadas ao `listQueueItems`, buscar somente `count` via um novo helper leve no servidor: adicionar `countQueueItems(queue_id)` em `src/lib/prospecting/queues.functions.ts` (mesma lógica de filtros de `listQueueItems`, porém `select("id", { count: "exact", head: true })`). Usar um `useQuery` por fila (chaves independentes) para renderizar `Badge` com o total. Alternativa mais simples se preferir: exibir o total apenas na fila ativa (já disponível em `data.total` do workspace). Recomendo a primeira para atender o pedido literal.

### Fora de escopo
Sem mudanças em RLS, schema ou regras de negócio; apenas UI + um SELECT `head:true` de contagem.
