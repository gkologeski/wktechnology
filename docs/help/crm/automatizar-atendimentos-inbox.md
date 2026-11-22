---
module_key: crm
slug: automatizar-atendimentos-inbox
title: Automatizar atendimentos por e-mail, chat e LinkedIn
summary: Escolha o evento e a conta da Inbox que podem iniciar um workflow e defina os destinatários autorizados.
article_type: howto
route_pattern: /settings/workflows
min_permission: system.workflows.manage.workspace
audience: internal
sort_order: 415
version: 1
is_published: true
---

# Automatizar atendimentos por e-mail, chat e LinkedIn

**Para que serve:** Criar uma regra a partir de mensagens recebidas e acontecimentos de atendimento da Inbox, escolhendo o canal e as contas de origem.

**Quem pode fazer:** Membro ativo do workspace com acesso a Workflows, à ação de criar ou alterar a regra e ao canal escolhido. Publicar exige a permissão de gerenciamento. Cada execução, ação e destinatário continua sujeito às permissões atuais.

**Onde fica:** **Central de notificações > Regras > Evento da nova regra > Atendimento** (`/notifications`). O mesmo construtor fica em **TechSales > Otimizar > Workflows** (`/settings/workflows`).

**Antes de começar:** Confira o workspace e as conexões. E-mail usa as contas Gmail conectadas; LinkedIn usa a conta pessoal autorizada pela Unipile; chat usa o atendimento do site deste workspace. WhatsApp possui seleção própria de contas e números, descrita no guia relacionado.

## Passo a passo

1. Em **Regras**, abra **Evento da nova regra** e escolha o acontecimento com o canal indicado no nome, como **Mensagem recebida · E-mail Gmail**, **Mensagem recebida · Chat do site** ou **Mensagem recebida · LinkedIn**. Clique em **Criar regra**. Essa escolha abre um rascunho desativado.
2. No construtor, abra **Gatilho de entrada** e confira **Evento de negócio**. Os eventos dos outros canais usam a origem **Atendimento multicanal (Inbox)**. A escolha não transforma a origem em uma ação de edição da conversa.
3. Em **Contas de recebimento**, marque as contas que podem iniciar a regra. Sem contas marcadas, a regra considera as origens atualmente autorizadas do canal escolhido. Marcar uma conta não dá acesso a todas as suas conversas.
4. Se uma conta salva ficar indisponível, confira o aviso. A seleção permanece para revisão. Use a ação de remover a seleção indisponível somente se desejar alterar o alcance da regra. Retirar a última conta exige confirmação, pois o filtro vazio passa a abranger as contas autorizadas do canal; essa ampliação não acontece automaticamente.
5. Configure as condições adicionais com os metadados oferecidos. O conteúdo das mensagens e anexos deve ser consultado na Inbox com o acesso normal do usuário.
6. No passo **Enviar notificação**, escolha os destinatários. **Responsável** considera o atendimento atual da conversa. Sem responsável ativo e autorizado, não há substituição automática pelo gestor ou CEO. Como LinkedIn não possui controle de atribuição, sua regra começa com **Executor do workflow**, de forma editável e ainda sujeita ao acesso à conta pessoal. Outros destinatários também precisam de acesso à origem.
7. Confira os canais do aviso. O rascunho começa sem envio externo. E-mail, Slack ou WhatsApp de notificação continuam exigindo configuração, política e autorização próprias; selecionar uma conta de recebimento não a transforma no remetente do aviso.
8. Salve e revise o rascunho. Para começar a executar, use **Salvar e publicar** e confira o estado **Ativo/Pausado**, conforme sua permissão. Salvar apenas o rascunho não inicia a automação.
9. Consulte **Execuções recentes** e **Entregas**. Abra o contexto pelo link para conferir a conversa. A tela da Inbox verifica novamente o acesso do usuário.

<!-- screenshot: evento da Inbox com canal identificado, contas de recebimento e aviso de seleção indisponível. -->

## Resultado esperado

Uma ocorrência nova, comprovada e compatível com a versão publicada pode iniciar a regra. A conta, as condições e as permissões precisam continuar válidas. Repetir a entrega da mesma mensagem não cria outra ocorrência dessa mensagem.

