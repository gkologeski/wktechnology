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
version: 9
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

1. Abra **Regras**. Em **Evento da nova regra**, escolha uma opção de TechSales, TechContracts, TechProjects, TechHire ou TechPeople, ou mantenha **Regra genérica de Workflow**, e clique em **Criar regra**. O rascunho abre no construtor existente. As regras exibidas são os Workflows que possuem a ação **Enviar notificação** ou **Enviar mensagem no Slack**; não há uma segunda automação paralela.
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

## WhatsApp oficial: conferir modelo e recibos

A prévia de WhatsApp resolve os mesmos valores do transporte e mostra os componentes compatíveis do modelo, com status e categoria consultados. A qualidade exibida é a sincronizada; o remetente e o modelo são novamente verificados antes do envio. Dados de outro usuário ou workspace não são reutilizados ao retornar à tela.

Alterar o telefone do perfil por qualquer caminho revoga as autorizações antigas. Recibos assinados corretamente correlacionados podem atualizar **Entregue/Lido** sem depender da projeção na Inbox e após desativação do remetente. Isso não cria outro envio nem ativa conversas novas.

Prazos de espera valem para a conexão, também entre avisos diferentes. Restrições de reputação ou limites sem prazo seguro podem desligar o canal; a reativação exige revisão na Meta e ação administrativa explícita. Consulte o [passo a passo de WhatsApp oficial](/ajuda/core/configurar-notificacoes-no-whatsapp).

## Avisos de TechSales, TechContracts e TechProjects

Os eventos abaixo estão disponíveis para configurar uma regra. A disponibilidade no catálogo não cria uma regra, não publica um Workflow nem habilita canais. Criar, salvar o rascunho, publicar e ativar continuam ações distintas, com as permissões de Workflows e de cada ação. As regras existentes permanecem com sua configuração.

| Evento                              | Quando pode gerar uma ocorrência                                                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Negócio ganho                       | O negócio entra em uma etapa de ganho do funil.                                                                                                                                                          |
| Negócio perdido                     | O negócio entra em uma etapa de perda do funil.                                                                                                                                                          |
| Etapa do negócio alterada           | Outras mudanças de etapa, incluindo reabertura. Uma entrada em ganho ou perda é classificada pelo evento específico, sem gerar também este evento para a mesma transição.                                |
| Proposta aceita                     | O cliente aceita uma proposta válida enviada. Aprovação interna não é aceite do cliente.                                                                                                                 |
| Minuta aceita                       | O cliente confirma o aceite real da minuta enviada e vinculada ao negócio. A dispensa administrativa de aceite não emite esse evento. O destino conserva o contexto comercial e as permissões da origem. |
| Assinatura concluída                | Existe confirmação válida de conclusão da assinatura da versão atual do contrato. Status Ativo ou data de assinatura preenchida, isoladamente, não comprovam esse evento.                                |
| Contrato próximo do vencimento      | O contrato entra na janela anterior à data de término da vigência.                                                                                                                                       |
| Prazo de aviso de renovação próximo | Um contrato com renovação automática e aviso prévio válido entra na janela anterior ao prazo de aviso de renovação.                                                                                      |
| Projeto iniciado                    | O projeto muda de Planejamento para Ativo. Criar/importar um projeto já ativo, editar a data de início ou retomar Em espera não gera esse evento.                                                        |
| Projeto atrasado                    | Um projeto em Planejamento ou Ativo ultrapassa o prazo após a publicação da regra.                                                                                                                       |
| Tarefa de projeto atrasada          | Uma tarefa aberta ultrapassa o prazo após a publicação da regra, com projeto em Planejamento, Ativo ou Em espera.                                                                                        |
| Marco próximo do prazo              | Um marco Pendente ou Em andamento, sem conclusão registrada, entra na janela de antecedência; exige projeto em Planejamento, Ativo ou Em espera.                                                         |

### Configurar um aviso de prazo

1. Escolha o evento de contrato e crie o rascunho. No construtor, abra **Gatilho de entrada** e confira **Evento de negócio**.
2. Em **Antecedência em dias**, informe de 1 a 365. O rascunho começa com 30 dias; revise esse valor antes de salvar.
3. Para vencimento, o prazo é o **Fim da vigência**. Para renovação, o prazo de aviso é **Fim da vigência menos Aviso prévio (dias)**; exige **Renovação automática** e aviso prévio válido no contrato.
4. A janela começa na antecedência escolhida e termina no próprio prazo, incluindo os limites. Prazos já vencidos ou dados ausentes/inválidos não geram o aviso. Alterar a preferência não corrige os dados do contrato.
5. Confira condições, destinatários e canais. Salve, revise a conferência sem envio e publique/ative somente quando desejar. O aviso não renova, encerra, assina ou altera o contrato.

