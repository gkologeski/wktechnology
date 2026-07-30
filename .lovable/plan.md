# Campo Responsável em Leads, Contatos, Empresas e Negócios + fila de prospecção vazia

## Diagnóstico (confirmado)

A fila "Fila teste 001" é manual, entidade `lead`, com 33 itens — e os 33 leads existem no banco, todos com status `new` e no seu workspace. Os dados estão corretos.

A consulta que alimenta a tela falha antes de retornar qualquer linha: ela pede a coluna `assigned_to` em `leads`, e essa coluna **não existe**. Verificado no banco: `leads`, `contacts`, `companies` e `deals` não têm `assigned_to` (a coluna foi criada em outras 58 tabelas, mas não nas quatro entidades centrais de CRM). Todas as quatro têm `owner_id`.

Com a consulta em erro, a tela cai no estado vazio genérico — o que também explica o rótulo "0 contatos" numa fila de leads e o botão "Iniciar fila" desabilitado. O filtro "Todos os responsáveis" não tem relação com o problema.

## O que será feito

1. **Criar o campo Responsável nas quatro entidades** (migração): coluna `assigned_to` em `public.leads`, `public.contacts`, `public.companies` e `public.deals`, com preenchimento inicial a partir do dono do registro (`owner_id`) e índice para filtragem. Sem alterar RLS, permissões ou regras de negócio existentes.
2. **Expor o Responsável nas telas dessas entidades**: coluna/campo de responsável e filtro por responsável em Leads, Contatos, Empresas e Negócios, usando os componentes já existentes (`AssigneeFilter`, `AssigneeCell`, `AssigneeField`), e incluir `assigned_to` nas consultas que alimentam essas telas.
3. **Corrigir a fila de prospecção**: consultas de listagem e contagem resilientes, com estado de erro visível (mensagem + "tentar novamente") em vez de "nenhum item", e rótulo de contagem usando a entidade da própria fila.
4. **Validar**: abrir `/prospecting?tab=fila` e confirmar os 33 leads listados, botão "Iniciar fila" habilitado e filtro por responsável funcionando (Todos / Meus registros / Sem responsável); conferir também as telas de Leads, Contatos, Empresas e Negócios.

## Detalhes técnicos

- Migração: `ALTER TABLE ... ADD COLUMN assigned_to uuid` nas quatro tabelas, backfill `assigned_to = owner_id`, índices `(owner_id, assigned_to)`. Sem FK para `auth.users` (padrão já adotado nas outras 58 tabelas).
- `src/lib/prospecting/queues.functions.ts`: `listQueueItems` / `countQueueItems` — selects coerentes com o schema e erro tratado.
- `src/components/prospecting/queue-tab.tsx`: `QueueWorkspace` recebe a entidade via prop e ganha estado de erro, mantendo loading/empty atuais.
- Telas de CRM: `leads.index`, `contacts.index`, `companies.index` e a lista de negócios (`deals-list` / grid) recebem o filtro e a coluna de responsável; as server functions/consultas correspondentes passam a selecionar `assigned_to`.
- Após a migração, os tipos do banco são regerados e o código passa a usar a coluna sem casts.
