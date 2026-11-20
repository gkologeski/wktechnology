---
module_key: core
slug: usar-central-de-notificacoes
title: Usar a central de notificações
summary: Consulte avisos e entregas, configure regras e canais e controle suas preferências no workspace.
article_type: howto
route_pattern: /notifications
min_permission:
audience: internal
sort_order: 147
version: 4
is_published: true
---

# Usar a central de notificações

**Para que serve:** Consultar os avisos pessoais do workspace e abrir o destino disponível para resolver uma pendência. A central distingue leitura, adiamento e conclusão da obrigação.

**Quem pode fazer:** Membro ativo do workspace selecionado, somente para os próprios avisos e preferências. Consultar ou decidir no registro de origem continua exigindo suas permissões atuais.

**Onde fica:** **Central de notificações** no menu geral ou **Ver central** no sino do topo (`/notifications`). As preferências globais anteriores continuam em Configurações > Notificações (`/settings/notifications`).

**Antes de começar:** Confira o workspace selecionado no topo. Ao trocar de workspace, a lista e as preferências são carregadas novamente. Aguarde esse carregamento antes de agir.

## Passo a passo

1. Abra a central. Na visão do workspace, use os filtros de grupo de aviso, situação e busca para localizar uma notificação. A página mostra somente registros cujo contexto e acesso puderam ser confirmados.
2. Selecione um aviso para consultar os detalhes disponíveis. O sistema não inventa prioridade, prazo, regra de envio ou motivo do destinatário quando esses dados não existem na origem.
3. Use a opção de marcar como lida ou não lida. Aguarde a confirmação de gravação; em erro, a leitura não é apresentada como concluída.
4. Para marcar um conjunto, use **Marcar carregadas como lidas**. A ação considera os itens carregados e o instante da consulta, com limite de 100 IDs; não marca automaticamente avisos futuros ou páginas ainda não carregadas.
5. Para retomar mais tarde, adie o aviso por uma hora ou por 24 horas. Consulte a situação de adiados para cancelar o adiamento. Ao terminar o intervalo, o aviso volta a aparecer na lista normal sem exigir nova tarefa ou nova notificação.
6. Abra o registro pelo link, quando disponível. A tela de destino aplica suas próprias permissões. Sem destino comprovado, o aviso não apresenta um endereço inventado.
7. Em **Preferências**, ajuste os grupos ou eventos disponíveis para este workspace. **Herdar** usa a preferência global anterior; uma escolha explícita neste workspace pode ser restaurada à herança.
8. Configure o período de silêncio e seu fuso horário. Durante o intervalo, o sino não abre pop-up, toca ou anima; os avisos, o contador e os prazos continuam disponíveis.
9. Escolha a organização diária ou semanal para agrupar os itens carregados na central. Esse resumo não é um envio por e-mail ou WhatsApp.
10. Clique em salvar e aguarde a confirmação. Se houver conflito com outra sessão, recarregue e confira as opções antes de salvar novamente.

## Resultado esperado

Você acompanha seus avisos no contexto correto, distingue pendências de leitura e mantém o controle de interrupções. Marcar como lida ou adiar uma notificação não aprova uma decisão, não conclui uma tarefa e não altera o prazo do negócio.

## Regras e limites

- O histórico antigo não é movido nem atribuído automaticamente a um workspace. Avisos sem contexto comprovado ficam em uma visão separada de histórico legado, com conteúdo neutro e sem link de origem não confirmado.
- A lista do workspace exige destinatário igual à sessão atual, membership ativo e acesso atual à origem. Revogação de acesso pode retirar um aviso da lista sem apagar o registro histórico.
- A central é pessoal: gestores e administradores não recebem acesso à caixa de outra pessoa por esta tela.
- O contador é limitado para evitar consultas excessivas. A indicação **99+** não é uma contagem exata acima desse limite.
- A organização em resumo atua sobre os itens carregados. Continue a paginação para consultar avisos anteriores; o resumo não afirma cobrir todo o histórico.
- As preferências deste workspace não alteram as escolhas de outro workspace nem apagam o JSON global legado. Eventos planejados no catálogo não passam a produzir avisos ao configurar uma preferência.
- **No app** e suas exceções por evento são aplicados aos novos avisos do passo **Enviar notificação** dos Workflows. Outros produtores legados ainda possuem suas próprias regras de gravação. O sino respeita as opções efetivas antes de interromper.
- Silêncio não adia aprovação, pagamento ou tarefa. O horário inicial é incluído e o horário final é excluído; intervalos que atravessam a meia-noite são permitidos.
- A organização em resumo não realiza envio externo. Entregas opcionais por e-mail/WhatsApp dependem de regra explícita, canais habilitados, preferências e consentimento; consulte as instruções abaixo.
- Tipos desconhecidos permanecem sem interrupção. Falhas de consulta aparecem como erro e não como uma caixa vazia.

