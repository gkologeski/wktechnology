# Botão excluir habilitado, "sucesso" falso e registro que permanece no grid

## Diagnóstico (verificado no banco e no código)

Há duas causas somadas.

**1. A regra da tela é mais permissiva que a regra do banco.**
O hook `useCanDelete` considera o usuário "responsável" quando qualquer um dos campos `owner_id`, `assigned_to`, `created_by` ou `user_id` é dele, e também aceita o escopo "da minha equipe". As regras de exclusão no banco, verificadas agora, são mais restritas:

- companies: exclusão por workspace **ou** própria, e apenas por `owner_id` (não existe escopo de equipe).
- contacts / tickets: **somente** escopo de workspace (não existe própria nem equipe).
- contracts: workspace **ou** `owner_id`.
- services: `owner_id` **ou** administrador do workspace (a permissão de exclusão não é considerada).
- activities: workspace, equipe ou própria — sempre por `owner_id`.
- leads: decidido por função própria com `owner_id`/`assigned_user_id`.

Ou seja: em um registro criado pelo marketing@ mas de responsabilidade do guilherme@ (ou com permissão só "de equipe"), a tela habilita o botão e o banco recusa.

**2. Algumas exclusões não verificam se alguma linha foi realmente removida.**
As exclusões de **serviço** e de **contrato** rodam no servidor, checam a permissão e executam o delete sem conferir a quantidade de linhas afetadas. Quando o banco recusa silenciosamente (0 linhas), a função devolve sucesso, a tela mostra "excluído", navega de volta e o registro continua no grid. É exatamente o sintoma relatado. Em serviços isso acontece mesmo com a permissão concedida, porque a regra do banco exige ser o responsável ou administrador.

## O que será feito

1. **Alinhar a regra da tela à regra do banco (por recurso).** O `useCanDelete` passa a receber quais campos definem o responsável e quais escopos existem de fato para aquele recurso, com um mapa central por recurso espelhando as políticas atuais:
   - responsável = `owner_id` (e `assigned_user_id` só em leads); `created_by`/`user_id` deixam de habilitar exclusão;
   - escopo de equipe só é considerado onde o banco realmente o suporta (atividades);
   - em contatos e tickets, o botão fica habilitado apenas com permissão de workspace.
2. **Nenhuma exclusão pode declarar sucesso sem confirmação.** As funções de servidor de serviço e contrato passam a retornar a quantidade de linhas excluídas e, quando for zero, falham com "Você não tem permissão para excluir este registro." As telas correspondentes tratam esse retorno e não navegam nem mostram sucesso.
3. **Atualização confiável do grid.** Após exclusão confirmada, invalidar as listas do recurso (serviços, contratos e correlatos) antes de navegar, para o grid não reexibir o registro por cache.
4. **Varredura das demais exclusões** (detalhes, menus de linha e ações em lote) para garantir que todas usam um caminho com verificação de linhas afetadas; as que ainda excluem direto passam a usar o guard existente.

## Detalhes técnicos

- `src/lib/access-control/use-can-delete.tsx`: novo mapa `RESOURCE_DELETE_RULES` (campos de responsável + escopos habilitados) e `ownersOf` restrito a esses campos; assinatura mantida (`useCanDelete(resource)`), com fallback conservador (apenas workspace) para recursos não mapeados.
- `src/lib/services.functions.ts` (`deleteService`) e `src/lib/contracts.functions.ts` (`deleteContract`): acrescentar `.select("id")` no delete e lançar erro quando `data.length === 0`.
- `src/routes/_authenticated/services.$id.tsx` e `contracts.$id.tsx`: tratar erro, manter na tela e invalidar as queries de lista.
- Sem alteração de RLS, schema, autenticação ou regra de negócio; o banco continua a autoridade final.

## Fora de escopo

- Não altero políticas do banco, cargos ou permissões atribuídas.
- Não mexo em criar/editar, apenas exclusão.

## Como validar

Com marketing@: abrir um serviço/contrato/empresa de responsabilidade do guilherme@ — botão aparece desabilitado com tooltip de permissão. Em um registro próprio, excluir e confirmar que sai do grid. Forçar o caso de bloqueio (registro de outro responsável) e confirmar mensagem de erro em vez de "excluído".
