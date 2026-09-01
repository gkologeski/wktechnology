# Criar índice trigram em contacts para busca no cadastro de lead

## Contexto

O modal "Criar lead" (`src/components/leads/lead-contact-search-step.tsx`) busca contatos por e-mail, nome ou telefone usando `ilike.%term%` em múltiplas colunas. A base de contatos pode crescer rapidamente, e buscas com curinga nos dois lados (`%term%`) não usam índices btree comuns — elas se beneficiam de índices GIN com `gin_trgm_ops`.

## Estado atual

A tabela `public.contacts` já possui índices trigram individuais:

- `idx_contacts_email_trgm` (`gin (email gin_trgm_ops)`)
- `idx_contacts_first_name_trgm` (`gin (first_name gin_trgm_ops)`)
- `idx_contacts_last_name_trgm` (`gin (last_name gin_trgm_ops)`)

Há também duplicatas com prefixo `idx_search_contacts_*`.

A query do cadastro de lead ainda faz `OR` de `ilike` em cada coluna separadamente. O Postgres pode fazer `BitmapOr` sobre os três índices GIN existentes, mas um único índice GIN sobre uma expressão concatenada torna a busca mais previsível e evita múltiplos scans.

## O que será feito

1. Criar um índice GIN trigram sobre a expressão de busca combinada:
   `COALESCE(email, '') || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')`.
2. Manter os índices individuais existentes (não removê-los, pois são usados por outras partes do sistema).
3. Opcionalmente, se o plano for aprovado com essa recomendação, ajustar a query do cadastro de lead para buscar também pela expressão combinada quando o termo não for um e-mail exato — isso garante uso direto do novo índice.

## Detalhes técnicos

- Migration: DDL puro, sem alteração de dados.
- SQL previsto:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_contacts_search_trgm
  ON public.contacts
  USING gin ((COALESCE(email, '') || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) gin_trgm_ops);
  ```
- Não há mudança de schema, RLS, permissões ou regra de negócio.
- Após aplicar, validar com `EXPLAIN` que a query do cadastro de lead usa o índice (diretamente ou via `BitmapOr` dos GIN).

## Como validar

1. Aplicar a migration com `lov_database--migration`.
2. Rodar `bun run typecheck` e `bun run lint` (sem mudanças de código se optarmos por só criar o índice).
3. Testar busca no modal "Criar lead" com termos curtos (3+ caracteres) e verificar tempo de resposta.
4. Opcionalmente executar `EXPLAIN` na query de busca para confirmar uso do índice GIN.
