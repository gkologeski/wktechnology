# Permissão prevalece sobre a visibilidade restrita

**Porte: M. Estimativa: 2 a 3 horas.**

## Regra nova
A visibilidade restrita do cargo continua existindo, mas passa a ser só o comportamento padrão. Quando a pessoa tem uma permissão explícita de ver com escopo "Todos" (ou "Da minha equipe") naquele recurso, essa permissão vale.

- Permissão "Todos" em Inbox/WhatsApp → vê todas as conversas do workspace.
- Permissão "Da minha equipe" → vê as dela e as das pessoas da equipe.
- Sem essas permissões → continua vendo só as suas e as ligadas aos seus Leads e Contatos (como hoje).
- Uma permissão negada continua valendo mais que qualquer liberação. A pessoa também precisa ter vínculo ativo no workspace.

## Onde vale
Em todos os recursos que hoje sofrem a restrição: Leads, Contatos, Empresas, Negócios, Atividades, Cotações e conversas de WhatsApp. Assim a regra fica igual em todo lugar.

Editar e excluir seguem a mesma lógica: com permissão "Todos", a pessoa edita e exclui conforme a permissão dela. Sem permissão, continua a regra atual: edita o que é dela e exclui só o que criou.

## Passos
1. Confirmar quais permissões a Eduarda tem hoje, lendo como ela. Se ela não tiver "Exibir › Todos" na Inbox de WhatsApp, a correção sozinha não muda o que ela vê. Nesse caso, a liberação é feita por você em Permissões.
2. Ajustar as regras do banco que aplicam a restrição, para respeitar a permissão do recurso.
3. Testes isolados de três casos: cargo restrito sem permissão (continua restrito), cargo restrito com "Todos" (vê tudo) e permissão negada (bloqueia).
4. Abrir a Inbox de WhatsApp na tela, pela sessão da Eduarda, e conferir o total. A tela é só olhada, nada é enviado nem alterado.
5. Rodar verify e build, e atualizar a documentação de segurança.

## O que não muda
Os outros cargos continuam como estão. Não altero dados, conversas nem responsáveis. Nada é publicado.

## Detalhes técnicos
- As políticas RESTRITIVAS `rep_scope_*` (leads, deals, companies, contacts, activities, quotes, whatsapp_conversations) ganham uma condição a mais: `OR workspace_id IN (my_perm_workspaces('<chave>.view.workspace'))`, e para equipe `my_perm_workspaces('<chave>.view.team')` junto com o predicado de equipe já existente. O mesmo vale para update e delete, com as chaves correspondentes.
- `my_perm_workspaces` já exige membership ativo e aplica deny.
- Ajustar também `rep_is_restricted`/`useIsLinkedOnly` para que a ficha resumida não apareça quando houver permissão de escopo amplo.
- Migration nova, sem mudar schema de tabelas.
