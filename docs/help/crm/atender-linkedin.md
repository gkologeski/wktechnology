---
module_key: crm
slug: atender-linkedin
title: Atender conversas pelo LinkedIn
summary: Consulte e responda conversas da sua conta pessoal com proteção de envio.
article_type: howto
route_pattern: /inbox/linkedin
min_permission: techsales.inbox.linkedin.view.own
audience: internal
sort_order: 415
version: 1
is_published: true
---
# Atender conversas pelo LinkedIn
**Para que serve:** Atender mensagens LinkedIn pela Inbox e acompanhar o agente habilitado para a conta.
**Quem pode fazer:** Membro ativo com acesso à própria conexão LinkedIn e `techsales.inbox.linkedin.view.own`. Enviar exige também `.create.own` e gerenciamento da conexão; vincular registros ou controlar o atendimento exige `.manage.own`.
**Onde fica:** TechSales > Caixa de entrada > LinkedIn (`/inbox/linkedin`).
**Antes de começar:** Conecte seu LinkedIn em Configurações > Integrações > Meu LinkedIn. A Unipile precisa estar configurada e o webhook precisa entregar eventos autenticados.

## Passo a passo
1. Abra a aba LinkedIn e selecione uma conversa.
2. Consulte o histórico. Use o carregamento de mensagens anteriores para conversas longas.
3. Escreva a resposta e envie. O recibo confirmado aparece no histórico.
4. No painel lateral, selecione o tipo de registro e associe a pessoa, empresa ou negócio correto. Vínculos não são inferidos pelo nome.
5. Se um agente estiver habilitado em Canais, acompanhe o estado dele e use os controles de atendimento humano quando necessário.
6. Feche a conversa ao terminar. Uma nova mensagem recebida reabre o atendimento.

## Resultado esperado
Mensagens novas recebidas e envios confirmados pelo TechERP ficam no histórico da conta pessoal, com os vínculos CRM preservados.

## Regras e limites
- Contas e conversas são pessoais e restritas ao workspace ativo. Permissão de workspace não abre a conta de outro usuário.
- A primeira entrega cobre mensagens recebidas após a conexão e envios feitos pelo TechERP. Não importa automaticamente todo o histórico anterior nem mensagens enviadas diretamente pelo aplicativo LinkedIn.
- Respostas manuais são texto; materiais enviados pelo agente usam os anexos privados existentes, até 5 MB no total.
- A Unipile e o LinkedIn podem bloquear uma operação mesmo abaixo dos limites locais. Respeite a pausa exibida; não troque de conta para contornar restrições.
- Um resultado incerto não deve ser reenviado como nova mensagem. A mesma tentativa conserva seu identificador para conciliação.
- O agente usa a persona publicada e o nome de atendimento configurado no canal. Não recebe acesso adicional aos registros do CRM.
- A intervenção humana nesta conta pessoal permanece com o proprietário da conta; não compartilha credenciais com outro atendente.

## Erros comuns
- Sem permissão: peça ao administrador as permissões da conexão e da Inbox pessoal.
- Nenhuma conversa: confirme a conexão e o webhook; mensagens antigas não são importadas automaticamente.
- Envio pausado: aguarde o prazo informado e verifique os registros da conexão.
- Histórico pendente após confirmação: preserve a tentativa e solicite conciliação; não crie um novo disparo.

## Relacionados
- [Conectar o LinkedIn pessoal](/ajuda/core/conectar-o-linkedin-pessoal)
- [Administrar canais de atendimento](/ajuda/core/administrar-canais-de-atendimento)
- [Criar o fluxo de uma sequência](/ajuda/crm/criar-fluxo-de-sequencia)
<!-- screenshot: Inbox LinkedIn com conversa fictícia, compositor e vínculo CRM, sem dados reais -->