## Erros comuns

- **O workspace mudou:** recarregue a central. Uma ação iniciada no contexto anterior não deve ser reaplicada automaticamente no novo workspace.
- **Não foi possível carregar:** use a opção de tentar novamente. Não conclua que não existem avisos enquanto a consulta estiver com erro.
- **Notificação indisponível:** o acesso à origem pode ter sido revogado, o registro pode ter sido excluído ou o contexto pode não estar comprovado. Consulte o responsável pela origem.
- **Preferências alteradas em outra sessão:** recarregue, revise o estado atual e salve suas escolhas novamente.
- **Um aviso continuou no histórico:** preferências e silêncio não apagam registros. A leitura de uma mensagem tampouco conclui sua tarefa.
- **Não há resumo no e-mail:** o resumo desta tela organiza a central; ainda não realiza envios externos.

## Relacionados

- [Revisar preferências globais de notificações](/ajuda/core/revisar-preferencias-de-notificacoes)
- [Criar e publicar workflows](/ajuda/crm/criar-publicar-workflows)
- [Permissões do Core](/ajuda/core/permissoes)

## Regras, modelos e entregas

Na central, as abas **Regras**, **Modelos e canais** e **Entregas** ampliam o acompanhamento. Sua disponibilidade depende das permissões atuais; ausência de acesso não significa falha de configuração.

### Preparar os canais do workspace

1. Um administrador autorizado abre **Modelos e canais**. E-mail e WhatsApp começam desligados; definir uma preferência pessoal não os ativa.
2. Para e-mail, defina uma cota positiva e habilite o canal somente depois de revisar a política do workspace.
3. Para WhatsApp, escolha um número da conexão direta Cloud API e um modelo **UTILITY**, **APPROVED**, no idioma exato, compatível com o texto neutro apresentado. Os números do conector anterior continuam com sua configuração; esta tela não os migra.
4. Informe a cota diária, a moeda, o custo unitário estimado e o orçamento diário estimado. Consulte os valores vigentes na Meta. O controle local não é uma garantia de preço nem aumenta o limite ou a qualidade da conta.
5. Salve e aguarde a confirmação. Alterações de WhatsApp exigem também acesso à gestão desse canal. Sem esse acesso, um administrador pode ajustar e-mail preservando a configuração de WhatsApp já salva.

### Autorizar seus próprios avisos no WhatsApp

1. Abra **Preferências** e localize sua autorização de WhatsApp.
2. Confira o telefone do perfil. Se necessário, preencha o número com código do país e use **Atualizar telefone no perfil**. Essa ação altera o seu perfil; não registra consentimento automaticamente.
3. Leia a finalidade e escolha autorizar. O consentimento vale para seus avisos desse workspace, nesse telefone. O cadastro não comprova posse do número por SMS.
4. Para interromper, revogue a autorização. Trocar o telefone revoga as autorizações anteriores; autorize novamente apenas quando desejar. Não é possível autorizar outra pessoa por esta tela.

### Criar uma regra sem duplicar o motor de automações

1. Abra **Regras** e crie ou edite o Workflow autorizado. As regras exibidas são os Workflows que possuem a ação **Enviar notificação** ou **Enviar mensagem no Slack**; não há uma segunda automação paralela.
2. Configure o gatilho, os destinatários e os canais. Uma ação antiga sem seleção explícita mantém somente **No app**.
3. E-mail e WhatsApp são opcionais. **E-mail se o WhatsApp falhar** exige WhatsApp primário sem e-mail em paralelo. A alternativa só é permitida em falhas definitivas ou supressões elegíveis, com preferência e permissão próprias; um resultado incerto não gera outro envio.
4. Salve o rascunho e use **Conferir configuração sem enviar**, quando disponível. A conferência é estrutural: não envia mensagens, não comprova elegibilidade dos destinatários e não ativa o rascunho.
5. Publique somente a versão revisada da regra, com sua autorização habitual de Workflows. Criar, salvar e publicar continuam sendo ações distintas.

### Conferir o histórico

1. Abra **Entregas**. Por padrão, você consulta somente as próprias entregas. A visão do workspace exige permissão específica e continua filtrada pelo acesso à origem.
2. Filtre por canal e situação; carregue as páginas anteriores quando necessário.
3. **Na fila** ou **Nova tentativa programada** ainda não confirmam envio. **Aceita pelo provedor** não significa **Entregue** ou **Lida**. E-mail sem recibo não recebe um estado de entrega inventado.
4. **Resultado incerto** indica que não há prova suficiente para repetir com segurança. A central não oferece reenvio automático ou manual cego. Consulte o provedor e a pessoa responsável antes de agir.
5. **Suprimida** informa um bloqueio como preferência, consentimento, acesso, configuração ou limite. A central não expõe o destino completo nem a mensagem técnica bruta do provedor.

