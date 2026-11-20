---
module_key: core
slug: usar-central-de-notificacoes
title: Usar a central de notificações
summary: Consulte seus avisos no workspace, marque a leitura, adie interrupções e organize a central.
article_type: howto
route_pattern: /notifications
min_permission:
audience: internal
sort_order: 147
version: 1
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
- Este pacote não oferece entrega de resumo externo, novo opt-in de WhatsApp, reenvio ou troca automática de canal. O WhatsApp continua sujeito às condições da integração existente.
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
