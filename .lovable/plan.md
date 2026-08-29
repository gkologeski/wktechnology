# Corrigir "Não foi possível carregar o painel" em /dashboard

## O que foi verificado

- A tela mostra esse aviso quando a consulta `["sales-dashboard",30,null,"me"]` falha. A mensagem exibida, `data is undefined`, é o erro do TanStack Query quando a função de busca resolve **sem valor** (não é uma falha de banco).
- Reproduzido no navegador autenticado, a chamada de servidor do painel respondeu **200 com dados completos** (pipelines, KPIs, funil). Ou seja, a agregação em si funciona; o que quebra é o caminho em que a chamada retorna vazio — tipicamente quando o token da sessão ainda não está disponível no momento em que a consulta dispara (a função é protegida por autenticação e responde 401/redirecionamento, e o cliente devolve `undefined` em vez de um erro).
- Hoje a tela não trata esse caso: ela chama a função direto no `useQuery`, sem esperar a sessão e sem transformar o retorno vazio em erro legível, e sem repetir a tentativa.

## O que será feito

1. **Esperar a sessão antes de consultar** — `/dashboard` só dispara a consulta do painel depois que a sessão do usuário estiver carregada; enquanto isso mostra o skeleton (não o erro).
2. **Retorno vazio vira erro claro e com nova tentativa** — se a chamada resolver sem dados, a tela passa a exibir "Sessão expirada ou indisponível. Entre novamente ou tente atualizar", em vez de `data is undefined`, e a consulta tenta novamente automaticamente (2 tentativas com espera crescente) antes de mostrar o erro.
3. **Painel resiliente a falhas parciais** — no agregador do painel, falhas em consultas secundárias (permissões, metas, reuniões, agendamentos, tarefas, leads) deixam de derrubar a tela inteira: o bloco correspondente aparece vazio e o restante carrega. Só erro de pipelines/negócios continua sendo erro de tela cheia.
4. **Mensagem de erro útil** — o estado de erro passa a mostrar a causa real quando houver, mantendo o botão "Tentar novamente" e o padrão visual atual (`EmptyState`).

## Detalhes técnicos

- `src/routes/_authenticated/dashboard.tsx`: usar o id do usuário autenticado (hook existente `use-current-user-id`) como `enabled` da consulta; envolver o `queryFn` para lançar `Error` quando o resultado for nulo/indefinido; adicionar `retry: 2` com `retryDelay` exponencial; manter skeleton enquanto `enabled` for falso.
- `src/lib/deals/sales-dashboard.server.ts`: proteger `current_user_permissions_json` e as consultas secundárias com tratamento de erro (fallback para lista vazia / `canViewTeam: false`) em vez de propagar exceção.
- Sem alterações de schema, RLS, permissões ou de qualquer outra tela.

## Validação

`bunx tsgo --noEmit`, `bun run lint`, `bun run test` e verificação no navegador autenticado em `/dashboard` (carregamento normal e recarregamento com sessão fria).
