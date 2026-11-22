---
module_key: crm
slug: automatizar-mensagens-recebidas-whatsapp
title: Automatizar mensagens recebidas no WhatsApp
summary: Crie uma regra de mensagem recebida na Inbox e filtre as contas e números comerciais de origem.
article_type: howto
route_pattern: /settings/workflows
min_permission: system.workflows.manage.workspace
audience: internal
sort_order: 414
version: 2
is_published: true
---

# Automatizar mensagens recebidas no WhatsApp

**Para que serve:** Configurar uma automação a partir de uma nova mensagem recebida na Inbox por uma conexão WhatsApp Cloud API ou Lovable, escolhendo as contas e os números comerciais que podem dispará-la.

**Quem pode fazer:** Membro ativo do workspace, autorizado a consultar Workflows e a Inbox WhatsApp, com permissão para criar ou alterar o workflow. Publicar exige sua alçada de gerenciamento. Cada ação e cada destinatário continuam sujeitos às permissões atuais; ver um número na lista não concede acesso a todas as conversas desse número.

**Onde fica:** **Central de notificações > Regras > Evento da nova regra > Atendimento > Mensagem de WhatsApp recebida**. Também é possível abrir **TechSales > Otimizar > Workflows** (`/settings/workflows`) e escolher **Atendimento > Mensagens de WhatsApp (Inbox)** como tipo de objeto.

**Antes de começar:** Confira o workspace no topo e a conexão ativa. O recebimento precisa estar configurado e verificado na Cloud API ou no conector Lovable. Defina quais números comerciais podem iniciar a regra e quem deve receber o aviso. Não é necessário copiar token, segredo ou identificador técnico para esses campos.

No conector Lovable, o número atualmente conectado precisa corresponder a um único canal de atendimento do workspace. Ao abrir os filtros, o TechERP confirma a conexão e esse vínculo antes de oferecer a conta. A configuração do agente SDR não substitui a confirmação do canal.

## Passo a passo

1. Em **Central de notificações > Regras**, escolha **Mensagem de WhatsApp recebida** em **Evento da nova regra** e clique em **Criar regra**. O sistema prepara um rascunho desativado; essa seleção não salva, publica ou envia mensagens.
2. No construtor, abra **Gatilho de entrada**. Confira **Tipo de objeto: Mensagens de WhatsApp (Inbox)** e **Evento de negócio: Mensagem de WhatsApp recebida**. O objeto identifica a origem; o evento define o acontecimento. A origem é somente leitura e exige esse evento compatível.
3. Em **Contas de recebimento**, marque uma ou mais contas, se desejar restringir a regra. A lista considera as conexões disponíveis para seu acesso no workspace. Pode incluir conexões diretas Cloud API e a conexão Lovable.
4. Em **Números comerciais de recebimento**, marque os números que podem disparar o workflow. São os números da sua operação que recebem a mensagem, não o telefone do cliente. A lista acompanha as contas marcadas.
5. Confira a combinação dos filtros:
   - Sem contas nem números marcados: qualquer origem atualmente autorizada pode corresponder.
   - Somente contas marcadas: qualquer número autorizado dessas contas pode corresponder.
   - Somente números marcados: a mensagem precisa chegar a um desses números autorizados.
   - Contas e números marcados: as duas condições precisam corresponder à mesma origem. Um número de outra conta não satisfaz a seleção.
6. Se uma seleção salva estiver indisponível ou fora das contas marcadas, revise-a antes de salvar. O sistema preserva o filtro para conferência; não amplia automaticamente a regra para todas as contas. Corrija o vínculo ou desmarque conscientemente o item que deseja remover.
7. Abra **Enviar notificação** e confira **Quem recebe o aviso**. Escolha o responsável pelo registro ou outro destinatário explicitamente permitido. Todos precisam estar ativos no workspace e ter leitura atual da mensagem e da conversa. Sem responsável elegível, o sistema não escolhe outra pessoa nem o CEO.
8. Configure os canais de aviso que deseja usar. Sem escolha externa, o passo mantém o aviso no aplicativo. E-mail e WhatsApp de notificação continuam dependendo da política, preferências, autorização pessoal e limites. O número de recebimento do gatilho não define o remetente de uma notificação externa.
9. Salve o rascunho e revise a configuração. Quando desejar iniciar, confira o estado **Ativo/Pausado** e use **Salvar e publicar** conforme sua permissão. A regra precisa estar publicada e ativa; salvar apenas um rascunho não a inicia.
10. Acompanhe **Execuções recentes** e, para as comunicações da central, **Entregas**. Um recebimento elegível é diferente da confirmação de que cada destinatário recebeu ou leu o aviso.

<!-- screenshot: construtor com Mensagens de WhatsApp (Inbox), Mensagem de WhatsApp recebida e filtros Contas de recebimento/Números comerciais de recebimento. -->

## Resultado esperado

Uma nova mensagem recebida e comprovada pode iniciar a versão publicada e ativa da regra, desde que sua conta, número, condições e permissões atuais correspondam. Reentregar o mesmo evento do provedor não cria uma segunda ocorrência da mesma mensagem. As conversas continuam disponíveis na Inbox; configurar a regra não envia uma resposta ao cliente.

