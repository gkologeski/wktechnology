# Importação HubSpot — contagens reais e cascata por Empresas

Refatorar o wizard de importação do HubSpot (`/integrations/hubspot`) para que a importação seja conduzida **a partir das empresas** (objeto pai limitado pelo usuário) e cascateie para todos os filhos relacionados, exibindo contagens reais (locais e remotas) por objeto antes de habilitar o botão "Iniciar importação".

## 1. UI — `src/components/hubspot/import-wizard.tsx`

**Quadro 1 — Escopo da importação**
- Mover o campo **"Máximo de registros por objeto"** para o **topo** do quadro e renomeá-lo para **"Máximo de empresas a ser importado"**. Continua sendo `number` (1–2000), default 200.
- Texto auxiliar passa a deixar claro que esse limite só se aplica a Empresas; os demais objetos serão importados conforme o que estiver vinculado às empresas trazidas.
- Mantém os checkboxes por objeto (Empresas, Contatos, Negócios, Leads, Atividades) com a regra de auto-marcar pais. **Empresas** vira obrigatório (checkbox marcado e desabilitado) — é a raiz da cascata.

**Quadro 2 — Pré-visualização da árvore**
- Cada item do passo agora exibe um badge no formato `X / Total`:
  - `X` = quantidade desse objeto que **já existe na nossa base** com `external_ids->>'hubspot'` definido (escopo do `owner_id` atual).
  - `Total` = quantidade desse objeto **no HubSpot** (vindo da nova função de contagem).
  - Enquanto não houver contagem, mostra `—`. Durante a contagem, mostra um spinner inline para o objeto sendo lido.
- O badge antigo "até 200" some.

**Botão "Contar Registros"** (logo abaixo do quadro 2)
- Dispara `countHubspotObjects` (ver §2) **um objeto por vez**, em sequência, atualizando o badge `X/Total` de cada card assim que cada chamada termina (estado local do componente).
- Enquanto a contagem está em andamento: botão mostra "Contando…" com spinner; o botão **"Iniciar importação"** fica desabilitado.
- Ao concluir todas as contagens: botão "Iniciar importação" é **habilitado**.

**Botão "Iniciar importação"**
- Estado inicial: **desabilitado**.
- Habilita somente quando a contagem foi executada com sucesso para todos os objetos selecionados (flag `countsReady` no estado).
- Se o usuário alterar o escopo após contar, `countsReady` volta a `false` (precisa contar de novo).

## 2. Backend — `src/lib/integrations/hubspot.functions.ts`

**Nova server fn `countHubspotObjects`** (substitui/expande `previewHubspotCounts`)
- Input: `{ objects: ("companies"|"contacts"|"deals"|"leads"|"activities")[] }`.
- Para cada objeto pedido, executa **em paralelo**:
  - `remote`: `POST /crm/v3/objects/{obj}/search` com body `{ limit: 1 }` para obter `total` real do HubSpot. Para `leads`, usa `contacts/search` com filtro `lifecyclestage = lead`. Para `activities`, soma os totais de `notes + calls + meetings + tasks + emails`.
  - `local`: `select count(*)` em cada tabela do nosso banco filtrando `owner_id = userId AND external_ids ? 'hubspot'`.
- Retorna `{ companies: { local, remote }, contacts: {...}, ... }`.
- A função aceita ser chamada repetidamente (cliente pode chamar uma por vez sequencialmente para feedback em tempo real, OU passar todos os objetos de uma vez — o front fará chamadas individuais para mostrar progresso por objeto).

**Refatorar `startHubspotImport` para cascata real a partir de Empresas**
- O input passa a se chamar `maxCompanies` (mantém-se compatível aceitando `maxPerObject` como alias deprecado).
- **Etapa Companies**: importa até `maxCompanies` empresas, popula `companyMap`.
- **Etapa Contacts**: para cada empresa importada (`companyMap.keys()`), busca contatos vinculados via `GET /crm/v3/objects/companies/{id}/associations/contacts` (paginado, em lotes), depois `POST /crm/v3/objects/contacts/batch/read` com as propriedades necessárias. Importa **todos** os contatos retornados (sem limite). Popula `contactMap`.
- **Etapa Deals**: idem, partindo de `companies/{id}/associations/deals` + `deals/batch/read` com `associations=companies,contacts`. Importa todos. Popula `dealMap` e `deal_contacts`.
- **Etapa Leads**: agora limita-se a contatos cuja empresa está no `companyMap` E `lifecyclestage = lead` (filtro client-side já que estamos varrendo via batch). Importa todos os encontrados.
- **Etapa Activities**: para cada `dealId/contactId/companyId` no escopo, lê `associations/{notes,calls,meetings,tasks,emails}` e batch-read de cada engagement. Importa todos os encontrados.
- Em todos os passos novos, manter o `appendLog` por página/lote e a atualização de `step_logs` para a timeline em tempo real.
- Respeitar rate-limit com `sleep(150ms)` entre chamadas (já existe).

## 3. Considerações técnicas

- A pré-visualização não bloqueia a importação por contagem (é só informativa). A regra de habilitar o botão é puramente de UX — segurança e idempotência continuam por `external_ids` (upsert).
- A contagem local (`X`) usa `head: true, count: 'exact'` no Supabase para evitar trazer linhas.
- A contagem remota usa `/search` (POST com `limit:1`) porque o endpoint `GET /objects/{type}` não retorna `total` confiável.
- Atividades no HubSpot são 5 endpoints separados — somar os totais e exibir um único `X/Total` agregado no card "Atividades".
- Cascata por associações pode gerar muitas requisições; o gateway HubSpot tem 100 req/10s — manter `sleep(150)` entre lotes e usar `batch/read` (lote de 100) sempre que possível.
- Não removeremos `previewHubspotCounts` para não quebrar eventuais consumidores; passa a ser um wrapper sobre `countHubspotObjects`.

## 4. Entregáveis

1. `src/lib/integrations/hubspot.functions.ts`
   - Nova `countHubspotObjects` (com contagens local + remota por objeto).
   - `startHubspotImport`: input renomeado para `maxCompanies`; lógica em cascata por associações para Contacts/Deals/Leads/Activities.
2. `src/components/hubspot/import-wizard.tsx`
   - Campo de máximo movido para o topo e renomeado.
   - Empresas obrigatório.
   - Badge `X/Total` por objeto na pré-visualização.
   - Botão "Contar Registros" com chamada sequencial e atualização em tempo real.
   - Botão "Iniciar importação" desabilitado até contagem concluir; reset ao alterar escopo.

## Fora do escopo

- Mudanças na timeline de execução (`import-timeline.tsx`) — continua igual.
- Migrações de banco — schema atual já cobre.
- Botão "Desfazer importação".