Os canais externos recebem texto neutro com acesso à central, sem salário, valor, documento pessoal ou cópia do conteúdo da origem. A leitura no TechERP mantém suas permissões atuais. O horário de silêncio adia novas entregas externas; não altera o prazo da obrigação. A organização diária/semanal continua sendo um agrupamento visual, sem envio de digest externo. Estas regras não passam a produzir todos os eventos planejados do catálogo.


## Sino e central em tempo real

- O sino mostra o contador do **workspace ativo** sem carregar todo o histórico. A lista é consultada quando você abre o sino. O resumo do sino permite até três páginas; use **Ver central** para continuar no histórico completo.
- Quando chegam vários avisos juntos, as atualizações são agrupadas. O sistema confere os IDs pela sua sessão antes de interromper; o texto bruto do realtime não é mostrado. Um grupo pode gerar uma única interrupção, respeitando suas preferências e o silêncio.
- Uma leitura ou um adiamento feito em outra sessão atualiza a consulta, sem gerar um novo som ou pop-up. O polling continua como recuperação quando o realtime não estiver disponível.
- **Preferências** no rodapé do sino abre as preferências do workspace na central. A configuração global continua acessível em Configurações > Notificações.
- Ao abrir um aviso de e-mail, chat, WhatsApp ou LinkedIn com uma conversa identificada, o link procura a conversa exata. A Inbox mantém suas próprias permissões; o aviso não concede acesso.
- Avisos sem um destino de registro podem abrir o próprio detalhe na central. Um link para um aviso fora da primeira página é consultado separadamente e só aparece quando a origem e o destinatário são autorizados.

### Consultar e agir com segurança

1. Digite sua busca e aguarde **Atualizando a busca** desaparecer. Durante a troca do termo, a central não oferece ações sobre os resultados anteriores.
2. Confira o contador. Ele mostra as não lidas do recorte atual; pode diferir do total do sino quando há filtros. **…** indica contagem ainda não confirmada e não significa zero.
3. No celular ou tablet, selecione um aviso para abrir o painel de contexto. Feche o painel para voltar à lista e ao item selecionado. No desktop, o contexto permanece ao lado da lista.
4. Marque a leitura ou adie e aguarde a confirmação. Sessões de consulta somente leitura permitem navegar, mas não alterar leitura ou adiamento.
5. Se o sistema não conseguir conferir um aviso ou perder acesso à origem, ele não mantém ações sobre o conteúdo antigo como se estivesse confirmado. Atualize a consulta; não tente repetir por outro workspace.

No histórico antigo sem workspace comprovado, a pesquisa por conteúdo fica desativada. O sistema preserva essa separação para não procurar ou revelar textos cuja origem não pôde ser confirmada. Solicitações de profissionais aparecem em TechPeople e solicitações de fornecedores em TechContracts conforme o tipo real do registro autorizado, sem deduzir o módulo pelo título.


## E-mail e Slack: entrega pessoal e aviso coletivo

- **E-mail** mantém destinatário pessoal confirmado e preferência efetiva. O modelo é neutro e abre a central autenticada. A autorização é conferida novamente depois da renderização, imediatamente antes do envio. Recusa definitiva, supressão, limite do provedor e resultado incerto possuem estados próprios no histórico; um identificador local não comprova entrega.
- **Slack** usa uma política independente em **Modelos e canais**, inicialmente desligada. Um administrador autorizado escolhe a conexão, a cota e confirma o público compartilhado. O modelo é fixo e neutro. O aviso não representa entrega individual; por isso aparece apenas em **Entregas > Workspace**, com os acessos necessários à origem e à integração.
- A ação Slack do Workflow gera uma ocorrência coletiva. Ela não é uma opção de canal pessoal da ação **Enviar notificação**. Para avisar uma pessoa no app ou por e-mail e também um canal compartilhado, configure as ações correspondentes no mesmo Workflow.
- As configurações antigas do Slack são preservadas, mas o canal fixo do webhook não pode ser substituído por evento. Ações antigas com canal preenchido precisam ser revisadas no editor antes de enviar.
- A conexão não inicia novos produtores de eventos nem resumos externos. A confirmação **Aceito pelo provedor** não equivale a entregue ou lido. Falhas ambíguas ficam sem repetição automática.

Consulte [Configurar notificações no Slack](/ajuda/core/configurar-notificacoes-no-slack) para preparar a conexão, a política e o histórico.