Em **Preferências > Exceção por evento**, os doze eventos podem ter escolhas próprias de No app, e-mail, som e tremor. No app e e-mail herdam o grupo, salvo escolha explícita. **Som e tremor dos eventos comerciais, contratuais e de projetos começam desligados**, mesmo quando um padrão global antigo do grupo possui som; para habilitá-los, faça uma escolha explícita no grupo ou evento deste workspace. Os grupos e eventos legados preservam seu comportamento.

**WhatsApp oficial** possui uma preferência opcional por grupo ou evento. **Bloquear pela preferência** interrompe esse canal mesmo com autorização pessoal vigente. **Herdar autorização pessoal** restaura a herança; **Permitir pela preferência** não concede consentimento nem supera política, regra, acesso ou limites. Essa escolha pertence ao workspace e não altera os canais globais antigos do perfil. Consulte [Configurar avisos oficiais por WhatsApp](/ajuda/core/configurar-notificacoes-no-whatsapp) para cancelar um evento ou revogar toda a autorização pessoal.

Se não houver aviso, confira se a regra está publicada e ativa, se houve uma ocorrência elegível, se o prazo está na janela e se o destinatário permanece ativo e com acesso à origem. Consulte o resultado do Workflow e o histórico de entregas. O sistema não dispara todo o histórico ao cadastrar uma preferência, não escolhe um destinatário alternativo e não recria tarefas ou decisões de aprovações existentes.

### Configurar avisos de TechProjects

1. Em **Regras**, escolha uma das quatro opções de **TechProjects**. A seleção abre somente um rascunho desativado; confira objeto, condições, destinatários e canais. **Membros do projeto** é uma opção de destinatário, sem conceder acesso à origem.
2. **Projeto iniciado** acompanha somente a passagem de Planejamento para Ativo. A data prevista de início e os checkpoints de entrega têm outros significados.
3. **Projeto atrasado** e **Tarefa de projeto atrasada** não têm antecedência nem atraso adicional configurável. O atraso começa no dia civil seguinte ao prazo no fuso **America/Sao_Paulo**. Não são lembretes diários: cada origem/prazo produz uma ocorrência por regra. Atrasos anteriores à publicação ficam de fora; uma verificação posterior recupera os que venceram após a publicação. Republicar ou voltar a um prazo já processado não cria outra ocorrência desse prazo.
4. Somente **Marco próximo do prazo** oferece **Antecedência em dias**, de 1 a 365, com valor inicial 30 editável. A janela termina no prazo; marcos vencidos, concluídos ou cancelados ficam de fora. O aviso não conclui o marco, não gera cobrança nem altera o projeto.
5. Projetos concluídos ou cancelados não geram os avisos de atraso ou proximidade; tarefas e marcos de projetos Em espera podem continuar elegíveis. Prazos ausentes não são inventados e a preferência pessoal não muda status nem datas.
6. Ao abrir o aviso, projetos levam à ficha; tarefas abrem a ficha lateral pelo ID, mesmo fora da página filtrada. Marcos abrem a aba **Marcos** do projeto e destacam **Marco do aviso** quando o registro estiver autorizado. Sem acesso atual, o destino não revela o conteúdo antigo.

Os quatro eventos usam as mesmas preferências por grupo/evento, com som e tremor inicialmente desligados. Bloquear WhatsApp nesse evento não revoga a autorização dos demais; permitir não supera consentimento, política, regra, acesso ou limites. As regras de TechProjects não substituem nem reavaliam automaticamente os alertas do Dashboard.

O custo planejado continua restrito às telas financeiras autorizadas. Avisos de TechProjects e seus históricos não carregam esse campo.

## Avisos de TechHire e TechPeople

Em **Regras**, TechHire oferece **Inscrição em vaga recebida**, **Entrevista marcada** e **Oferta aceita**. TechPeople oferece **Início de vínculo autorizado**, **Documento próximo do vencimento** e **Aprovação de solicitação profissional pendente**. A seleção prepara um rascunho desativado no Workflow existente; não publica, contrata, agenda, aprova ou envia mensagens.

