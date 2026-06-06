## Construtor de público multi-entidade

Substitui o textarea de UUIDs por um builder inline com 4 fontes, preview, e toggle snapshot vs. dinâmica.

### Schema (migration)

Adiciona à `prospecting_campaigns`:
- `audience_mode` text: `"static"` (snapshot) ou `"dynamic"` (re-resolve no Iniciar). Default `"static"`.
- `audience_rules` jsonb: array de blocos `{ source, filter }` onde `source ∈ { leads, contacts, companies, deals }` e `filter` usa o `FilterNode` de `src/lib/filters.ts`.

`lead_ids` continua existindo:
- `static`: preenchido na hora de salvar (resolve agora).
- `dynamic`: ignorado ao iniciar; resolve em tempo real.

### Resolução de público (server)

Nova função `resolveAudience({ rules })` em `src/lib/prospecting-audience.functions.ts`:
- **leads**: aplica filtro em `leads`, retorna `id`.
- **contacts**: filtra `contacts` com telefone; cria/upserta um lead "shadow" por contato (ou um lead leve com `phone`/`first_name`/`last_name`/`company_name`) para reusar `prospecting_call_attempts` que aponta para `lead_id`. Alternativa mais simples: retorna apenas contatos que **já têm lead vinculado por email/phone**; sem vínculo, é descartado e listado na auditoria como "sem lead correspondente". Vou usar a alternativa simples para não criar leads automaticamente.
- **companies → contatos → leads**: filtra companies; pega contatos com `company_id` ∈ matches; mapeia para leads existentes.
- **deals → contatos → leads**: filtra deals; pega contatos via `deal_contacts`; mapeia para leads existentes.

Resultado: lista única e deduplicada de `lead_id`.

Pode ser chamada em modo `preview` (retorna contagem e amostra) ou `commit` (retorna todos para salvar).

### Wiring de execução

- `upsertCampaign`: aceita `audience_mode` e `audience_rules`. Se `static`, resolve e salva em `lead_ids`. Se `dynamic`, salva `lead_ids = []`.
- `setCampaignStatus("running")`: se `audience_mode = "dynamic"`, resolve audience antes do bloco de enfileiramento e usa o resultado em vez de `c.lead_ids`.
- `auditCampaignQueueability`: usa a mesma resolução para o modo dinâmico, e inclui motivos novos: "sem telefone", "contato sem lead vinculado".

### UI no detalhe da campanha

Substitui o card de `Textarea` de UUIDs por **"Público da campanha"**:
- Toggle: `Snapshot` ↔ `Dinâmica`.
- Lista de blocos de regra. Cada bloco:
  - Select da fonte (Leads / Contatos / Empresas → contatos / Deals → contatos).
  - Builder de filtros reusando `FilterBuilderDialog` (`src/components/filter-builder-dialog.tsx`) com o schema de campos da entidade.
- Botão **"Pré-visualizar"** → chama `previewAudience` e mostra "X leads resultantes" + amostra dos 20 primeiros nomes.
- Painel de Auditoria já existente mostra automaticamente as razões de bloqueio.

Mantém um modo legado "Lista manual de UUIDs" como um tipo de bloco extra (`source: "manual"`), para não perder o fluxo atual.

### Arquivos afetados

- `supabase/migrations/<novo>.sql` — adiciona 2 colunas.
- `src/lib/prospecting-audience.functions.ts` — novo: resolveAudience / previewAudience.
- `src/lib/prospecting-campaigns.functions.ts` — estende upsert, setCampaignStatus, audit.
- `src/routes/_authenticated/prospecting.campaigns.$id.tsx` — novo card "Público".
- `src/components/prospecting/audience-builder.tsx` — novo componente do builder.

### Pontos a confirmar

1. Para fontes Contatos/Empresas/Deals: **descartar contatos sem lead correspondente** (mais simples e seguro) ou **criar lead automaticamente** a partir do contato? Sugiro descartar e mostrar contagem na auditoria.
2. Campos disponíveis em cada filtro: começo com um conjunto curado (status/source/owner/score/criado em para leads; industry/size/state para companies; stage/value/owner para deals; lifecycle/owner/created_at para contacts) — posso ampliar depois.
