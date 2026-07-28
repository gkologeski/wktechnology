## Objetivo

Garantir que, em qualquer campo de Empresa do sistema, quando o nome digitado não retornar resultados na busca, o usuário possa criar a empresa direto no picker — sem sair do fluxo.

## Situação atual (auditada)

Existem dois componentes distintos de escolha de empresa no app:

### 1. `CompanyPicker` (busca por nome + criação livre)
Já suporta `onCreateNew`. Após correções recentes, está fiado em:
- `src/components/leads/create-lead-dialog.tsx`
- `src/components/contacts/create-contact-dialog.tsx`
- `src/components/properties-panel.tsx` (edição inline + "Ver todas as propriedades")

Nada a fazer aqui.

### 2. `EntityCombobox entity="companies"` (associação estrita por FK)
Não tem suporte a criação inline. Aparece em:
- `src/components/deals/deal-detail-drawer.tsx:522` — vincular empresa ao negócio
- `src/components/contracts/quick-create-contract-dialog.tsx:130` — empresa do contrato
- `src/components/leads/create-deal-from-lead-dialog.tsx:295` — empresa ao converter lead em deal
- `src/routes/_authenticated/tickets.tsx:875` — empresa do ticket
- `src/components/record/associations-panel.tsx` e `add-association.tsx` — associações genéricas

Nesses lugares, se a empresa não existir, o usuário precisa abrir Empresas em outra aba, criar, voltar e associar. É exatamente o gap que o pedido cobre.

## Plano

### Passo 1 — Adicionar suporte a criação inline ao `EntityCombobox`
Adicionar props opcionais:
- `onCreateNew?: (name: string) => void`
- `createLabel?: string` (default "Criar «{nome}»")

Comportamento: quando `onCreateNew` estiver definido e a busca não retornar match exato, exibir no fim da lista um item "Criar «{termo}»" que dispara o callback com o termo atual. Se não passar `onCreateNew`, o combobox continua estrito como hoje (não quebra os outros usos: contatos, deals, projetos, etc.).

### Passo 2 — Ligar `QuickCreateCompanyDialog` em cada consumidor de empresa

Para cada arquivo abaixo, adicionar estado local (`createCompanyOpen`, `pendingCompanyName`), renderizar `QuickCreateCompanyDialog` e passar `onCreateNew` ao `EntityCombobox`. No `onCreated(id)`, aplicar o mesmo patch de campo que o fluxo de seleção normal aplica (setar `company_id` no formulário/registro).

- `src/components/deals/deal-detail-drawer.tsx` — grava `deals.company_id`
- `src/components/contracts/quick-create-contract-dialog.tsx` — seta `company_id` do form
- `src/components/leads/create-deal-from-lead-dialog.tsx` — seta `company_id` do form
- `src/routes/_authenticated/tickets.tsx` — seta `company_id` do ticket
- `src/components/record/add-association.tsx` — quando o tipo alvo for `companies`, ao criar, já registra a associação com o novo id

### Passo 3 — Revisão final
- Rodar typecheck.
- Verificar visualmente em `/deals/:id`, `/contracts` novo, `/leads → converter`, `/tickets` novo, e drawer de associações que o item "Criar «...»" aparece quando o termo não bate.
- Confirmar que consumidores não relacionados a empresa (contatos, deals como associação em outras telas, projetos) continuam sem opção de criar — porque não passam `onCreateNew`.

## Fora do escopo
- Alterar RLS, schema de `companies` ou fluxo do `QuickCreateCompanyDialog`.
- Adicionar criação inline para outras entidades (contatos, deals, produtos) — só empresa, conforme pedido.
- Refatorar `EntityCombobox` além da nova prop.

## Como validar manualmente
1. Em `/deals/:id`, no campo Empresa, digitar um nome inexistente → botão "Criar «Nome»" aparece → clicar → modal → salvar → empresa vinculada ao deal.
2. Repetir em: novo contrato, converter lead em deal, novo ticket, adicionar associação de empresa em qualquer registro.
3. Abrir novo contato (usa `CompanyPicker`) — continua funcionando como antes.