- Inscrição exige uma candidatura realmente registrada. Editar ou reabrir a mesma candidatura não cria outra inscrição. Seu destino abre a vaga na aba de candidaturas e localiza o registro exato, mesmo fora da lista carregada.
- Entrevista exige agendamento confirmado com data e hora futuras. Convite pendente e alteração de notas não comprovam esse evento. O destino seleciona **Entrevistas** e confere o registro exato, sem agendar ou reagendar.
- Oferta aceita exige assinatura canônica válida da versão enviada. Aprovação interna ou a etapa Contratado não equivalem ao aceite. O destino localiza a oferta em **Ofertas**, respeitando inclusive a permissão separada das condições.
- Início de vínculo autorizado representa admissão confirmada ou início direto autorizado pelo fluxo governado. Pode conter data futura; não comprova dia trabalhado, pagamento nem concessão de acesso. O destino abre a ficha autorizada da pessoa.
- Documento próximo do vencimento usa validade no calendário de São Paulo e **Antecedência em dias** entre 1 e 365, inicialmente 30 no rascunho. A janela inclui o prazo e não inclui documento vencido, sem validade ou de pessoa arquivada. O destino abre **Documentos** e destaca o item autorizado; não abre nem baixa o arquivo automaticamente.
- Aprovação pendente cobre somente solicitações **profissionais** da preparação, na etapa atual liberada ao aprovador nomeado. Não engloba vagas, fornecedores ou todas as alçadas de RH. O aviso de processo no aplicativo já existe independentemente desta regra e é reaproveitado sem duplicação. Desativar a regra ou a preferência deste evento não remove esse aviso obrigatório. Canais adicionais explícitos continuam restritos ao mesmo aprovador vigente, sem destinatários arbitrários.

Os seis eventos mantêm as preferências por grupo/evento: som e tremor inicialmente desligados; e-mail depende da escolha e da política. **WhatsApp > Herdar** preserva o consentimento geral; **Bloquear** bloqueia esse evento nesse canal, e **Permitir** não concede consentimento, acesso ou elegibilidade. Conteúdo e históricos não reproduzem salário, condições privadas, número de documento, currículo, arquivo ou token público.

Ao abrir qualquer destino, aguarde a conferência do usuário, workspace e acesso atuais. A indicação neutra de carregamento substitui o conteúdo antigo durante a conferência; falha ou acesso revogado retira o conteúdo. Trocar usuário ou workspace descarta a seleção e seus rascunhos. O link não executa decisões nem substitui as permissões de cada aba.

## Avisos de TechFinance

Em **Regras**, TechFinance oferece **Conta a pagar do dia**, **Conta a receber do dia**, **Conta a pagar vencida**, **Conta a receber vencida** e **NF de contratação recebida**. Escolher prepara somente um rascunho desativado no Workflow existente; não publica, envia, paga, recebe, emite, cancela nem concilia.

- **Do dia:** vencimento igual ao dia civil atual em São Paulo, com saldo real em aberto. A situação Parcial também depende do saldo. Não há campo de antecedência. Publicar durante a tarde ainda pode avisar uma vez sobre o vencimento daquele dia.
- **Vencida:** dia seguinte ao vencimento no mesmo calendário e saldo real em aberto. Não há antecedência, campo de dias após o prazo ou lembrete diário. Só cruzamentos posteriores à publicação entram; o processamento pode recuperar esses cruzamentos, sem varrer atrasos anteriores.
- **NF de contratação recebida:** somente NF-e ou NFS-e efetivamente registrada no fluxo privado de contratação profissional/fornecedor. O registro não equivale à conferência do Financeiro, emissão fiscal, aceite de entrega ou pagamento. Não inclui fatura de cliente, RPA, recibo ou evidência de folha. Conferir uma nota já registrada não cria outro recebimento; rejeitar bloqueia uma ocorrência ainda pendente.

Os quatro avisos de títulos abrem a ficha do lançamento exato, independentemente de filtro ou página da lista. A NF abre a solicitação profissional ou de fornecedor em **Revisão**, localizando e destacando o documento fiscal autorizado. Não baixa arquivo ou registra conferência pela URL. A permissão de lançamentos não substitui as permissões da solicitação e de seus documentos fiscais.

Os novos rascunhos de títulos usam o responsável atual do registro. A NF começa com **Executor do workflow**, editável e sujeito ao acesso fiscal. **Responsável Financeiro da formalização** resolve somente a pessoa canônica vigente; não inventa CEO ou substituto. **Quem enviou a nota** recebe apenas por escolha explícita e não se torna aprovador por tê-la enviado.

Avisos, variáveis e condições desses cinco eventos usam somente identificadores, estados e datas permitidos. Não oferecem valores, saldo, notas privadas, CNPJ, dados bancários, arquivos ou associações financeiras. Mutações genéricas do título/documento não são oferecidas; operações financeiras continuam em seus controles canônicos. Um rascunho antigo incompatível fica preservado para revisão, sem gravação silenciosa.

Som e tremor começam desligados. E-mail e WhatsApp mantêm suas próprias políticas; a preferência de WhatsApp herda o consentimento geral quando não há override, bloquear afeta o evento e permitir não concede autorização. Durante revalidação, campos em edição na mesma identidade ficam preservados, ocultos e bloqueados. Falha, perda de acesso ou troca de usuário/workspace retira o conteúdo antigo.
