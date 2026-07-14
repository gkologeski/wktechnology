## Editar workflow "Criar contrato"

Alterar a ação `create_ticket` do workflow (id `1d204901-faa5-4108-9a9a-89e5f4ed31dc`) via `supabase--insert` (UPDATE em `public.workflows`), atualizando ambos `actions` (versão publicada) e `draft_actions`:

- `subject`: `"Criar contrato"` (era `"Criar Contrato [{{title}}]"`)
- `pipeline_id`: `"69a19e6b-6b60-41fb-802c-76eeefefa2f6"` → pipeline **FI - Solicitações**
- `assignee_id`: `"d473eff9-f234-4ab1-86da-a623a94ee2fd"` (Sabrina Maciel — já estava correto)
- `description`: mantida (`"Empresa: {{company}}"`)
- Republicar bump em `published_version` para garantir que o engine use a nova versão.

Nenhuma alteração de código-fonte. Nenhuma alteração de schema/RLS.

### Validação manual
Mover um deal para a etapa "(AC) Assinatura de Contrato" e conferir, em ≤ 60s, um ticket criado no pipeline "FI - Solicitações", atribuído a Sabrina, com título "Criar contrato".
