# Correções: botão de exclusão em Empresas e grid de /contracts

## Parte 1 — Botão "Excluir" habilitado indevidamente (usuário marketing@)

### Situação verificada
- A política de exclusão de `companies` no banco só permite: `manage.workspace`, `delete.workspace`, ou `delete.own` **quando o registro é do próprio usuário**.
- As permissões efetivas do usuário marketing@ no workspace ativo são: `view.workspace`, `update.team`, `create.own`, `delete.own`.
- Esse usuário não é responsável (`owner_id`) por nenhuma das empresas cadastradas.
- A tela de detalhe (`companies.$id.tsx`) já calcula o `disabled` a partir do hook `useCanDelete`, e por essa regra o botão deveria estar desabilitado.

Ou seja: a causa exata de o botão aparecer habilitado **ainda não está confirmada** (possibilidades: cache de permissões no cliente, workspace ativo diferente no momento do teste, ou build antiga na URL usada). Confirmar é o primeiro passo.

### Passo 1 — Confirmar a causa
- Adicionar ao painel `/settings/rbac-diagnostics` um bloco "Posso excluir este registro?": informa recurso, registro, workspace ativo, permissões de exclusão recebidas, responsável do registro e decisão final, com a resposta vinda do servidor.
- Com isso o comportamento do usuário marketing@ é reproduzível e auditável, em vez de inferido.

### Passo 2 — Tornar a decisão autoritativa no servidor
- Nova server function que responde "pode excluir?" por recurso + registro, aplicando exatamente as mesmas regras do banco (permissões efetivas no workspace ativo + responsável do registro).
- `useCanDelete` passa a consumir essa resposta como fonte de verdade, mantendo a regra atual apenas como estado inicial enquanto carrega (mantendo o botão desabilitado no carregamento). Isso elimina divergência entre UI e banco por cache ou workspace incorreto.

### Passo 3 — Padronizar o botão
- Criar um componente único de botão de exclusão (ícone/label, `disabled`, `aria-disabled`, tooltip com o motivo) e usá-lo na tela de detalhe de Empresas e nas demais telas de detalhe que hoje repetem esse bloco.
- Aplicar o mesmo gating nas ações da grid de Empresas: a ação de excluir de cada linha e a de exclusão em lote passam a ficar visíveis mas desabilitadas quando não permitido (hoje a de linha não verifica nada antes de chamar o banco).

Nenhuma política de banco, permissão ou escopo será alterada — a exclusão continua bloqueada pelo banco como hoje.

## Parte 2 — Grid de /contracts sem seleção nem alteração

Hoje `ContractsTable` é somente leitura: apenas links para o detalhe.

Passa a ter, seguindo o padrão já usado na grid de Empresas:
- Coluna de seleção com checkbox no cabeçalho (selecionar/limpar tudo) e por linha, com contador de selecionados.
- Barra de ações em lote para os selecionados: alterar status, definir responsável e excluir — cada ação visível sempre, habilitada conforme as permissões de contratos, e com confirmação na exclusão.
- Edição inline nas colunas de Status e Responsável (as demais permanecem em leitura, com edição completa no detalhe).
- Ação por linha para abrir o detalhe e excluir, desabilitada com tooltip quando sem permissão.
- Exclusões e alterações em lote usam os helpers existentes que detectam bloqueio pelo banco, exibindo quantos registros foram realmente afetados (sem falso "sucesso").
- Estados de carregando/vazio/erro preservados; a visão agrupada (empresa, serviço, cargo, senioridade) recebe a mesma tabela, mantendo seleção entre grupos.
- Após qualquer alteração, o cache da lista é invalidado para refletir na hora.

## Detalhes técnicos
- Arquivos afetados: `src/lib/access-control/use-can-delete.tsx`, nova server function em `src/lib/access-control/`, `src/routes/_authenticated/rbac-diagnostics` (painel), novo `src/components/records/delete-record-button.tsx`, `src/routes/_authenticated/companies.$id.tsx`, `src/routes/_authenticated/companies.tsx`, `src/components/contracts/contracts-grouped-list.tsx`, `src/routes/_authenticated/contracts.index.tsx` e uma server function de atualização em lote em `src/lib/contracts.functions.ts`.
- Sem migrations, sem mudança de RLS, sem alteração de regra de negócio.
- Validação: typecheck, lint e build; verificação manual na grid de contratos e na tela de detalhe de empresa.
