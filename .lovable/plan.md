# Construtor de público estilo HubSpot Lists

Substituir o card atual de "Público da campanha" em `/prospecting/campaigns/:id` por uma experiência próxima das **Listas / Segmentos do HubSpot**: cartões de filtro empilhados, lógica AND dentro do grupo e OR entre grupos, escolha clara de entidade-fonte, contagem ao vivo e possibilidade de reaproveitar uma Lista já salva em **Configurações → Listas**.

## Resultado para o usuário

- Topo do card: 3 abas — **Listas salvas** · **Construtor inline** · **IDs manuais**.
- Em "Construtor inline":
  - Toggle **Snapshot (estática)** vs **Dinâmica (recalcula ao iniciar)**.
  - Botão **Adicionar grupo de filtros**. Cada grupo é um cartão com:
    - Seletor de fonte: Leads · Contatos · Empresas → contatos · Deals → contatos.
    - Linhas de condição estilo HubSpot: `Propriedade` · `Operador` · `Valor`. Operadores: é / não é / contém / não contém / começa com / maior que / menor que / entre / é conhecido / é desconhecido / nos últimos N dias.
    - Botão **E** entre linhas (intra-grupo = AND).
    - Botão **+ Adicionar grupo** abaixo (inter-grupo = OR), com divisor "OU" visível.
  - Rodapé fixo do card: contagem em tempo real (debounced) "X leads correspondem" + botão **Ver amostra** que abre uma gaveta com 50 primeiros (nome / telefone / origem).
- Em "Listas salvas":
  - Combo que lista os Segmentos existentes (entidade leads/contacts/companies/deals).
  - Mostra contagem atual da lista e link "Editar em Configurações".
  - Ao salvar, a campanha referencia o `segment_id` (modo dinâmico segue a lista).
- Em "IDs manuais": textarea para colar UUIDs (compatibilidade com o que já existe).

## Mudanças técnicas

### 1. Modelo de regras (`src/lib/prospecting-audience.functions.ts`)
- Adicionar nova fonte `"segment"` ao tipo `AudienceSource`. `AudienceRule` ganha shape `{ source: "segment", segment_id: string }`.
- `resolveAudienceServer`: para `source === "segment"`, ler `segment_members` (entidade da lista) e mapear para `leads` via mesma lógica já existente (email/telefone para contacts/companies/deals; id direto para leads).
- Sem mudança de schema do banco. `audience_rules` continua jsonb.

### 2. Componente novo `src/components/prospecting/hubspot-list-builder.tsx`
- Substitui o uso de `FilterBuilderDialog` por um editor inline (sem modal) com linhas de condição.
- Reaproveita `FilterGroup`/`FilterCondition` de `@/lib/filters` (não muda o modelo).
- Catálogo de propriedades por entidade — reaproveitar o mesmo de `settings.segments.tsx` (`ENTITY_FIELDS`) extraindo para `src/lib/segment-fields.ts` para uso compartilhado.
- Operadores e renderização de input por tipo (text/number/date/select) já suportados em `FilterCondition`.

### 3. Página da campanha (`src/routes/_authenticated/prospecting.campaigns.$id.tsx`)
- Trocar `<AudienceBuilder>` por `<HubspotListBuilder>` com as 3 abas.
- Aba **Listas salvas**: usa `listSegments` (já existente) para popular o combo.
- Contagem ao vivo: chama `previewAudience` com debounce de 400ms quando regras mudam.
- Backward compat: se `lead_ids` legado existir e não houver `audience_rules`, abrir aba "IDs manuais".

### 4. Limpeza
- Remover `audience-builder.tsx` antigo após migração (mantém apenas o novo componente).

## Diagrama de estrutura

```text
┌─ Público da campanha ─────────────────────────┐
│  [Listas salvas] [Construtor inline] [IDs]    │
│                                               │
│  Modo: ( Snapshot | Dinâmica )                │
│                                               │
│  ┌─ Grupo 1: Leads ──────────────────[x]┐     │
│  │ status     é          qualified  [x] │     │
│  │   E                                   │     │
│  │ score      maior que  70         [x] │     │
│  │ [ + E ]                               │     │
│  └───────────────────────────────────────┘     │
│             ─── OU ───                         │
│  ┌─ Grupo 2: Empresas → contatos ─────[x]┐     │
│  │ industry   contém     SaaS       [x] │     │
│  └───────────────────────────────────────┘     │
│  [+ Adicionar grupo]                          │
│                                               │
│  142 leads correspondem · [Ver amostra]       │
└───────────────────────────────────────────────┘
```

## Fora de escopo
- Não mexer no painel de auditoria já existente.
- Não criar novas tabelas; reuso de `segments` / `segment_members`.
- Não alterar o fluxo de disparo da campanha.
