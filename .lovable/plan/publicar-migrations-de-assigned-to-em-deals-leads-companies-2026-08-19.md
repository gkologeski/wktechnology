# Publicar + migrations de `assigned_to` em deals, leads, companies, contacts e activities

## Estado atual (verificado no banco agora)

- Nenhuma das cinco tabelas tem `assigned_to` hoje — incluindo `deals` (a migration anterior não ficou aplicada). Todas as cinco precisam ser feitas.
- Todas têm `owner_id` e `workspace_id`. Somente `activities` tem `created_by`.
- Padrão já adotado em outras tabelas do projeto: `assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL`.

## Passos

1. **Publicar o app** no estado atual, antes de novas mudanças de schema.
2. **Cinco migrations, uma por vez**, da menor para a maior tabela (menor risco de timeout primeiro):
   1. `deals`
   2. `leads`
   3. `companies`
   4. `contacts`
   5. `activities` (maior volume; backfill em passo separado dentro da própria migration)

Cada migration faz apenas:

- `ALTER TABLE public.<tabela> ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;`
- `CREATE INDEX IF NOT EXISTS idx_<tabela>_assigned_to ON public.<tabela>(assigned_to);`
- Backfill somente quando o valor existir em `auth.users`:
  - `activities`: `COALESCE(created_by, owner_id)`
  - demais quatro: `owner_id`

## Fora do escopo deste lote

- Nenhuma alteração de RLS, grants, funções ou triggers. `assigned_to` é apenas atributo de negócio; o isolamento continua por `workspace_id`/`owner_id`.
- Nenhuma remoção de `owner_id`.
- Nenhuma mudança de UI, filtros ou server functions — a coluna nasce aditiva e nada lê ainda. A exposição na interface (coluna/filtro Responsável) fica para o lote seguinte.

## Validação

- Após cada migration: confirmar coluna + índice e contar preenchidos vs. nulos.
- No fim do lote: typecheck e lint (tipos do banco são regerados após cada migration) e linter de segurança do banco.

## Riscos

- `activities` é a maior tabela; se o backfill estourar o tempo, ele é refeito em migration separada por faixas de `created_at`, sem desfazer a coluna já criada.
- Registros cujo `owner_id`/`created_by` não exista mais em `auth.users` ficam com responsável nulo — comportamento esperado.