## Regras e limites

| Evento               | E-mail Gmail                             | Chat do site                       | LinkedIn                                  |
| -------------------- | ---------------------------------------- | ---------------------------------- | ----------------------------------------- |
| Mensagem recebida    | Sim                                      | Sim                                | Sim                                       |
| Conversa criada      | Sim                                      | Sim                                | Sim                                       |
| Responsável alterado | Sim                                      | Sim                                | Não há controle de atribuição neste canal |
| Status alterado      | Não há status de atendimento neste canal | Sim                                | Sim                                       |
| Primeira resposta    | Resposta confirmada no atendimento       | Resposta registrada no atendimento | Resposta confirmada no atendimento        |

- Carga inicial, recuperação de histórico, mensagens enviadas pelo próprio usuário e recibos de entrega ou leitura não contam como uma nova mensagem recebida. Uma reabertura automática não deve ser confundida com uma alteração manual de status.
- Uma conversa já respondida não gera outra primeira resposta. Carregar o histórico também não equivale a responder ao atendimento.
- O evento de primeira resposta exige uma resposta comprovada e vinculada ao atendimento. Um recibo de entrega, uma tentativa sem confirmação ou apenas atualizar a conversa não comprova essa resposta.
- Publicar, republicar ou reativar não recupera automaticamente acontecimentos anteriores ao ponto de entrada da versão ativa. O histórico continua consultável na Inbox.
- As regras de WhatsApp já existentes continuam específicas de WhatsApp; os novos canais não são adicionados a elas automaticamente.
- A origem do workflow é somente leitura. Ela não permite alterar a mensagem original, responder ao cliente ou administrar a conexão por meio da ocorrência. O atendimento e a configuração do agente SDR permanecem nos controles próprios.
- Corpo da mensagem, conteúdo bruto do provedor, anexos, dados privados do visitante e credenciais não são variáveis desses eventos. Não copie conteúdo privado manualmente para o aviso.
- Os avisos diretos já existentes na Inbox mantêm suas preferências e agrupamento. Quando aplicável, um aviso legado não lido do mesmo atendimento e destinatário é reaproveitado, preservando o contexto autorizado.
- Usuário inativo, negação explícita, acesso revogado, troca de workspace ou conta desconectada podem impedir uma execução ou entrega. Selecionar alguém como destinatário não concede acesso à conversa.
- Configurar a regra não altera consentimentos, horários de silêncio, modelos aprovados ou limites de envio dos canais externos.

## Erros comuns

- **Não encontro o evento:** use **Atendimento** e confira o canal no nome. Não existe atribuição LinkedIn nem status de e-mail no conjunto atual.
- **Não foi possível consultar contas:** use **Tentar novamente**. Os filtros salvos permanecem; uma consulta com erro não significa lista vazia.
- **Sem permissão para consultar contas:** confira Workflows, Inbox e workspace ativo com o administrador. Não solicite acesso administrativo à conexão apenas para abrir uma conversa já autorizada.
- **Conta salva indisponível:** regularize a conexão ou remova conscientemente a seleção indicada. Não digite identificadores de outra conta para contornar a restrição.
- **Uma mensagem antiga não disparou:** o carregamento de histórico não é um novo recebimento elegível para a regra.
- **A mensagem chegou, mas o aviso não:** confira publicação, ativação, conta de origem, condições, executor, responsável e acesso do destinatário. Consulte execução e entrega antes de tentar outro envio.
- **O envio do chat não foi confirmado:** o visitante pode repetir a tentativa apresentada pelo widget. O texto é preservado enquanto a confirmação não chega; não conclua que a mensagem foi enviada apenas porque o campo foi acionado.

## Relacionados

- [Criar e publicar workflows](/ajuda/crm/criar-publicar-workflows)
- [Automatizar mensagens recebidas no WhatsApp](/ajuda/crm/automatizar-mensagens-recebidas-whatsapp)
- [Usar a central de notificações](/ajuda/core/usar-central-de-notificacoes)
- [Administrar canais de atendimento](/ajuda/core/administrar-canais-de-atendimento)
