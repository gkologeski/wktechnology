# Dar acesso à Fila de prospecção para andressa@

## Diagnóstico (verificado no banco)

- Andressa **já é admin do workspace** (`workspace_members.role = admin`) e o cálculo de permissões efetivas retorna 1.648 chaves para ela — ou seja, ela **tem** `techsales.prospecting.queue.view` e passa no gate da aba "Fila".
- O bloqueio é na visibilidade das **filas em si**. A política de leitura de `prospecting_queues` só libera:
  `owner_id = usuário` OU `assigned_to = usuário` OU (mesmo workspace E (`is_shared` OU permissão `techsales.prospecting.queue.view.workspace`)).
- Essa chave **`techsales.prospecting.queue.view.workspace` não existe no catálogo de permissões** (só existem `queue.view`, `queue.view.own` e `queue.view.team`). Como nenhuma permissão pode ser concedida, a condição nunca é verdadeira.
- As 4 filas existentes pertencem/estão atribuídas a outros usuários e todas têm `is_shared = false`. Guilherme vê porque é o dono; Andressa vê a aba vazia.

## O que será feito

1. Cadastrar a permissão faltante `techsales.prospecting.queue.view.workspace` no catálogo (mesmo módulo/recurso das demais chaves de fila, ação "exibir", escopo workspace).
   - Efeito imediato: quem é admin/owner do workspace recebe automaticamente todas as chaves do catálogo — Andressa passa a ver todas as filas, exatamente como Guilherme.
   - Efeito para os demais cargos: nada muda; a chave nasce sem estar em nenhum conjunto de permissões e pode ser concedida caso a caso em Configurações → Permissões.
2. Conferir que a chave aparece na matriz de `/settings/permissions` (linha "Fila de prospecção → Exibir", coluna escopo "Todos").
3. Validar por consulta que a política de leitura passa a retornar as 4 filas para Andressa e continua retornando as mesmas para Guilherme.

Sem alteração de política RLS, de schema das tabelas, de código de aplicação ou de dados das filas (nenhuma fila será marcada como compartilhada).

## Detalhes técnicos

- Migration única e idempotente: `INSERT INTO public.permissions (key, module, resource, action, scope, label/description conforme o padrão das linhas irmãs) ... ON CONFLICT (key) DO NOTHING`, copiando os metadados das linhas `techsales.prospecting.queue.view*` já existentes para manter agrupamento e rótulos PT-BR consistentes.
- Nenhuma nova tabela → nenhum `GRANT`/RLS novo necessário; `permissions` é catálogo global já exposto.
- Observação registrada, fora do escopo: as políticas de `prospecting_queues` não usam `queue.view.team`, então o escopo "Da minha equipe" continua sem efeito prático nessa tabela. Corrigir isso exigiria mexer na política — não será feito agora.

## Validações

- `bun run typecheck` e `bun run lint` (sem mudança de código esperada, roda como conferência).
- Consultas de verificação: `user_effective_permissions` da Andressa contendo a nova chave; contagem de filas visíveis para Andressa e para Guilherme.
- Validação manual: entrar como Andressa em `/prospecting` → aba **Fila** e confirmar que as filas aparecem e abrem em modo de execução.
