## Objetivo

Padronizar o modal "Criar negócio" aberto a partir da empresa (e demais entidades) para exibir os campos pertinentes do negócio, alinhado ao `DealDetailDrawer`.

## Contexto

- Ao clicar em "Criar" no card de Negócios em uma empresa/contato/lead, é aberto `QuickCreateDealDialog` (`src/components/record/quick-create-dialogs.tsx`), que hoje mostra apenas **Nome** e **Valor**.
- O padrão de campos do negócio (usado no `DealDetailDrawer`) inclui: pipeline, etapa, responsável, empresa, contato principal, valor + moeda, data prevista de fechamento.
- O mesmo dialog é reutilizado pelo card de contatos/leads → a padronização beneficia todos os pontos.

## Escopo

Editar apenas `QuickCreateDealDialog` em `src/components/record/quick-create-dialogs.tsx`. Nenhuma alteração de RLS, schema ou lógica de negócio.

### Campos do modal padronizado

1. **Nome** *(obrigatório, autofocus)*
2. **Pipeline** — via `usePipelines("deal")`; default = primeiro pipeline
3. **Etapa** — dependente do pipeline selecionado; default = primeira etapa
4. **Responsável** — `OwnerField` (default: usuário atual)
5. **Empresa** — pré-preenchida quando `defaultCompanyId` vier do contexto; editável via combobox (mesma UX usada no drawer)
6. **Contato principal** — pré-preenchido quando `defaultContactId` vier do contexto; editável
7. **Valor + Moeda** — `CurrencyInput` (default BRL)
8. **Data prevista de fechamento** — input `date`

### Comportamento

- Ao submeter, insere em `deals` os campos acima + `stage`/`stage_id` derivados do pipeline (mesma lógica do `DealDetailDrawer`, incluindo o mapeamento `won/lost/new` para o enum legado `stage`).
- Se houver `defaultContactId`, mantém o insert em `deal_contacts` já existente.
- Após criar, toast + callback `onCreated(dealId)` mantidos.
- Reset do formulário ao fechar.
- Layout: 2 colunas em `sm:` (Pipeline/Etapa, Responsável/Data, Valor/Moeda) para não estourar a altura; largura `sm:max-w-lg`.

## Detalhes técnicos

- Reaproveitar: `usePipelines`, `OwnerField` (`src/components/entity/owner-field.tsx`), `CurrencyInput`, combobox de empresa/contato usado no `DealDetailDrawer` (extrair via import direto se já for componente isolado; caso contrário, usar `Select`/`Command` simples com queries `companies`/`contacts` limitadas a 50 + busca por `ilike`).
- Preservar o payload atual (owner_id, currency, stage, stage_id, company_id, primary_contact_id) e adicionar `pipeline_id` e `expected_close_date`.
- Sem migrações, sem mudanças em outros arquivos.

## Fora de escopo

- Custom fields do negócio no quick-create (permanecem apenas no drawer completo).
- Alterar `CreateDealFromLeadDialog` (já tem seu próprio fluxo mais rico).
