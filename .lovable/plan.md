# Tarefas: fazer a lista carregar

Porte: P — estimativa 30–45 min (inclui teste no navegador).

## Diagnóstico (confirmado)

- A paginação de 100 por vez já está no código, mas não resolve sozinha: a lista pede as tarefas **ordenadas por prazo**, e não existe índice nessa ordem.
- Sem índice, o banco precisa pegar as ~32.300 tarefas, conferir a permissão de cada uma (regra `work_view`, uma checagem por linha) e só depois ordenar e cortar as 100 primeiras. É isso que leva 30–70 s e estoura o tempo.
- Distribuição atual: 20.773 concluídas, 11.522 a fazer, 41 em andamento; só ~13.800 têm prazo.
- O banco está saudável agora (memória 39%, conexões baixas); houve uma queda momentânea de conexão durante a análise, sem alerta de esgotamento.

## O que será feito

1. **Índice na mesma ordem da lista** (somente adição, sem mexer em regra de acesso nem dados): por workspace + prazo + data de criação + id. Com ele, o banco lê as tarefas já na ordem e para assim que encontra as 101 necessárias, conferindo a permissão de poucas linhas em vez de 32 mil.
2. **Medir antes e depois** com a sessão real do Guilherme (consulta igual à da tela, página 1 e página 10, com e sem "Minhas").
3. Se a medição mostrar que o banco ainda não usa o índice, ajustar a consulta da lista para filtrar pelo workspace atual explicitamente (mesma regra, só ajuda o banco a escolher o índice) — sem mudar o que cada pessoa pode ver.
4. **Testar no navegador**: lista carregando, "Próxima"/"Anterior", busca, "Minhas", clique abrindo o painel de detalhes, edição de um campo, link direto `?taskId=`, tema escuro e celular.

## Fora do escopo (sem alteração)

- Regra de permissão das tarefas, dados, publicação.
- Tela de cada projeto (ex.: OS - Citel) continua carregando tudo de uma vez — fica como próximo passo separado.

## Detalhes técnicos

- Migration nova: `CREATE INDEX project_tasks_ws_due_created_idx ON public.project_tasks (workspace_id, due_at ASC NULLS LAST, created_at DESC, id)`.
- Consulta afetada: `listAllProjectTasks` em `src/lib/projects.functions.ts` (ORDER BY due_at, created_at desc, id + range). Ajuste opcional do passo 3: `.eq("workspace_id", <workspace ativo>)`.
- Validação: `permissions:check`, ESLint, typecheck em segundo plano, Playwright com sessão `--self`.
