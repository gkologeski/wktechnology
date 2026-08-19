# Publicar + lote `assigned_to` em contacts, companies, activities, leads e deals

## Estado atual (verificado no banco)

- Nenhuma das cinco tabelas tem `assigned_to` hoje. Todas têm `owner_id` e `workspace_id`.
- Em `contacts`, os 51.042 registros têm `owner_id` apontando para um **usuário** real (`profiles`), não para workspace — então `owner_id` serve de base confiável para o backfill do responsável.
- `activities` tem `created_by` preenchido em 433.577 de 433.675 registros.
- O padrão já adotado nas tabelas que possuem a coluna (ex.: `ats_candidates`) é `assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL`.
- Volumes: activities 433.675 | contacts 51.042 | companies 31.970 | leads 5.815 | deals 2.053.

## Passos

1. **Publicar o app** no estado atual (as colunas `workspace_id` já aplicadas nos lotes anteriores entram em produção antes de novas mudanças).
2. **Cinco migrations, uma por vez**, na ordem das menores para as maiores (menor risco de timeout primeiro):
   1. `deals`
   2. `leads`
   3. `companies`
   4. `contacts`
   5. `activities` (maior volume; backfill em passo separado dentro da própria migration)

Cada migration faz somente:

- `ALTER TABLE public.<tabela> ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;`
- `CREATE INDEX idx_<tabela>_assigned_to ON public.<tabela>(assigned_to);`
- Backfill: `assigned_to = COALESCE(created_by, owner_id)` quando esse valor existir em `auth.users` (em `activities`, `created_by` tem prioridade; nas outras quatro, `owner_id`).

## Fora do escopo deste lote

- Nenhuma política de RLS, grant, função ou trigger é alterada. `assigned_to` é apenas atributo de negócio; o isolamento continua por `workspace_id`/`owner_id`.
- Nenhuma remoção de `owner_id`.
- Nenhuma mudança de UI, telas, filtros ou server functions — a coluna nasce aditiva e nada lê ainda. Exposição na interface (coluna/filtro Responsável) fica para o lote seguinte.

## Validação

- Após cada migration: conferir que a coluna e o índice existem e contar quantos registros ficaram com `assigned_to` preenchido vs. nulo.
- Ao final do lote: typecheck e lint (os tipos do banco são regerados automaticamente após cada migration).
- Linter de segurança do banco no fim, para confirmar que nada regrediu.

## Riscos

- `activities` é a maior tabela; o backfill pode ser lento. Se estourar o tempo, o backfill dessa tabela é refeito em migration separada por faixas de `created_at`, sem desfazer a coluna já criada.
- Registros cujo `owner_id`/`created_by` não exista mais em `auth.users` ficam com responsável nulo — comportamento esperado, sem violação de FK.
