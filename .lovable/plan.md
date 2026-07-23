## Objetivo

Expandir a ficha de Pessoa (`/people/$id`) com novos campos estruturados e migrar os dados atualmente colados no bloco "Notas internas" (importados do Google Forms) para colunas dedicadas.

## 1. Migração de schema (`public.people`)

Adicionar colunas nullable, sem alterar RLS:

- **Dados básicos**: `education text`, `shirt_size text`, `emergency_phone text`, `emergency_relationship text`, `marital_status text`, `spouse_name text`
- **Financeiro (restrito)**: `bank text`, `bank_agency text`, `bank_account text`, `pix_key text`, `address text`
- **Pessoa jurídica**: `trade_name text`, `simples_optante boolean` *(reaproveita `cnpj` e `legal_entity_name` já existentes)*

Nada muda em policies, grants ou triggers.

## 2. Backfill dos dados

Na mesma migration, um `UPDATE public.people` faz parse do `notes` linha a linha usando `regexp_match`/`substring`:

- `Razão Social: X` → `legal_entity_name`
- `Nome Fantasia: X` → `trade_name`
- `Optante Simples: Sim/Não` → `simples_optante`
- `Escolaridade: X` → `education`
- `Camiseta: X` → `shirt_size`
- `Recado: <texto>` → separa dígitos consecutivos (7+) em `emergency_phone`; restante (após remover o número) vira `emergency_relationship`
- `Banco: <banco> — Ag <ag> / Conta <conta>` → `bank`, `bank_agency`, `bank_account`
- `PIX: X` → `pix_key`
- `Endereço: X` → `address`
- `Estado civil: X` → `marital_status`
- `Cônjuge: X` → `spouse_name`

Aplica-se somente onde a coluna alvo está NULL (não sobrescreve dados já preenchidos). O `notes` é preservado como está — nenhum dado é apagado.

## 3. Server function (`src/lib/people/people.functions.ts`)

- Estender `PersonRow`, `upsertSchema` e a lista de colunas dos `SELECT` (`getPerson` / `listPeople` conforme necessário) com os novos campos.
- Estender o `payload` do `upsertPerson` para gravar os novos campos, aplicando `normalize()` (string) e coerção booleana para `simples_optante`.
- Sem mudança em autorização/RLS.

## 4. UI (`src/routes/_authenticated/people.$id.tsx`)

Card **Dados básicos** — acrescentar, mantendo o grid `md:grid-cols-2`:
- Escolaridade (Input)
- Tamanho de camiseta (Input)
- Telefone de recado (Input)
- Parentesco do telefone de recado (Input)
- Estado civil (Input)
- Cônjuge (Input)

Novo card **Dados pessoa jurídica** (renderizado logo abaixo de "Dados básicos", visível a todos que veem o perfil):
- CNPJ, Razão social, Nome fantasia, Optante Simples (Select Sim/Não)

Card **Financeiro (restrito)** — manter Custo/hora e acrescentar:
- Banco, Agência, Conta, PIX, Endereço

Todos os campos usam os componentes já importados (`Input`, `Label`, `Select`). O botão **Salvar** existente envia tudo em um único `upsertPerson` — sem novos endpoints.

## Observações técnicas

- Nenhuma alteração em RLS, grants, permissões ou fluxos de importação.
- `notes` continua exibido no card "Notas internas" — o backfill apenas duplica a informação em campos estruturados; usuário pode limpar as notas manualmente depois.
- `simples_optante` é `boolean` nullable; UI mostra `—` quando desconhecido.

## Como validar

1. `/people/<id>` de uma pessoa importada do Google Forms: os novos campos devem aparecer preenchidos.
2. Editar um campo, salvar, recarregar — persiste.
3. Criar pessoa nova pelo diálogo existente: campos novos vazios, edição na ficha grava normalmente.
4. Card "Financeiro (restrito)" só aparece para quem já via (sem mudança de regra).

## Riscos / pendências

- Parse do "Recado" é heurístico (regex de dígitos); linhas atípicas podem cair inteiras em `emergency_relationship`. O texto original permanece em `notes` como referência.
- Nenhum teste automatizado novo — mudança é aditiva de campos e migração idempotente por `IS NULL`.