## Regras e limites

- Este evento trata **somente de WhatsApp recebido** por Cloud API ou Lovable. E-mail, chat do site e LinkedIn têm suas próprias origens e não entram por essa seleção.
- Mensagens enviadas, recibos de entrega/leitura, status de envio, espelhos de ligações e histórico importado não são mensagens recebidas novas deste gatilho. Publicar ou ativar a regra não reprocessa automaticamente conversas antigas. Republicar ou reativar define um novo ponto de entrada para a versão ativa; recepções antigas não são recuperadas como novas por esse procedimento.
- Cada nova mensagem é uma ocorrência própria. O aviso direto ao responsável da Inbox continua com suas regras de preferência e agrupamento por conversa não lida. Quando a regra avisa essa mesma pessoa e já existe o aviso legado não lido da conversa, ele é reaproveitado em vez de criar uma segunda cópia implícita. Outros destinatários e canais explicitamente configurados seguem as próprias autorizações; reutilizar o aviso não apaga a ocorrência.
- A seleção não cria uma regra ativa, não habilita um canal externo e não altera consentimentos, limites ou configurações das conexões.
- **Mensagens de WhatsApp (Inbox)** é uma origem somente leitura no Workflow. O evento não oferece ações para alterar a mensagem, responder ao cliente, trocar o responsável da conversa ou ligar/desligar o agente SDR. Essas operações continuam nos controles próprios de atendimento.
- Condições e variáveis usam somente os metadados oferecidos, como origem, número comercial, direção, tipo de mensagem, data e identificadores. Corpo da mensagem, conteúdo bruto, anexos, telefone do cliente e credenciais não são tokens desse evento. Não escreva conteúdo privado manualmente no título ou no corpo do aviso.
- A comunicação externa permanece neutra e leva ao contexto autorizado do TechERP. O destinatário não ganha acesso à conversa por ter sido selecionado na regra ou por abrir a notificação.
- O sistema confere novamente usuário executor, workspace, conta, número, origem e destinatários durante a execução. Negação explícita, membro inativo, acesso revogado ou origem indisponível podem bloquear a ocorrência ou a entrega.
- Recibos **Entregue/Lido** não são respostas e não comprovam uma decisão. Resultado incerto de envio não autoriza repetição automática com outra chave ou por outro canal.

## Erros comuns

- **O evento não aparece:** escolha o grupo **Atendimento** e o objeto **Mensagens de WhatsApp (Inbox)**. O seletor inicial escolhe o objeto, não apresenta todos os eventos do ERP.
- **Sem permissão para consultar as contas WhatsApp:** confira suas permissões de Workflows e Inbox WhatsApp no workspace ativo. Acesso ao editor não substitui acesso ao canal.
- **Não foi possível consultar as contas WhatsApp:** use **Tentar consultar contas novamente**. Os filtros salvos são preservados; falha de consulta não significa catálogo vazio.
- **Não foi possível confirmar a conexão Lovable:** confira a conexão em **Canais de atendimento** com quem administra o canal. As conexões Cloud API confirmadas continuam disponíveis; a conta Lovable sem confirmação não é oferecida. Após regularizar, clique em **Tentar confirmar conexão Lovable**. As seleções salvas permanecem para revisão e não são ampliadas automaticamente.
- **Não foi possível confirmar um vínculo único da conexão Lovable com um canal de atendimento:** peça ao administrador para revisar a associação do número atualmente conectado ao canal e ao workspace correto, incluindo possíveis cadastros duplicados. Depois use **Tentar confirmar conexão Lovable**. A lista só oferece a conta após a confirmação; uma seleção antiga continua visível para revisão, sem ser substituída por outra origem.
- **Conta salva indisponível ou número fora das contas marcadas:** confirme a conexão e a combinação escolhida. O salvamento recusa seleções sem origem autorizada correspondente; não digite um identificador de outra conta para contornar a restrição.
- **A regra não disparou para uma conversa antiga:** o gatilho não importa histórico nem repete automaticamente mensagens recebidas antes da ativação aplicável.
- **A mensagem chegou, mas o aviso não:** confira se a regra está publicada e ativa, se a conta e o número correspondem, se houve uma nova ocorrência elegível e se o executor e o destinatário continuam autorizados. Consulte execução e entrega antes de reenviar.
- **Não há destinatário elegível:** confira o responsável atual da conversa ou selecione um destino explicitamente permitido. Não existe substituto automático.
- **O corpo da mensagem não aparece nas variáveis:** é uma proteção intencional. Abra a conversa com seu acesso atual para consultar o conteúdo.

## Relacionados

- [Criar e publicar workflows](/ajuda/crm/criar-publicar-workflows)
- [Usar a central de notificações](/ajuda/core/usar-central-de-notificacoes)
- [Administrar canais de atendimento](/ajuda/core/administrar-canais-de-atendimento)
- [Configurar avisos oficiais por WhatsApp](/ajuda/core/configurar-notificacoes-no-whatsapp)

Para configurar recebimentos dos outros canais sem alterar esta regra, consulte [Automatizar atendimentos por e-mail, chat e LinkedIn](/ajuda/crm/automatizar-atendimentos-inbox).
