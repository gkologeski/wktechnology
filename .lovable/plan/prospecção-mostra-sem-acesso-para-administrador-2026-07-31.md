# Prospecção mostra "Sem acesso" para administrador

## O que já foi verificado

- No banco, seu usuário (`guilherme@wktechnology.com.br`) é **admin e criador** do workspace WK Technology.
- A função `user_effective_permissions` executada diretamente no banco retorna **1584 permissões** (o catálogo inteiro), incluindo todas as chaves `techsales.prospecting.*` usadas pelas abas.
- As chaves esperadas pela tela (`techsales.prospecting.queue.view`, `...cadences.view`, etc.) existem no catálogo exatamente com esses nomes.
- Não há nenhum override de `deny` para o seu usuário.

Conclusão: a permissão existe no backend. O bloqueio acontece no caminho do cliente — a tela só chega a esse estado quando `getMyPermissions` **retorna vazio ou falha** (erro/timeout/401). Hoje a tela não distingue "sem permissão" de "a consulta falhou": em ambos os casos exibe "Sem acesso à Prospecção".

Um suspeito concreto: `authenticated` tem `statement_timeout = 8s` e o catálogo cresceu para 1584 permissões; a consulta de permissões efetivas passou a ser bem mais pesada. Isso ainda **não está confirmado** e é o primeiro passo do plano.

## Plano

### 1. Confirmar a causa (antes de qualquer correção)

- Instrumentar `usePermissions` para expor `isError`/mensagem do erro e registrar no console o resultado real de `getMyPermissions` (quantidade de chaves e workspace resolvido).
- Abrir `/prospecting` autenticado e ler o retorno: vazio, erro de timeout, 401 ou lista truncada.

### 2. Corrigir conforme o diagnóstico

- **Se for timeout/lentidão**: otimizar `user_effective_permissions` (atalho: quando o usuário é owner/admin do workspace, retornar direto `SELECT key FROM permissions` sem os UNIONs e o anti-join de deny) e/ou adicionar índices em `user_job_roles`, `permission_set_items` e `job_role_permission_overrides`.
- **Se for erro/401 pontual**: adicionar `retry` na query de permissões.
- **Se vier truncado**: trocar o retorno do RPC por um único array agregado, imune a limite de linhas da API.

### 3. Não confundir mais falha com falta de permissão

- Em `usePermissions`, expor `isError`.
- Em `/prospecting` (e no padrão dos demais gates), quando a consulta falhar, mostrar um **ErrorState** com "Não foi possível carregar suas permissões" + botão "Tentar novamente", em vez do card "Sem acesso".

## Detalhes técnicos

Arquivos envolvidos:

- `src/lib/access-control/use-permissions.tsx` — expor `isError`, `refetch` e retry.
- `src/routes/_authenticated/prospecting.index.tsx` — separar estado de erro do estado de sem-permissão.
- `src/lib/access-control/permissions.functions.ts` — logging temporário do diagnóstico.
- Migration opcional (somente se confirmado o problema de desempenho): reescrita de `public.user_effective_permissions` com caminho rápido para owner/admin, mantendo assinatura, `SECURITY DEFINER` e a semântica atual de deny.

Sem alteração de RLS, de schema de dados ou de regra de negócio de permissões.
