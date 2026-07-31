# Permissões por escopo: nova matriz em /settings/permissions

Reformular `/settings/permissions` para a mesma leitura de `/settings/rbac-diagnostics`: uma linha por **Módulo → Recurso → Funcionalidade**, e uma coluna por **papel (cargo)**, onde cada célula é um combo de escopo em vez de checkbox.

## Como fica a tela

Colunas: `Módulo | Recurso | Funcionalidade | <Cargo 1> | <Cargo 2> | ...`

Cada célula do cargo é um select com, no máximo, 4 opções:

- Nenhuma (sem acesso)
- Meu(s)/Minha(s)
- Da minha equipe
- Todos

As opções exibidas vêm do catálogo de permissões: só aparece o escopo que existe como chave real (`modulo.recurso.acao.escopo`). Hoje o catálogo tem:

- Exibir / Editar / Excluir → own, team, workspace (combo completo)
- Aprovar → team, workspace
- Criar → own, workspace
- Exportar / Acesso total / Atribuir → apenas workspace

## Escopo travado por natureza da ação

Algumas ações não fazem sentido escopar. Nesses casos o combo mostra o valor fixo e fica desabilitado para troca de escopo:

- Criar → travado em "Meu(s)/Minha(s)" (o registro criado nasce do próprio usuário)
- Exportar → travado em "Todos" (exporta o que o usuário já consegue ver)
- Acesso total e Atribuir → travados em "Todos" (só existe esse escopo)

Para essas ações, conceder ou remover a permissão continua possível alternando entre "Nenhuma" e o valor fixo; o que fica bloqueado é escolher outro escopo. As demais ações permanecem com o combo livre.

## Comportamento

- Selecionar um escopo grava a chave correspondente e remove as outras chaves da mesma ação/recurso naquele cargo (o escopo é exclusivo, não cumulativo).
- Selecionar "Nenhuma" remove todas as chaves daquela ação/recurso no cargo.
- Cargos do sistema seguem somente leitura (combo desabilitado, com o ícone de cadeado atual).
- Atualização otimista imediata, com rollback e toast em caso de erro — mesmo padrão já usado.
- Mantém as funções atuais de cargo: novo, duplicar, renomear, excluir, restaurar padrões.
- Mantém abas de módulo e busca; a busca passa a filtrar por recurso, funcionalidade e chave. Coluna Módulo visível para dar o mesmo formato do wireframe.
- Estados de carregamento, erro (com "Tentar novamente") e vazio preservados; primeira coluna sticky, texto com quebra de linha, células centralizadas.

## Detalhes técnicos

- `src/lib/access-control/scope-matrix.ts` (novo, puro e testável): agrupa `permissions` por `module.resource.action`, resolve escopos disponíveis, escopo efetivo por cargo, política de escopo travado e a lista de chaves a conceder/remover em uma troca. Reusa `SCOPE_LABELS_PT`/`ACTION_LABELS_PT` de `action-matrix.ts`, acrescentando os rótulos curtos do wireframe.
- `src/components/access-control/permissions-matrix.tsx`: reescreve o corpo da tabela para linhas por funcionalidade com `Select` (shadcn) por cargo; grava via `bulkSetRolePermissions` (uma chamada por célula, concedendo a nova chave e removendo as antigas).
- Sem mudança de schema, de RLS ou das server functions de gravação; o backend já valida admin do workspace em `setRolePermission`/`bulkSetRolePermissions`.
- Testes unitários novos para `scope-matrix.ts` (escopos disponíveis, escopo efetivo, ações travadas, diff de chaves) + typecheck/lint/build e verificação visual no preview.
