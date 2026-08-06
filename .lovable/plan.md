# Botão Excluir nas telas de detalhe respeitando permissões

## Diagnóstico (verificado)

O grid de empresas esconde "Excluir" porque envolve a ação com o componente de permissão (`techsales.companies.delete.workspace` / `.own`). A tela de detalhe (`companies.$id`) não faz nenhuma checagem de permissão — o botão de lixeira é sempre renderizado e a função de exclusão chama o banco diretamente.

O mesmo ocorre nas outras telas de detalhe. Das 14 telas de detalhe verificadas, somente `deals.$id` checa permissão antes de exibir/executar a exclusão; `tasks.$id`, `tickets.$id`, `contacts.$id`, `companies.$id`, `contracts.$id`, `services.$id`, `people.$id`, `leads.$id`, `projects.$id`, `projects.lists.$id`, `prospecting.campaigns.$id` e `finance.entries.$id` não têm nenhuma referência a permissões.

Observação importante: hoje a exclusão indevida não passa silenciosamente no banco em empresas — o guard de exclusão detecta 0 linhas afetadas e avisa. Mas o botão aparece habilitado, o que é o problema relatado.

## O que será feito

1. **Regra única de "pode excluir"** — criar um utilitário compartilhado que decide se o usuário pode excluir um registro, seguindo o padrão já usado em Negócios:
   - permissão de gerência/exclusão no workspace → pode excluir qualquer registro;
   - permissão de exclusão por equipe → pode excluir registros de responsáveis da sua equipe;
   - permissão de exclusão apenas própria → só quando o registro é dele (responsável/criador);
   - nenhuma dessas → botão não aparece.
2. **Aplicar em todas as telas de detalhe** listadas acima: o botão de excluir só é renderizado quando a regra permite, e a função de exclusão bloqueia com mensagem clara caso seja chamada sem permissão (defesa em profundidade).
3. **Padronizar o feedback de exclusão** nas telas que ainda excluem sem o guard: usar o guard existente, que exibe "Você não tem permissão para excluir este registro" quando o banco bloqueia, em vez de dizer "excluído" e voltar para a lista.
4. **Alinhar o grid de empresas** para usar a mesma regra por registro (hoje o menu da linha aparece com permissão "própria" mesmo em empresas de outro responsável).

## Detalhes técnicos

- Novo hook em `src/lib/access-control/use-can-delete.tsx`: `useCanDelete(resourceKey)` retorna `canDeleteRecord(record)` avaliando `${resourceKey}.manage.workspace`, `.delete.workspace`, `.delete.team`, `.delete.own` via `usePermissions()`, comparando `owner_id`/`assigned_to`/`created_by` com o usuário atual; para o escopo de equipe, reaproveita `useResourceScope(resourceKey, "delete")` (que já devolve `owner_ids` da equipe).
- Refatorar `deals.$id.tsx` e `deal-detail-drawer.tsx` para consumirem o hook, eliminando a duplicação da regra.
- Telas de detalhe: envolver o botão de lixeira com a checagem e adicionar early-return na função `remove()`; trocar `supabase.from(...).delete()` direto por `deleteRowGuarded` onde ainda não é usado.
- Chaves de recurso por tela: `techsales.companies`, `techsales.contacts`, `techsales.leads`, `techsales.deals`, `techsales.activities` (tarefas), `techsales.tickets`, `techcontract.contracts`, `catalog.services`, `techpeople.people`, `techprojects.projects` e correlatos — cada tela usará a chave já cadastrada no RBAC para o seu recurso (confirmada no catálogo de recursos antes da edição).
- Sem alteração de RLS, schema, autenticação ou regra de negócio. A camada de banco continua sendo a autoridade final; esta mudança corrige a UI e o feedback.

## Fora de escopo

- Não altero cargos, permissões atribuídas a usuários nem políticas do banco.
- Não mexo em ações de editar/criar, apenas exclusão.
- Não altero telas de administração de plataforma (`admin.workspaces.$id`).

## Como validar

Com o usuário `marketing@` (vendedor interno): abrir o detalhe de uma empresa de outro responsável — o botão excluir não deve aparecer; abrir uma empresa própria — o botão aparece e funciona. Repetir em Contatos, Leads, Tarefas e Contratos.
