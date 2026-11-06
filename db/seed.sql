INSERT INTO public.help_articles
  (module_key, slug, title, summary, body_md, article_type, route_pattern, min_permission, audience, sort_order, version, is_published)
VALUES
($hlp$crm$hlp$, $hlp$abrir-o-editor-de-formularios-pelas-configuracoes$hlp$, $hlp$Abrir o editor de formulários pelas configurações$hlp$, $hlp$Abrir o editor de formulários pelas configurações.$hlp$, $hlp$# Abrir o editor de formulários pelas configurações

**Para que serve:** Abrir o editor de formulários pelas configurações, no contexto da tela `/settings/forms`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.marketing.forms`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/forms`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/forms.
2. Use a listagem e o editor de formulários apresentados.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A rota renderiza FormsPage, como /forms; pertence ao marketing do TechSales. Não é configuração global de todos os módulos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/forms com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/forms$hlp$, NULL, $hlp$internal$hlp$, 126, 1, true),
($hlp$crm$hlp$, $hlp$abrir-pesquisas-pelas-configuracoes$hlp$, $hlp$Abrir pesquisas pelas configurações$hlp$, $hlp$Abrir pesquisas pelas configurações.$hlp$, $hlp$# Abrir pesquisas pelas configurações

**Para que serve:** Abrir pesquisas pelas configurações, no contexto da tela `/settings/surveys`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.surveys`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/surveys`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/surveys.
2. Consulte a listagem e o editor de pesquisas apresentado.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Renderiza SurveysPage; pertence às pesquisas do TechSales, como /surveys.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/surveys com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/surveys$hlp$, NULL, $hlp$internal$hlp$, 170, 1, true),
($hlp$crm$hlp$, $hlp$acompanhar-negocios$hlp$, $hlp$Acompanhar negócios$hlp$, $hlp$Consultar negócios nas diferentes visualizações e iniciar uma fila com os resultados.$hlp$, $hlp$# Acompanhar negócios
**Para que serve:** Consultar o funil comercial e percorrer os negócios encontrados.
**Quem pode fazer:** Membros ativos com TechSales licenciado. Criar negócios exige a permissão correspondente de `techsales.deals`, como `techsales.deals.create.own`.
**Onde fica:** Menu > TechSales > Negócios (`/deals`).
**Antes de começar:** Tenha acesso ao funil e aos negócios que deseja consultar.

## Passo a passo
1. Abra "Negócios".
2. Alterne entre as visualizações disponíveis para consultar a tabela, o quadro, a lista ou a previsão.
3. Ajuste os filtros antes de trabalhar com os resultados.
4. Para percorrer os resultados, clique em "Iniciar fila".
5. Para cadastrar um registro, clique em "Criar negócio" e preencha o formulário. O botão só aparece para quem pode criar negócios.
<!-- screenshot: cabeçalho de Negócios com visualizações, filtros, Criar negócio e Iniciar fila -->

## Resultado esperado
Os negócios aparecem na visualização escolhida. A fila usa os negócios do filtro atual.

## Regras e limites
- O acesso aos registros depende das permissões e do escopo do usuário.
- A fila não inclui automaticamente todos os negócios do ambiente: ela parte dos resultados atuais.
- A criação só deve ficar disponível para quem tem permissão de criar.

## Erros comuns
- "Nenhum negócio para percorrer.": revise os filtros e confirme que existem resultados.
- Se um negócio não aparecer, confira o funil, os filtros e seu acesso ao registro.

## Relacionados
- [Atualizar um negócio](/ajuda/crm/atualizar-negocio)
- [Permissões](/ajuda/crm/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/deals$hlp$, NULL, $hlp$internal$hlp$, 200, 2, true),
($hlp$crm$hlp$, $hlp$acompanhar-ticket$hlp$, $hlp$Acompanhar um ticket$hlp$, $hlp$Consultar propriedades, mudar a etapa e aplicar macros.$hlp$, $hlp$# Acompanhar um ticket
**Para que serve:** Consultar uma solicitação e acompanhar seu andamento.
**Quem pode fazer:** Membros ativos com acesso ao ticket. Alterar e excluir seguem `techsales.tickets`.
**Onde fica:** Menu > TechSales > Tickets > ticket (`/tickets/$id`).
**Antes de começar:** Localize o ticket na lista.

## Passo a passo
1. Abra o ticket.
2. Confira assunto, criação e vencimento no cabeçalho.
3. Consulte propriedades e histórico.
4. Selecione a etapa no indicador de andamento.
5. Clique em "Aplicar macro" e escolha uma macro na lista "Macros".
6. Para excluir, use "Excluir ticket" e confirme.
<!-- screenshot: cabeçalho, etapas e propriedades do ticket -->

## Resultado esperado
O detalhe mostra o estado atual. Exclusão mostra "Excluído".

## Regras e limites
- O indicador de etapas só aparece se o pipeline tiver etapas.
- "Excluir ticket" fica desabilitado sem permissão.

## Erros comuns
- Falha de atualização mostra a mensagem do servidor.
- "Excluir ticket" desabilitado: peça revisão do seu acesso.

## Relacionados
- [Consultar e organizar tickets](/ajuda/crm/consultar-organizar-tickets)
- [Gerenciar macros](/ajuda/crm/gerenciar-macros)$hlp$, $hlp$howto$hlp$, $hlp$/tickets/$id$hlp$, NULL, $hlp$internal$hlp$, 511, 2, true),
($hlp$crm$hlp$, $hlp$agendar-uma-reuniao-por-link$hlp$, $hlp$Agendar uma reunião por link$hlp$, $hlp$Agendar uma reunião por link.$hlp$, $hlp$# Agendar uma reunião por link

**Para que serve:** Agendar uma reunião por link, no contexto da tela `/book/$slug`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/book/$slug`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o link de agendamento.
2. Escolha um horário disponível.
3. Preencha Nome completo e E-mail, e os demais campos solicitados.
4. Confira a confirmação.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Disponibilidade depende do calendário configurado.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /book/$slug com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/book/$slug$hlp$, NULL, $hlp$internal$hlp$, 192, 1, true),
($hlp$crm$hlp$, $hlp$atender-chat-ao-vivo$hlp$, $hlp$Atender o chat ao vivo$hlp$, $hlp$Responder visitantes e encerrar ou converter atendimentos em tickets.$hlp$, $hlp$# Atender o chat ao vivo
**Para que serve:** Responder às sessões do chat e encaminhar o que precisa virar ticket.
**Quem pode fazer:** Membros ativos com TechSales licenciado e acesso às sessões.
**Onde fica:** Menu > TechSales > Inbox unificada > Chat ao vivo (`/inbox/chat`).
**Antes de começar:** Precisa existir uma sessão de chat.

## Passo a passo
1. Escolha "Minhas", "Sem dono" ou "Todas".
2. Use "Buscar visitante ou contato…".
3. Selecione o atendimento.
4. Em "Atribuir a…", escolha o responsável ou "Sem responsável".
5. Preencha "Responder…" e clique em "Enviar".
6. Para continuar como ticket, clique em "Ticket".
7. Para finalizar, clique em "Encerrar".
<!-- screenshot: Chat com abas, responsável e ações Ticket e Encerrar -->

## Resultado esperado
"Ticket criado" ou "Encerrada.".

## Regras e limites
- "Minhas" só filtra; não muda o acesso.
- Só membros ativos do workspace podem ser responsáveis.
- Com agente ativo, o painel alterna atendimento humano e automático.

## Erros comuns
- "Selecione um membro ativo deste workspace.": escolha outro responsável.
- "Não foi possível consultar o estado do agente.": clique em "Tentar novamente".

## Relacionados
- [Controlar o agente no atendimento](/ajuda/crm/controlar-agente-atendimento)
- [Atender pela Inbox unificada](/ajuda/crm/atender-inbox-unificada)$hlp$, $hlp$howto$hlp$, $hlp$/inbox/chat$hlp$, NULL, $hlp$internal$hlp$, 301, 1, true),
($hlp$crm$hlp$, $hlp$atender-conversas-whatsapp$hlp$, $hlp$Atender conversas de WhatsApp$hlp$, $hlp$Atribuir responsáveis e enviar mensagens respeitando a janela de atendimento.$hlp$, $hlp$# Atender conversas de WhatsApp
**Para que serve:** Responder clientes pelo WhatsApp e organizar os responsáveis.
**Quem pode fazer:** Membros ativos com TechSales licenciado. Ver, enviar e atribuir usam `view`, `create` e `assign` de `techsales.inbox.whatsapp`.
**Onde fica:** Menu > TechSales > Inbox unificada > WhatsApp (`/inbox/whatsapp`).
**Antes de começar:** Tenha um canal conectado e telefone válido.

## Passo a passo
1. Busque em "Buscar telefone, mensagem ou contato…".
2. Abra a conversa.
3. Em "Atribuir a…", escolha o responsável.
4. Com a janela aberta, escreva e use "Enviar mensagem".
5. Para enviar arquivo, use "Anexar mídia".
6. Para iniciar outro atendimento, clique em "Nova conversa".
7. Com a janela fechada, envie um modelo aprovado.
<!-- screenshot: Inbox WhatsApp com aviso de janela e compositor -->

## Resultado esperado
A mensagem fica registrada na conversa.

## Regras e limites
- Janela aberta: menos de 24 horas desde a última mensagem recebida do cliente. Mensagem enviada pela empresa não reabre a janela.
- Fora da janela: só modelo aprovado pela Meta.
- Texto até 4.096 caracteres; mídia até 16 MB.
- Responsável precisa ser membro ativo.
- Com agente SDR: "Agente atendendo · Assumir" ou "Humano atendendo · Devolver ao agente".
- Balões vermelhos indicam mensagens não entregues, com o motivo.

## Erros comuns
- "A janela de 24 horas terminou. Escolha um modelo aprovado pela Meta para continuar.": use um modelo.
- "Informe um texto, anexo ou template aprovado": preencha a mensagem.
- "Arquivo maior que 16MB (limite do WhatsApp)": reduza o arquivo.
- "Você não tem permissão para supervisionar o agente SDR.": peça a autorização.

## Relacionados
- [Enviar um modelo aprovado no WhatsApp](/ajuda/crm/enviar-modelo-aprovado-whatsapp)
- [Criar uma campanha de WhatsApp](/ajuda/crm/criar-campanha-whatsapp)$hlp$, $hlp$howto$hlp$, $hlp$/inbox/whatsapp$hlp$, NULL, $hlp$internal$hlp$, 304, 1, true),
($hlp$crm$hlp$, $hlp$atender-inbox-unificada$hlp$, $hlp$Atender pela Inbox unificada$hlp$, $hlp$Localizar conversas de e-mail, WhatsApp e chat e responder pela Inbox.$hlp$, $hlp$# Atender pela Inbox unificada
**Para que serve:** Reunir conversas de e-mail, WhatsApp e chat e responder sem sair da lista.
**Quem pode fazer:** Membros ativos com TechSales licenciado. Enviar WhatsApp exige criação em `techsales.inbox.whatsapp`.
**Onde fica:** Menu > TechSales > Relacionar > Inbox unificada (`/inbox`).
**Antes de começar:** Tenha os canais conectados.

## Passo a passo
1. Escolha o canal "WhatsApp", "Email" ou "Chat".
2. Selecione uma conversa.
3. Confira o destinatário e o resumo.
4. Escreva a resposta no compositor.
5. Para o histórico completo, clique em "Abrir no canal".
<!-- screenshot: Inbox unificada com filtro de canal e Abrir no canal -->

## Resultado esperado
A resposta sai pelo canal da conversa.

## Regras e limites
- A lista mostra um resumo; o histórico completo fica no canal.
- Use "Carregar mais" para mais resultados.
- WhatsApp: texto livre só até 24 horas após a última mensagem recebida do cliente; depois, só modelo aprovado pela Meta.
- Ver a lista não dá permissão para enviar.

## Erros comuns
- "Selecione um item.": escolha uma conversa.
- "Não foi possível identificar o destinatário do e-mail.": abra o canal e confira.
- "Não foi possível identificar o número do cliente.": confira o telefone.
- "Sem permissão para enviar WhatsApp.": peça a permissão.
- "Não foi possível atualizar todas as conversas.": clique em "Tentar de novo".

## Relacionados
- [Atender conversas de WhatsApp](/ajuda/crm/atender-conversas-whatsapp)
- [Responder e-mails na Inbox](/ajuda/crm/responder-emails-inbox)
- [Atender o chat ao vivo](/ajuda/crm/atender-chat-ao-vivo)$hlp$, $hlp$howto$hlp$, $hlp$/inbox$hlp$, NULL, $hlp$internal$hlp$, 300, 1, true),
($hlp$crm$hlp$, $hlp$atribuir-responsavel-a-contatos-em-massa$hlp$, $hlp$Atribuir responsável a contatos em massa$hlp$, $hlp$Atribuir responsável a contatos em massa.$hlp$, $hlp$# Atribuir responsável a contatos em massa
**Para que serve:** Atribuir responsável a contatos em massa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A edição exige `techsales.contacts.update.own` ou `techsales.contacts.update.workspace`, dentro do escopo autorizado. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Contatos (`/contacts`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Selecione os registros na listagem.
2. Clique em "Editar em massa".
3. Em "Propriedade a atualizar", escolha "Responsável" e selecione o usuário.
4. Se necessário, clique em "Adicionar outra propriedade".
5. Clique em "Atualizar" e depois em "Confirmar alteração".
<!-- screenshot: Atribuir responsável a contatos em massa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem informa quantos registros foram atualizados.
## Regras e limites
No máximo 5.000 IDs por solicitação. Valor em branco limpa o campo, exceto quando obrigatório. Propriedades repetidas não são aceitas. Pipeline, etapa e substatus podem exigir seleção em cascata. O nome exibido para o campo de responsável depende do catálogo da entidade.
## Erros comuns
"Nenhum registro foi alterado. Verifique suas permissões.": revise o escopo. "A mesma propriedade foi escolhida duas vezes.": remova a repetida. "Não foi possível carregar as propriedades.": clique em "Tentar novamente".
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/contacts$hlp$, NULL, $hlp$internal$hlp$, 116, 2, true),
($hlp$crm$hlp$, $hlp$atribuir-responsavel-a-empresas-em-massa$hlp$, $hlp$Atribuir responsável a empresas em massa$hlp$, $hlp$Atribuir responsável a empresas em massa.$hlp$, $hlp$# Atribuir responsável a empresas em massa
**Para que serve:** Atribuir responsável a empresas em massa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A edição exige `techsales.companies.update.own` ou `techsales.companies.update.workspace`, dentro do escopo autorizado. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Selecione os registros na listagem.
2. Clique em "Editar em massa".
3. Em "Propriedade a atualizar", escolha "Responsável" e selecione o usuário.
4. Se necessário, clique em "Adicionar outra propriedade".
5. Clique em "Atualizar" e depois em "Confirmar alteração".
<!-- screenshot: Atribuir responsável a empresas em massa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem informa quantos registros foram atualizados.
## Regras e limites
No máximo 5.000 IDs por solicitação. Valor em branco limpa o campo, exceto quando obrigatório. Propriedades repetidas não são aceitas. Pipeline, etapa e substatus podem exigir seleção em cascata. O nome exibido para o campo de responsável depende do catálogo da entidade.
## Erros comuns
"Nenhum registro foi alterado. Verifique suas permissões.": revise o escopo. "A mesma propriedade foi escolhida duas vezes.": remova a repetida. "Não foi possível carregar as propriedades.": clique em "Tentar novamente".
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/companies$hlp$, NULL, $hlp$internal$hlp$, 125, 2, true),
($hlp$crm$hlp$, $hlp$atribuir-responsavel-a-leads-em-massa$hlp$, $hlp$Atribuir responsável a leads em massa$hlp$, $hlp$Atribuir responsável a leads em massa.$hlp$, $hlp$# Atribuir responsável a leads em massa
**Para que serve:** Atribuir responsável a leads em massa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A edição exige `techsales.leads.update.own` ou `techsales.leads.update.workspace`, dentro do escopo autorizado. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Selecione os registros na listagem.
2. Clique em "Editar em massa".
3. Em "Propriedade a atualizar", escolha "Responsável" e selecione o usuário.
4. Se necessário, clique em "Adicionar outra propriedade".
5. Clique em "Atualizar" e depois em "Confirmar alteração".
<!-- screenshot: Atribuir responsável a leads em massa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem informa quantos registros foram atualizados.
## Regras e limites
No máximo 5.000 IDs por solicitação. Valor em branco limpa o campo, exceto quando obrigatório. Propriedades repetidas não são aceitas. Pipeline, etapa e substatus podem exigir seleção em cascata. O nome exibido para o campo de responsável depende do catálogo da entidade.
## Erros comuns
"Nenhum registro foi alterado. Verifique suas permissões.": revise o escopo. "A mesma propriedade foi escolhida duas vezes.": remova a repetida. "Não foi possível carregar as propriedades.": clique em "Tentar novamente".
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/leads$hlp$, NULL, $hlp$internal$hlp$, 107, 2, true),
($hlp$crm$hlp$, $hlp$atualizar-negocio$hlp$, $hlp$Atualizar um negócio$hlp$, $hlp$Atualizar o funil e consultar cotações, propostas e contratos vinculados ao negócio.$hlp$, $hlp$# Atualizar um negócio
**Para que serve:** Manter o negócio atualizado e acompanhar os documentos comerciais vinculados.
**Quem pode fazer:** Membros ativos com TechSales licenciado e acesso ao negócio. Alterações exigem permissão de atualização em `techsales.deals`; a exclusão exige permissão de exclusão no escopo do registro.
**Onde fica:** Menu > TechSales > Negócios > Negócio (`/deals/$id`).
**Antes de começar:** Abra um negócio ao qual você tenha acesso.

## Passo a passo
1. Confira as propriedades e as associações do negócio.
2. Para trocar o funil, use o seletor com a indicação "Selecione o funil".
3. Confira a etapa e o substatus após a alteração.
4. Consulte as áreas "Cotações", "Propostas" e "Contratos".
5. Para criar uma cotação, adicione primeiro itens de linha ao negócio. Depois, na área "Cotações", clique em "Adicionar".
6. Para excluir o negócio, use a ação de exclusão apenas se tiver permissão e confirme a solicitação.
<!-- screenshot: detalhe do negócio com seletor de funil e áreas Cotações, Propostas e Contratos -->

## Resultado esperado
O negócio passa a refletir o funil atualizado. Os documentos vinculados podem ser consultados no mesmo detalhe.

## Regras e limites
- A criação de cotação fica desabilitada quando o negócio não tem itens de linha.
- O acesso ao negócio não concede automaticamente permissão para excluir.
- Alterações e exclusões respeitam as permissões do registro, também no servidor e no banco.

## Erros comuns
- "Não foi possível carregar este negócio.": tente abrir o registro novamente.
- "Negócio não encontrado.": confira o endereço e seu acesso.
- "Você não tem permissão para excluir este negócio.": solicite a ação a uma pessoa autorizada.
- "Adicione itens de linha ao negócio para gerar uma cotação.": cadastre os itens antes de clicar em "Adicionar".

## Relacionados
- [Acompanhar negócios](/ajuda/crm/acompanhar-negocios)
- [Gerenciar cotações e gerar propostas](/ajuda/crm/gerenciar-cotacoes)$hlp$, $hlp$howto$hlp$, $hlp$/deals/$id$hlp$, NULL, $hlp$internal$hlp$, 201, 1, true),
($hlp$crm$hlp$, $hlp$campos-e-status$hlp$, $hlp$Campos e status do TechSales$hlp$, $hlp$Campos de cada cadastro (obrigatório, formato, exemplo) e significado de cada status.$hlp$, $hlp$# Campos e status do TechSales

## Lead

| Campo | Obrigatório | Formato / exemplo |
|---|---|---|
| Nome | Sim | Texto — "Ana" |
| Sobrenome, Cargo, Empresa, Fonte, LinkedIn | Não | Texto |
| Email | Não | E-mail válido, aceita acentos e domínios internacionais — "ana@empresa.com.br" |
| Telefone | Não | Padrão internacional E.164 — "+55 48 99999-0000" |

E-mail e telefone são conferidos contra duplicidade. Status inicial: novo. Etapas e substatus vêm do pipeline.

## Contato

| Campo | Obrigatório | Formato / exemplo |
|---|---|---|
| Nome | Sim | Texto |
| Sobrenome, Cargo, Empresa | Não | Texto |
| Email | Não | E-mail válido |
| Telefone, WhatsApp (celular) | Não | E.164; WhatsApp precisa ser celular válido |

**Etapa do ciclo:** Assinante, Lead, MQL, SQL, Oportunidade, Cliente, Evangelizador, Outro.

## Empresa

| Campo | Obrigatório | Formato / exemplo |
|---|---|---|
| Nome | Sim | Texto |
| Domínio | Não | "empresa.com.br" |
| CNPJ | Não | CNPJ válido — "12.345.678/0001-90" |

## Proposta

| Campo | Obrigatório | Formato |
|---|---|---|
| Título | Sim | Texto |
| Valor | Não | Moeda (BRL) |
| Responsável, Validade | Não | Membro / data |

**Status:** Rascunho, Em revisão, Aprovada, Enviada, Aceita, Recusada, Expirada, Cancelada.

## Cotação

**Status:** Rascunho, Publicada, Enviada, Aceita, Recusada, Expirada.

## Tarefas, filas e notas

- **Fila:** Nome obrigatório (até 120); Descrição opcional (até 500).
- **Nota:** Conteúdo obrigatório (texto formatado); Assunto opcional.
- **Comunicação:** Tipo obrigatório (ligação, e-mail, reunião); Assunto, Conteúdo, Resultado, Local, URL da gravação opcionais.
- **Reunião:** Título de 1 a 255 caracteres.

## Tickets e macros

- **Ticket:** Assunto obrigatório; Descrição, Status, Prioridade, Responsável, Fonte, Vencimento, Contato, Empresa e Negócio opcionais.
- **Macro:** Nome e Corpo obrigatórios; Atalho, Categoria e Ativa opcionais.

## Campanhas

- **E-mail:** Nome, Assunto e Lista obrigatórios; 1–600 envios/min; proteção de envio recente 0–365 dias. Status: rascunho, agendada, em execução, pausada, concluída, cancelada, falhou.
- **WhatsApp:** público até 5.000; distribuição automática, membro específico, rodízio ou desatribuída; texto até 4.096 caracteres; mídia até 16 MB.

## Sequências de prospecção

Nome até 120 caracteres; expediente HH:mm; intervalo por conta 1–3.600 s; limite por conta em 24 h 1–1.000; evidência de autorização com no mínimo 10 caracteres.

## Agendamento

Título 1–160; slug 2–80; duração 5–480 min; buffers 0–240 min; antecedência mínima 0–720 h e máxima 1–365 dias.

## Faturas

Descrição, Valor (BRL) e Vencimento. **Status:** Rascunho, Em aberto, Paga, Vencida, Cancelada, Reembolsada.

## Relacionados

- [Erros comuns](/ajuda/crm/erros-comuns)
- [Permissões do TechSales](/ajuda/crm/permissoes)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 4, 1, true),
($hlp$crm$hlp$, $hlp$concluir-atribuir-tarefa$hlp$, $hlp$Concluir e atribuir uma tarefa$hlp$, $hlp$Consultar uma tarefa, atualizar seu responsável e marcar a conclusão.$hlp$, $hlp$# Concluir e atribuir uma tarefa
**Para que serve:** Tratar uma tarefa individual e manter o responsável atualizado.
**Quem pode fazer:** Membros ativos com acesso à tarefa e permissões aplicáveis de `techsales.tasks`. Excluir exige autorização específica de exclusão.
**Onde fica:** Menu > TechSales > Tarefas > Tarefa (`/tasks/$id`).
**Antes de começar:** Localize a tarefa na lista e abra seu detalhe.

## Passo a passo
1. Confira as propriedades e a área "Descrição".
2. No seletor "Selecionar responsável", escolha quem ficará responsável.
3. Clique em "Marcar concluída" na tarefa. Para várias tarefas selecionadas, use "Concluir". Para desfazer, use "Reabrir".
4. Para remover o registro, clique em "Excluir tarefa".
5. Confira o aviso "Excluir tarefa?" e confirme somente se deseja remover o registro.
<!-- screenshot: detalhe da tarefa com Descrição, responsável e ação de exclusão -->

## Resultado esperado
A troca de responsável mostra "Responsável atualizado". A conclusão mostra "Concluída". A exclusão mostra "Excluída".

## Regras e limites
- A exclusão não pode ser desfeita.
- Atribuição, conclusão e exclusão dependem das permissões correspondentes.
- "Sem descrição." indica que não há descrição, não uma falha.

## Erros comuns
- Se a tarefa não carregar, confira o endereço e seu acesso ao registro.
- Se a exclusão for recusada, não repita: peça a uma pessoa autorizada.
- Falhas ao atualizar o responsável mostram a mensagem devolvida pelo servidor.

## Relacionados
- [Organizar tarefas](/ajuda/crm/organizar-tarefas)
- [Permissões](/ajuda/crm/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/tasks/$id$hlp$, NULL, $hlp$internal$hlp$, 206, 2, true),
($hlp$crm$hlp$, $hlp$conectar-gerenciar-calendarios$hlp$, $hlp$Conectar e gerenciar calendários$hlp$, $hlp$Conectar o Google Calendar, testar e sincronizar eventos e gravações.$hlp$, $hlp$# Conectar e gerenciar calendários
**Para que serve:** Integrar o Google Calendar, links do Meet e gravações.
**Quem pode fazer:** Gestor+ ou `system.calendars.view.workspace`/`.manage.workspace`; cada ação usa a chave de `system.calendars` correspondente.
**Onde fica:** Menu > TechSales > Relacionar > Reuniões > Calendários (`/settings/calendars`).
**Antes de começar:** Tenha acesso à conta Google.

## Passo a passo
1. Clique em "Conectar Google".
2. Autorize na nova aba.
3. Confira a conta.
4. Ligue ou desligue "Sync".
5. Ligue "Meet automático" para novas reuniões.
6. Clique em "Testar".
7. Use "Sincronizar agora".
8. Clique em "Sincronizar gravações".
9. Para remover, desconecte e confirme "Desconectar calendário?".
<!-- screenshot: conta de calendário com Sync e Meet automático -->

## Resultado esperado
"Google Calendar conectado com sucesso"; teste mostra "Conexão funcionando" ou "Falha na conexão".

## Regras e limites
- Sincronização em lotes, até 20 tentativas por clique.
- Gravações podem levar 10–30 minutos para o Google publicar.
- Lembretes de WhatsApp ficam em Configurações › Engajamento › Lembretes de reunião.

## Erros comuns
- "Falha na conexão": veja a etapa e refaça a autorização.
- "Finalize a conexão do Google na nova aba.".

## Relacionados
- [Criar e gerenciar páginas de agendamento](/ajuda/crm/criar-gerenciar-paginas-agendamento)$hlp$, $hlp$howto$hlp$, $hlp$/settings/calendars$hlp$, $hlp$system.calendars.view.workspace$hlp$, $hlp$internal$hlp$, 313, 2, true),
($hlp$crm$hlp$, $hlp$conectar-sincronizar-gmail$hlp$, $hlp$Conectar e sincronizar o Gmail$hlp$, $hlp$Conectar uma conta Gmail, sincronizar mensagens e configurar a assinatura.$hlp$, $hlp$# Conectar e sincronizar o Gmail
**Para que serve:** Preparar o Gmail para enviar e receber e-mails no TechERP.
**Quem pode fazer:** Membros ativos; as ações seguem as permissões de contas de e-mail.
**Onde fica:** Menu > TechSales > Relacionar > Conexão de Email (`/settings/email`).
**Antes de começar:** Permita a abertura de nova aba.

## Passo a passo
1. Clique em "Conectar Gmail".
2. Na nova aba, autorize a conta Google.
3. Confira em "Contas conectadas".
4. Clique em "Sincronizar".
5. Na assinatura, preencha "Conteúdo" (ou "Editar HTML").
6. Clique em "Salvar assinatura".
7. Para redigir, "Novo email".
8. Para remover, "Desconectar".
<!-- screenshot: contas conectadas e assinatura -->

## Resultado esperado
"Gmail conectado com sucesso" e "Assinatura salva".

## Regras e limites
- Cada conta mostra estado, última sincronização e erro.
- "Limpar" esvazia o editor; salve para valer.

## Erros comuns
- "Sem permissão para visualizar contas de e-mail.".
- "Não foi possível carregar as contas.": "Tentar novamente".
- "Erro ao iniciar OAuth": libere novas abas e tente de novo.

## Relacionados
- [Responder e-mails na Inbox](/ajuda/crm/responder-emails-inbox)
- [Criar e agendar uma campanha de e-mail](/ajuda/crm/criar-campanha-email)$hlp$, $hlp$howto$hlp$, $hlp$/settings/email$hlp$, NULL, $hlp$internal$hlp$, 312, 1, true),
($hlp$crm$hlp$, $hlp$configurar-campanha-de-prospeccao$hlp$, $hlp$Configurar público e roteiros de uma campanha$hlp$, $hlp$Ajuste a janela de discagem, o público e as variantes de roteiro da campanha.$hlp$, $hlp$# Configurar público e roteiros de uma campanha
**Para que serve:** Definir quem recebe ligações e como os roteiros são escolhidos.
**Quem pode fazer:** Usuários com acesso às campanhas de voz. Alterar exige `techsales.prospecting_voice.update.workspace`.
**Onde fica:** Menu > TechSales > Prospecção > Campanhas > Campanha (`/prospecting/campaigns/$id`).
**Antes de começar:** Crie a campanha e os roteiros de ligação.

## Passo a passo
1. Abra a campanha pelo nome.
2. Revise "Nome" e "Modo de atribuição".
3. Preencha "Máx. tentativas por lead" e "Intervalo entre tentativas (min)".
4. Ajuste "Janela início", "Janela fim" e "Dias da semana".
5. Configure "Público da campanha".
6. Configure as variantes em "Script" e o "Peso", se usar atribuição por peso.
7. Salve e aguarde "Salvo".
8. Revise tentativas e indicadores por variante.
<!-- screenshot: configuração da campanha com janela, público e variantes de script -->

## Resultado esperado
A campanha usa a configuração salva. As tentativas alimentam os indicadores por variante.

## Regras e limites
O público pode ser estático ou dinâmico. A distribuição pode ser por peso ou por segmento. Salvar a configuração não dispara ligações.

## Erros comuns
"Erro" aparece quando a falha não traz descrição. Revise os dados e salve de novo.

## Relacionados
- [Criar e gerenciar campanhas de prospecção](/ajuda/crm/criar-gerenciar-campanhas-de-prospeccao)
- [Criar e editar roteiros de ligação](/ajuda/crm/criar-editar-roteiros-de-ligacao)$hlp$, $hlp$howto$hlp$, $hlp$/prospecting/campaigns/$id$hlp$, $hlp$techsales.prospecting_search.view.workspace$hlp$, $hlp$internal$hlp$, 402, 1, true),
($hlp$crm$hlp$, $hlp$configurar-canais-planejamento-de-sequencia$hlp$, $hlp$Configurar canais e planejamento de uma sequência$hlp$, $hlp$Ajuste horários, regras de parada, capacidade por canal e proteção contra contato recente.$hlp$, $hlp$# Configurar canais e planejamento de uma sequência
**Para que serve:** Planejar a capacidade de envio e definir quando a sequência aguarda ou encerra.
**Quem pode fazer:** Quem vê `system.automation.sequences` e tem create ou update. Referências de canais exigem `system.channels.view.workspace`.
**Onde fica:** Menu > TechSales > Sequências de prospecção (`/prospecting/sequences`).
**Antes de começar:** Abra um rascunho editável e conecte os canais.

## Passo a passo
1. Abra "Canais e regras".
2. Escolha "Agente padrão para respostas", se necessário.
3. Preencha "Intervalo mínimo por conta (segundos)" e "Limite por conta em 24 horas".
4. Revise "Interromper contatos pendentes ao receber resposta" e "Encerrar após reunião confirmada".
5. Configure "Fuso horário", "Início do expediente" e "Fim do expediente".
6. Abra "Limites e planejamento".
7. Revise "1. Capacidade por canal e salva-guarda": "Limite bruto por hora" (e-mail), "Limite bruto por dia" (WhatsApp) e "Salva-guarda".
8. Ajuste "2. Espaçamento aleatório entre envios de WhatsApp": "Intervalo mínimo" e "Intervalo máximo".
9. Revise "3. Proteção comercial e contato recente".
10. Use "4. Simulador de entrada diária" e ajuste "Novos contatos por dia".
11. Revise "5. Transbordo quando o limite for atingido" (enfileirar ou passar para o próximo canal).
12. Clique em "Salvar rascunho".
<!-- screenshot: abas Canais e regras e Limites e planejamento, com simulador -->

## Resultado esperado
As regras ficam no rascunho para validar e criar nova versão.

## Regras e limites
Intervalo por conta: 1 a 3.600 segundos. Limite em 24 horas: 1 a 1.000. Não substituem os limites do provedor. Horários no formato HH:mm. O simulador é planejamento, não garantia de envio.

## Erros comuns
"Revise a configuração.": corrija o campo apontado antes de salvar.

## Relacionados
- [Criar o fluxo de uma sequência multicanal](/ajuda/crm/criar-fluxo-de-sequencia)
- [Validar e criar uma versão imutável de sequência](/ajuda/crm/validar-versionar-sequencia)$hlp$, $hlp$howto$hlp$, $hlp$/prospecting/sequences$hlp$, $hlp$system.automation.sequences.view.workspace$hlp$, $hlp$internal$hlp$, 405, 1, true),
($hlp$crm$hlp$, $hlp$configurar-duplicar-auditar-agente-sdr$hlp$, $hlp$Configurar, duplicar e auditar o agente SDR$hlp$, $hlp$Ajuste o agente de IA, crie uma cópia e acompanhe atendimentos e resultados.$hlp$, $hlp$# Configurar, duplicar e auditar o agente SDR
**Para que serve:** Configurar identidade e operação do agente, criar cópia e acompanhar resultados.
**Quem pode fazer:** Quem tem `techsales.marketing.sdr_agent.view.workspace` ou `.manage.workspace`, ou gestor+. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Captar > Agente SDR (`/agents/sdr`).
**Antes de começar:** Escolha o agente.

## Passo a passo
1. Em "Operação", abra "Auditoria" para ver o que a auditoria automática refez e as falhas.
2. Abra "Em atendimento" para as conversas em curso.
3. Em "Estúdio", selecione o agente.
4. Em "Persona e teste", revise "Nome do assistente", "Descrição", "Intenção do agente" e "Tom principal".
5. Revise "Exemplos do jeito certo" e "Expressões a evitar" e teste a conversa.
6. Salve o rascunho. Publique só quando estiver pronto.
7. Em "Configuração do agente", revise situação, roteiro, qualificação, agenda, WhatsApp e passagem para humano.
8. Consulte "Habilidades e ferramentas", "Portfólio e materiais" e "Regras gerais".
9. Para copiar, clique em "Duplicar" e confirme.
10. Em "Resultados", veja conversas, qualificações e reuniões dos últimos 30 dias.
<!-- screenshot: áreas Operação, Estúdio e Resultados e ação Duplicar -->

## Resultado esperado
Rascunho salvo sem mudar a versão publicada. A cópia é um agente independente.

## Regras e limites
Não há aprovação manual: cada mensagem é auditada antes do envio e refeita se violar regras; falhas persistentes vão para humano. A cópia nasce desativada e sem número de WhatsApp. "Portfólio e materiais" e "Regras gerais" valem para todo o workspace. Público, disparos e limites pertencem à campanha.

## Erros comuns
- "Falha no teste: ...": leia o complemento.
- "Rascunho salvo (a versão publicada não mudou)" é confirmação, não erro.

## Relacionados
- [Configurar canais e planejamento de uma sequência](/ajuda/crm/configurar-canais-planejamento-de-sequencia)
- [Permissões](/ajuda/crm/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/agents/sdr$hlp$, $hlp$techsales.marketing.sdr_agent.view.workspace$hlp$, $hlp$internal$hlp$, 410, 1, true),
($hlp$crm$hlp$, $hlp$configurar-metas-comerciais$hlp$, $hlp$Configurar metas comerciais$hlp$, $hlp$Configurar metas comerciais.$hlp$, $hlp$# Configurar metas comerciais

**Para que serve:** Configurar metas comerciais, no contexto da tela `/settings/goals`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.goals`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/goals`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/goals.
2. Consulte as metas e use a criação ou edição habilitada.
3. Confira os valores antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A autorização é techsales.goals; metas comerciais pertencem ao TechSales.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/goals com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/goals$hlp$, NULL, $hlp$internal$hlp$, 127, 1, true),
($hlp$crm$hlp$, $hlp$configurar-pipelines-do-crm$hlp$, $hlp$Configurar pipelines do CRM$hlp$, $hlp$Configurar pipelines do CRM.$hlp$, $hlp$# Configurar pipelines do CRM

**Para que serve:** Configurar pipelines do CRM, no contexto da tela `/settings/pipelines`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.pipelines`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/pipelines`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Estrutura CRM > Pipelines.
2. Revise Nome, Entidade e Visualização padrão.
3. Edite os estágios e confira tipo, identificador, probabilidade, SLA e cor.
4. Revise campos do card e substatus antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.pipelines. Não é o pipeline de recrutamento do ATS em /pipelines; substatus tem controle de gerenciamento próprio.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/pipelines com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/pipelines$hlp$, $hlp$system.pipelines.view.workspace$hlp$, $hlp$internal$hlp$, 154, 1, true),
($hlp$crm$hlp$, $hlp$configurar-politicas-sla-tickets$hlp$, $hlp$Configurar políticas de SLA de tickets$hlp$, $hlp$Definir prazos de primeira resposta e resolução por fila e prioridade.$hlp$, $hlp$# Configurar políticas de SLA de tickets
**Para que serve:** Dar prazos automáticos de primeira resposta e resolução aos tickets.
**Quem pode fazer:** Ver exige `system.automation.sla.view`; criar `.create`; editar `.update`; excluir `.delete`; "Verificar agora" exige `.manage` (escopo own, team ou workspace). O servidor também confere.
**Onde fica:** Menu > TechSales > Otimizar > SLA por etapa (`/settings/sla`) > seção "Políticas de SLA por prioridade/fila (tickets)".
**Antes de começar:** Tenha filas (pipelines) de tickets cadastradas, se quiser uma política por fila.

## Passo a passo
1. Abra a seção "Políticas de SLA por prioridade/fila (tickets)".
2. Clique em "Nova política".
3. Preencha "Nome".
4. Escolha "Fila (pipeline)" e "Prioridade". "Todas" vale para qualquer valor.
5. Informe "1ª resposta (min)" e "Resolução (min)".
6. Deixe "Ativa" ligado e clique em "Salvar".
7. Para editar, clique no lápis. Para excluir, clique na lixeira e confirme.
8. Para marcar vencimentos na hora, clique em "Verificar agora".
<!-- screenshot: janela Nova política de SLA -->

## Resultado esperado
Aparece "Política salva". "Verificar agora" mostra "Checagem: N 1ª resp + N resolução".

## Regras e limites
- Nome: obrigatório, até 120 caracteres.
- Prioridades: Baixa, Média, Alta, Urgente ou Todas.
- 1ª resposta: padrão 60 minutos, de 1 a 100.000.
- Resolução: padrão 1.440 minutos, de 1 a 1.000.000.
- "Verificar agora" só marca como vencidos os tickets com prazo passado, sem resposta ou sem resolução. Não recalcula prazos.
- Tickets excluídos são ignorados.

## Erros comuns
- Botões desabilitados: falta a permissão da ação.
- "Nenhuma política. Crie uma para que tickets ganhem prazos automáticos de primeira resposta e resolução.": ainda não há políticas.

## Relacionados
- [Configurar SLA por etapa](/ajuda/crm/configurar-sla-por-etapa)
- [Acompanhar um ticket](/ajuda/crm/acompanhar-ticket)$hlp$, $hlp$howto$hlp$, $hlp$/settings/sla$hlp$, $hlp$system.automation.sla.view.workspace$hlp$, $hlp$internal$hlp$, 515, 1, true),
($hlp$crm$hlp$, $hlp$configurar-sla-por-etapa$hlp$, $hlp$Configurar SLA por etapa$hlp$, $hlp$Definir prazos em horas e consultar registros com SLA vencido.$hlp$, $hlp$# Configurar SLA por etapa
**Para que serve:** Definir o prazo de permanência nas etapas e acompanhar atrasos.
**Quem pode fazer:** Gestor+ ou `system.automation.sla.view.workspace`/`.manage.workspace`. Editar exige poder atualizar o pipeline e `system.automation.sla.manage.own/team/workspace`.
**Onde fica:** Menu > TechSales > Otimizar > SLA por etapa (`/settings/sla`).
**Antes de começar:** Configure pipelines com etapas.

## Passo a passo
1. Consulte "SLAs vencidos".
2. Localize o pipeline.
3. Informe o prazo em horas de cada etapa.
4. Deixe vazio para etapa sem prazo.
5. Clique em "Salvar SLA".
6. Confira "SLA atualizado".
<!-- screenshot: pipeline com prazos e Salvar SLA -->

## Resultado esperado
Prazos salvos e atrasos atualizados.

## Regras e limites
- Mínimo zero, passo de uma hora.
- No "Ver como" outro usuário não é possível editar.
- Sem permissão no pipeline, os campos ficam desabilitados.
- A mesma tela tem a seção de políticas de SLA de tickets. Veja [Configurar políticas de SLA de tickets](/ajuda/crm/configurar-politicas-sla-tickets).

## Erros comuns
- "Sem estágios configurados.": crie etapas no pipeline.
- "Erro ao salvar": confira valores e acesso.
- "Nenhum registro com SLA vencido. 🎉" não é erro.

## Relacionados
- [Consultar Analytics](/ajuda/crm/consultar-analytics)$hlp$, $hlp$howto$hlp$, $hlp$/settings/sla$hlp$, $hlp$system.automation.sla.view.workspace$hlp$, $hlp$internal$hlp$, 514, 2, true),
($hlp$crm$hlp$, $hlp$construir-pesquisas$hlp$, $hlp$Construir pesquisas$hlp$, $hlp$Organizar campos, revisar a apresentação e salvar uma pesquisa.$hlp$, $hlp$# Construir pesquisas
**Para que serve:** Montar pesquisas no editor.
**Quem pode fazer:** Membros ativos com acesso à pesquisa. A tela não tem item próprio no menu.
**Onde fica:** Menu > TechSales > Pesquisas > "Nova no construtor" (`/survey-builder/$id`).
**Antes de começar:** Crie a pesquisa em "Pesquisas".

## Passo a passo
1. Abra "Construir".
2. Insira campos pela biblioteca.
3. Arraste para reorganizar.
4. Selecione um campo para editar.
5. Duplique ou exclua pelas ações do campo.
6. Em "Configurações", preencha "Descrição exibida ao respondente".
7. Ajuste "Pesquisa com pontuação".
8. Abra "Pré-visualizar".
9. Salve após resolver as pendências.
<!-- screenshot: construtor com campo selecionado -->

## Resultado esperado
"Rascunho salvo".

## Regras e limites
- A publicação lista as pendências.
- Exclusão de campo oferece "Desfazer".
- Duplicação recebe "(cópia)" no rótulo.

## Erros comuns
- "Campo excluído": use "Desfazer" se foi engano.
- "pendência(s) para publicar": corrija os itens apontados.

## Relacionados
- [Gerenciar pesquisas](/ajuda/crm/gerenciar-pesquisas)$hlp$, $hlp$howto$hlp$, $hlp$/survey-builder/$id$hlp$, NULL, $hlp$internal$hlp$, 508, 2, true),
($hlp$crm$hlp$, $hlp$consultar-analytics$hlp$, $hlp$Consultar Analytics$hlp$, $hlp$Acompanhar análises comerciais e indicadores de atendimento.$hlp$, $hlp$# Consultar Analytics
**Para que serve:** Analisar funil, velocidade de vendas, coortes, sentimento, e-mails e SLA.
**Quem pode fazer:** Gestor+ ou `system.analytics.insights.view.workspace`.
**Onde fica:** Menu > TechSales > Otimizar > Analytics (`/analytics`).
**Antes de começar:** Tenha registros para a análise.

## Passo a passo
1. Ajuste "Período" e "Pipeline".
2. Abra "Funil".
3. Abra "Sales Velocity".
4. Abra "Cohort".
5. Abra "Sentimento".
6. Abra "E-mails 1:1".
7. Abra "SLA".
<!-- screenshot: filtros e abas de Analytics -->

## Resultado esperado
A aba mostra seus indicadores.

## Regras e limites
- "Todos" não restringe o pipeline.
- Os filtros valem para as abas "Funil", "Sales Velocity" e "Cohort".
- Sentimento depende das mensagens processadas.

## Erros comuns
- "Erro": a análise de sentimento falhou sem detalhe. Tente de novo.

## Relacionados
- [Consultar o painel de vendas](/ajuda/crm/consultar-painel-de-vendas)
- [Configurar SLA por etapa](/ajuda/crm/configurar-sla-por-etapa)$hlp$, $hlp$howto$hlp$, $hlp$/analytics$hlp$, $hlp$system.analytics.insights.view.workspace$hlp$, $hlp$internal$hlp$, 502, 2, true),
($hlp$crm$hlp$, $hlp$consultar-o-agente-de-voz$hlp$, $hlp$Consultar o agente de voz$hlp$, $hlp$Consultar o agente de voz.$hlp$, $hlp$# Consultar o agente de voz

**Para que serve:** Consultar o agente de voz, no contexto da tela `/settings/voice-agent`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.prospecting_voice`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/voice-agent`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/voice-agent.
2. Revise as opções e o estado apresentado pelo agente de voz.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso techsales.prospecting_voice; é recurso de prospecção do TechSales, não provedor global de IA.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/voice-agent com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/voice-agent$hlp$, NULL, $hlp$internal$hlp$, 174, 1, true),
($hlp$crm$hlp$, $hlp$consultar-o-historico-de-enriquecimento$hlp$, $hlp$Consultar o histórico de enriquecimento$hlp$, $hlp$Consultar o histórico de enriquecimento.$hlp$, $hlp$# Consultar o histórico de enriquecimento

**Para que serve:** Consultar o histórico de enriquecimento, no contexto da tela `/settings/enrichment`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.prospecting_enrichment`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/enrichment`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/enrichment.
2. Consulte o histórico e os estados apresentados.
3. Use a tela de prospecção correspondente para o fluxo operacional.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso techsales.prospecting_enrichment; pertence à prospecção do TechSales, não ao Core.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/enrichment com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/enrichment$hlp$, NULL, $hlp$internal$hlp$, 123, 1, true),
($hlp$crm$hlp$, $hlp$consultar-o-portal-do-cliente$hlp$, $hlp$Consultar o portal do cliente$hlp$, $hlp$Consultar o portal do cliente.$hlp$, $hlp$# Consultar o portal do cliente

**Para que serve:** Consultar o portal do cliente, no contexto da tela `/portal/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/portal/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link de portal recebido.
2. Consulte Suas solicitações.
3. Use a ação de criação disponível somente no contexto do portal.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Portal por token não libera acesso interno nem implica portal público de projetos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /portal/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/portal/$token$hlp$, NULL, $hlp$internal$hlp$, 203, 1, true),
($hlp$crm$hlp$, $hlp$consultar-organizar-tickets$hlp$, $hlp$Consultar e organizar tickets$hlp$, $hlp$Buscar tickets, escolher uma visualização e cadastrar atendimentos.$hlp$, $hlp$# Consultar e organizar tickets
**Para que serve:** Localizar solicitações e organizar o atendimento.
**Quem pode fazer:** Membros ativos com TechSales licenciado. Excluir exige `techsales.tickets.delete.own`, `.delete.workspace` ou `.manage.workspace`.
**Onde fica:** Menu > TechSales > Atender > Tickets (`/tickets`).
**Antes de começar:** Confira pipelines e responsáveis.

## Passo a passo
1. Use "Buscar tickets…".
2. Escolha o pipeline ou "Todos os pipelines".
3. Filtre a prioridade ou "Todas prioridades".
4. Escolha a visualização: "Tabela", "Quadro" ou "Split".
5. Clique em "Novo ticket", preencha e clique em "Criar".
6. Preencha "Assunto *" e "Descrição".
7. Ajuste "Status", "Prioridade", "Responsável", "Fonte" e "Vencimento".
8. Vincule "Contato", "Empresa" e "Negócio".
9. Salve.
10. Para ações em massa, selecione os tickets e escolha a ação.
<!-- screenshot: filtros e formulário de ticket -->

## Resultado esperado
"Ticket criado." ou "Ticket atualizado.".

## Regras e limites
- "Assunto *" obrigatório.
- Exclusão em massa pode ser parcial conforme o acesso.
- Exclusão individual pede "Excluir este ticket?".

## Erros comuns
- "Informe um assunto.": preencha o assunto.

## Relacionados
- [Acompanhar um ticket](/ajuda/crm/acompanhar-ticket)
- [Habilitar o portal do cliente](/ajuda/crm/habilitar-portal-do-cliente)$hlp$, $hlp$howto$hlp$, $hlp$/tickets$hlp$, NULL, $hlp$internal$hlp$, 510, 2, true),
($hlp$crm$hlp$, $hlp$consultar-painel-de-vendas$hlp$, $hlp$Consultar o painel de vendas$hlp$, $hlp$Filtrar os indicadores e acompanhar a operação comercial.$hlp$, $hlp$# Consultar o painel de vendas
**Para que serve:** Acompanhar indicadores de negócios, leads, tarefas e reuniões.
**Quem pode fazer:** Membros ativos com TechSales licenciado. Ver outros responsáveis depende das suas permissões.
**Onde fica:** Menu > TechSales > Visão geral > Dashboard (`/dashboard`).
**Antes de começar:** Tenha registros comerciais no workspace.

## Passo a passo
1. Escolha o "Período".
2. Selecione o "Pipeline de Negócios".
3. Escolha o "Funil de Leads".
4. Use "Canal" ou mantenha "Todos os canais".
5. Ajuste "Responsável", quando disponível.
6. Consulte os indicadores.
<!-- screenshot: filtros do painel e indicadores -->

## Resultado esperado
O painel mostra os dados do recorte escolhido.

## Regras e limites
- Período inicial: últimos 30 dias.
- Seletores de pipeline ficam desabilitados com uma opção só.
- Sem visão da equipe, o responsável fica restrito a você.
- O painel usa a origem principal do lead e mostra a cobertura; vínculos ambíguos não são presumidos.

## Erros comuns
- "Nenhum pipeline disponível": confira os pipelines e seu acesso.
- "Nenhum funil disponível": confira os funis de leads.

## Relacionados
- [Consultar Analytics](/ajuda/crm/consultar-analytics)
- [Criar relatórios personalizados](/ajuda/crm/criar-relatorios-personalizados)$hlp$, $hlp$howto$hlp$, $hlp$/dashboard$hlp$, NULL, $hlp$internal$hlp$, 500, 1, true),
($hlp$crm$hlp$, $hlp$consultar-playbooks-de-prospeccao$hlp$, $hlp$Consultar playbooks de prospecção$hlp$, $hlp$Consultar playbooks de prospecção.$hlp$, $hlp$# Consultar playbooks de prospecção

**Para que serve:** Consultar playbooks de prospecção, no contexto da tela `/settings/playbooks`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.prospecting_playbooks`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/playbooks`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/playbooks.
2. Consulte os playbooks e as ações habilitadas.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso techsales.prospecting_playbooks; pertence ao TechSales.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/playbooks com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/playbooks$hlp$, NULL, $hlp$internal$hlp$, 155, 1, true),
($hlp$crm$hlp$, $hlp$consultar-reunioes$hlp$, $hlp$Consultar reuniões$hlp$, $hlp$Localizar reuniões e consultar detalhes, gravações e transcrições disponíveis.$hlp$, $hlp$# Consultar reuniões
**Para que serve:** Consultar a biblioteca de reuniões e os materiais de cada encontro.
**Quem pode fazer:** Membros ativos com TechSales licenciado e acesso às reuniões (`techsales.meetings`); criar também pode exigir `techsales.activities`.
**Onde fica:** Menu > TechSales > Reuniões (`/meetings`).
**Antes de começar:** Confira se está no workspace correto.

## Passo a passo
1. Abra "Reuniões".
2. Use a busca, o filtro de status e o filtro de responsável.
3. Abra uma reunião.
4. Confira "Participantes" e, quando houver, "Gravação" e "Resumo & transcrição".
5. Confira os encaminhamentos em "Action items".
6. Para iniciar um encontro, clique em "Vídeo". Na janela "Iniciar reunião por vídeo", preencha "Título", marque ou desmarque "Permitir gravação" e clique em "Criar e abrir sala". O Jitsi pede o consentimento dos participantes ao iniciar a gravação.
<!-- screenshot: biblioteca de reuniões e detalhe com Gravação, Resumo & transcrição e Participantes -->

## Resultado esperado
A reunião mostra seus dados e os materiais disponíveis.

## Regras e limites
- Nem toda reunião tem gravação ou transcrição; isso não é erro.
- A gravação precisa pertencer à reunião e ao workspace ativo.
- Ver, alterar, excluir e transcrever dependem de autorização.
- No detalhe da reunião, "Enviar gravação" (ou "Substituir gravação") anexa o arquivo, e "Criar tarefas" gera tarefas a partir da reunião.

## Erros comuns
- "Reunião não encontrada": confira o registro e seu acesso.
- "Não foi possível criar a sala da reunião. Tente novamente.": tente iniciar de novo.
- "Sem gravação para transcrever": envie a gravação antes.
- "Gravação fora da reunião autorizada.": peça verificação do vínculo.
- "LOVABLE_API_KEY não configurada": peça ao administrador para conferir a transcrição.

## Relacionados
- [Organizar tarefas](/ajuda/crm/organizar-tarefas)
- [Erros comuns](/ajuda/crm/erros-comuns)$hlp$, $hlp$howto$hlp$, $hlp$/meetings$hlp$, NULL, $hlp$internal$hlp$, 210, 2, true),
($hlp$crm$hlp$, $hlp$consultar-scoring-de-prospeccao$hlp$, $hlp$Consultar scoring de prospecção$hlp$, $hlp$Consultar scoring de prospecção.$hlp$, $hlp$# Consultar scoring de prospecção

**Para que serve:** Consultar scoring de prospecção, no contexto da tela `/settings/scoring`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.prospecting_scoring`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/scoring`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/scoring.
2. Consulte os controles e as regras de pontuação apresentados.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso techsales.prospecting_scoring. Não é o match-score de candidatos do TechHire.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/scoring com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/scoring$hlp$, NULL, $hlp$internal$hlp$, 164, 1, true),
($hlp$crm$hlp$, $hlp$consultar-segmentos-comerciais$hlp$, $hlp$Consultar segmentos comerciais$hlp$, $hlp$Consultar segmentos comerciais.$hlp$, $hlp$# Consultar segmentos comerciais

**Para que serve:** Consultar segmentos comerciais, no contexto da tela `/settings/segments`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.segments`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/segments`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/segments.
2. Consulte os segmentos e os filtros apresentados.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso techsales.segments; pertence ao TechSales, não é segmentação de todos os seis módulos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/segments com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/segments$hlp$, NULL, $hlp$internal$hlp$, 166, 1, true),
($hlp$crm$hlp$, $hlp$consultar-timeline-de-contato$hlp$, $hlp$Consultar timeline de contato$hlp$, $hlp$Consultar timeline de contato.$hlp$, $hlp$# Consultar timeline de contato
**Para que serve:** Consultar timeline de contato.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Os registros disponíveis respeitam suas permissões e o escopo de acesso. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Contatos (`/contacts/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra a ficha.
2. Consulte os registros no painel central.
3. Ajuste os filtros da timeline e o período.
4. Expanda os itens para conferir detalhes.
5. Se nenhum item aparecer com os filtros, clique em "Limpar filtros".
<!-- screenshot: Consultar timeline de contato: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
O histórico disponível fica organizado na timeline do registro.
## Regras e limites
A timeline pode reunir atividades e mudanças de propriedades. Resumos de registros acessíveis apenas por vínculo não apresentam necessariamente a ficha completa.
## Erros comuns
"Nenhum item corresponde aos filtros.": clique em "Limpar filtros" ou amplie o período.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/contacts/$id$hlp$, NULL, $hlp$internal$hlp$, 119, 1, true),
($hlp$crm$hlp$, $hlp$consultar-timeline-de-empresa$hlp$, $hlp$Consultar timeline de empresa$hlp$, $hlp$Consultar timeline de empresa.$hlp$, $hlp$# Consultar timeline de empresa
**Para que serve:** Consultar timeline de empresa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Os registros disponíveis respeitam suas permissões e o escopo de acesso. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra a ficha.
2. Consulte os registros no painel central.
3. Ajuste os filtros da timeline e o período.
4. Expanda os itens para conferir detalhes.
5. Se nenhum item aparecer com os filtros, clique em "Limpar filtros".
<!-- screenshot: Consultar timeline de empresa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
O histórico disponível fica organizado na timeline do registro.
## Regras e limites
A timeline pode reunir atividades e mudanças de propriedades. Resumos de registros acessíveis apenas por vínculo não apresentam necessariamente a ficha completa.
## Erros comuns
"Nenhum item corresponde aos filtros.": clique em "Limpar filtros" ou amplie o período.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/companies/$id$hlp$, NULL, $hlp$internal$hlp$, 128, 1, true),
($hlp$crm$hlp$, $hlp$consultar-timeline-de-lead$hlp$, $hlp$Consultar timeline de lead$hlp$, $hlp$Consultar timeline de lead.$hlp$, $hlp$# Consultar timeline de lead
**Para que serve:** Consultar timeline de lead.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Os registros disponíveis respeitam suas permissões e o escopo de acesso. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra a ficha.
2. Consulte os registros no painel central.
3. Ajuste os filtros da timeline e o período.
4. Expanda os itens para conferir detalhes.
5. Se nenhum item aparecer com os filtros, clique em "Limpar filtros".
<!-- screenshot: Consultar timeline de lead: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
O histórico disponível fica organizado na timeline do registro.
## Regras e limites
A timeline pode reunir atividades e mudanças de propriedades. Resumos de registros acessíveis apenas por vínculo não apresentam necessariamente a ficha completa.
## Erros comuns
"Nenhum item corresponde aos filtros.": clique em "Limpar filtros" ou amplie o período.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/leads/$id$hlp$, NULL, $hlp$internal$hlp$, 110, 1, true),
($hlp$crm$hlp$, $hlp$consultar-uma-cotacao-publica$hlp$, $hlp$Consultar uma cotação pública$hlp$, $hlp$Consultar uma cotação pública.$hlp$, $hlp$# Consultar uma cotação pública

**Para que serve:** Consultar uma cotação pública, no contexto da tela `/quote/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/quote/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link de cotação recebido.
2. Revise o conteúdo e as ações apresentadas.
3. Confira os termos antes de responder.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Cotação, proposta e contrato são documentos distintos; a existência de link não executa conversão automática.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /quote/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/quote/$token$hlp$, NULL, $hlp$internal$hlp$, 206, 1, true),
($hlp$crm$hlp$, $hlp$consultar-uma-proposta-comercial-publica$hlp$, $hlp$Consultar uma proposta comercial pública$hlp$, $hlp$Consultar uma proposta comercial pública.$hlp$, $hlp$# Consultar uma proposta comercial pública

**Para que serve:** Consultar uma proposta comercial pública, no contexto da tela `/proposal/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/proposal/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link recebido.
2. Confira o documento da proposta e seus dados.
3. Use somente as ações apresentadas no documento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Documento é carregado pela fonte única loadProposalDocument; não é editor livre e não usa cláusulas como modelo de proposta.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /proposal/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/proposal/$token$hlp$, NULL, $hlp$internal$hlp$, 205, 1, true),
($hlp$crm$hlp$, $hlp$controlar-agente-atendimento$hlp$, $hlp$Controlar o agente no atendimento$hlp$, $hlp$Assumir um atendimento do agente e devolver a conversa após a revisão.$hlp$, $hlp$# Controlar o agente no atendimento
**Para que serve:** Alternar entre atendimento humano e automático (chat e e-mail).
**Quem pode fazer:** Membros autorizados a controlar o atendimento. Confirmar identidade exige `system.channels.approve.workspace`.
**Onde fica:** Menu > TechSales > Inbox unificada > Chat ao vivo (`/inbox/chat`) ou Email (`/inbox/email`).
**Antes de começar:** Abra uma conversa com agente ativo.

## Passo a passo
1. Veja se o painel mostra "Agente atendendo" ou "Atendimento humano".
2. Para interromper o agente, clique em "Assumir atendimento".
3. Revise o histórico.
4. Se houver entrega incerta, faça a revisão pedida.
5. Para retomar, clique em "Devolver ao agente".
6. Após verificar a pessoa, clique em "Confirmar identidade da pessoa associada".
<!-- screenshot: painel Agente deste atendimento -->

## Resultado esperado
O painel mostra quem atende. "Identidade confirmada para este atendimento.".

## Regras e limites
- Controlar o agente é diferente de atribuir responsável.
- A devolução pode ficar bloqueada até revisar entrega incerta.
- "Contexto privado do CRM bloqueado": contexto ainda não aprovado. Não confirme identidade só para liberar.

## Erros comuns
- "Não foi possível consultar o estado do agente.": clique em "Tentar novamente".
- Botão de confirmação ausente: falta `system.channels.approve.workspace`.

## Relacionados
- [Atender o chat ao vivo](/ajuda/crm/atender-chat-ao-vivo)
- [Responder e-mails na Inbox](/ajuda/crm/responder-emails-inbox)$hlp$, $hlp$howto$hlp$, $hlp$/inbox/chat$hlp$, NULL, $hlp$internal$hlp$, 303, 1, true),
($hlp$crm$hlp$, $hlp$controlar-campanhas-bloqueios-whatsapp$hlp$, $hlp$Controlar campanhas e entender bloqueios de números$hlp$, $hlp$Iniciar, pausar, editar e duplicar campanhas e entender supressões de telefones.$hlp$, $hlp$# Controlar campanhas e entender bloqueios de números
**Para que serve:** Controlar campanhas e entender por que números ficam fora do envio.
**Quem pode fazer:** Gestor+ ou `techsales.marketing.campaigns.view.workspace`/`.manage.workspace`, mais a permissão de cada alteração.
**Onde fica:** Menu > TechSales > Captar > Campanhas WhatsApp (`/campaigns/whatsapp`).
**Antes de começar:** Confira estado e contadores.

## Passo a passo
1. Clique em "Iniciar".
2. Para interromper, clique em "Pausar".
3. Em rascunho ou pausada, clique em "Editar" e "Salvar alterações".
4. Para reaproveitar, use "Duplicar".
5. Para excluir, use "Excluir" e confira nome e quantidade.
6. Confira enviadas, falhas e ignoradas por regras.
<!-- screenshot: campanha com contadores e ações -->

## Resultado esperado
A campanha muda de estado; "Duplicar" cria rascunho novo.

## Regras e limites
- Editar só em rascunho ou pausada. Pause antes de excluir.
- Excluir não apaga mensagens enviadas.
- Erro Meta `131026` (sem WhatsApp): bloqueio de 90 dias.
- Erro `131049` (engajamento): espera de 7 dias; na repetição, 30 dias.
- Com e sem nono dígito contam como o mesmo número.
- A seleção automática tenta outro celular válido e pula bloqueados.
- Liberação manual fica na ficha do Contato/Lead, não nesta tela.

## Erros comuns
- "Só é possível editar campanhas em rascunho ou pausadas".
- "Pause a campanha antes de excluir".
- "Não foi possível verificar bloqueios de WhatsApp.": tente de novo.
- "Aguardando nova tentativa (limite de engajamento da Meta)": aguarde.

## Relacionados
- [Criar uma campanha de WhatsApp](/ajuda/crm/criar-campanha-whatsapp)
- [Atender conversas de WhatsApp](/ajuda/crm/atender-conversas-whatsapp)$hlp$, $hlp$howto$hlp$, $hlp$/campaigns/whatsapp$hlp$, $hlp$techsales.marketing.campaigns.view.workspace$hlp$, $hlp$internal$hlp$, 311, 1, true),
($hlp$crm$hlp$, $hlp$controlar-campanhas-email$hlp$, $hlp$Acompanhar e controlar campanhas de e-mail$hlp$, $hlp$Consultar destinatários e pausar, retomar ou cancelar campanhas.$hlp$, $hlp$# Acompanhar e controlar campanhas de e-mail
**Para que serve:** Acompanhar resultados e controlar a execução.
**Quem pode fazer:** Gestor+ ou `techsales.marketing.campaigns.view.workspace`/`.manage.workspace`.
**Onde fica:** Menu > TechSales > Captar > Campanhas Email (`/campaigns/email`).
**Antes de começar:** Crie uma campanha.

## Passo a passo
1. Localize a campanha.
2. Abra os detalhes para ver destinatários e resultados.
3. Em execução, use "Pausar".
4. Para retomar, clique no ícone de reproduzir (▶) na linha da campanha pausada ou agendada.
5. Para parar de vez, clique no ícone "X" na linha. Ele aparece para campanhas em envio, pausadas ou agendadas.
6. Para remover, exclua e confirme.
<!-- screenshot: lista de campanhas de e-mail com contadores -->

## Resultado esperado
Estado e contadores atualizados.

## Regras e limites
- Estados: rascunho, agendada, em execução, pausada, concluída, cancelada, falhou.
- Atualiza a cada 5 segundos; mostra até 100 campanhas e 1.000 destinatários.
- Pausar ou cancelar não desfaz envios feitos.

## Erros comuns
- Falha: confira o erro e a conta remetente.

## Relacionados
- [Criar e agendar uma campanha de e-mail](/ajuda/crm/criar-campanha-email)$hlp$, $hlp$howto$hlp$, $hlp$/campaigns/email$hlp$, $hlp$techsales.marketing.campaigns.view.workspace$hlp$, $hlp$internal$hlp$, 309, 2, true),
($hlp$crm$hlp$, $hlp$criar-campanha-email$hlp$, $hlp$Criar e agendar uma campanha de e-mail$hlp$, $hlp$Definir público, conteúdo, teste e horário de envio.$hlp$, $hlp$# Criar e agendar uma campanha de e-mail
**Para que serve:** Enviar e-mails a um segmento com controle de velocidade.
**Quem pode fazer:** Gestor+ ou `techsales.marketing.campaigns.view.workspace`/`.manage.workspace`. Criar e alterar exigem as ações de `techsales.marketing.campaigns`.
**Onde fica:** Menu > TechSales > Captar > Campanhas Email (`/campaigns/email`).
**Antes de começar:** Tenha um segmento e uma conta Gmail própria autorizada.

## Passo a passo
1. Abra a criação de campanha.
2. Preencha "Nome interno" e "Lista (segmento)".
3. Se quiser, carregue "Template (opcional)".
4. Preencha "Assunto", "Corpo HTML" e "Corpo texto (fallback)".
5. Ajuste "Não enviar para quem recebeu e-mail de outra campanha nos últimos (dias)".
6. Defina "Envios por minuto".
7. Em "Enviar email de teste", envie para você.
8. Em "Agendamento", escolha "Enviar agora" ou "Agendar" e a "Data e hora".
9. Clique em "Agendar".
<!-- screenshot: formulário de campanha de e-mail -->

## Resultado esperado
"Campanha agendada".

## Regras e limites
- Nome, assunto e lista são obrigatórios.
- Velocidade: 1 a 600 por minuto (padrão 30).
- Envio recente: 0 a 365 dias (padrão 7; 0 desliga). Excluídos aparecem como "Envio recente".
- Variáveis: `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{email}}`, `{{company_name}}`.

## Erros comuns
- "Nome e assunto são obrigatórios".
- "Selecione uma lista (segmento)".
- "Nenhuma conta própria autorizada para envio.": conecte sua conta.
- "Nenhuma conta Gmail conectada".

## Relacionados
- [Acompanhar e controlar campanhas de e-mail](/ajuda/crm/controlar-campanhas-email)
- [Conectar e sincronizar o Gmail](/ajuda/crm/conectar-sincronizar-gmail)$hlp$, $hlp$howto$hlp$, $hlp$/campaigns/email$hlp$, $hlp$techsales.marketing.campaigns.view.workspace$hlp$, $hlp$internal$hlp$, 308, 1, true),
($hlp$crm$hlp$, $hlp$criar-campanha-whatsapp$hlp$, $hlp$Criar uma campanha de WhatsApp$hlp$, $hlp$Preparar público, template, remetente e distribuição das conversas.$hlp$, $hlp$# Criar uma campanha de WhatsApp
**Para que serve:** Preparar disparos em massa com fila e controle de velocidade.
**Quem pode fazer:** Gestor+ ou `techsales.marketing.campaigns.view.workspace`/`.manage.workspace`. Salvar e executar exigem as ações de campanhas.
**Onde fica:** Menu > TechSales > Captar > Campanhas WhatsApp (`/campaigns/whatsapp`).
**Antes de começar:** Tenha público autorizado, canal e template aprovado.

## Passo a passo
1. Clique em "Nova campanha".
2. Preencha "Nome da campanha".
3. Escolha o remetente.
4. Em número oficial, preencha "Origem da autorização dos destinatários".
5. Escolha "Template" e preencha as variáveis.
6. Defina o público.
7. Escolha a distribuição: "Central de Distribuição (padrão)", "Membro específico", "Dividir entre membros da equipe" ou "Desatribuídas".
8. "Membro específico": um membro; dividir: ao menos dois.
9. Para ativar o SDR, escolha um playbook.
10. Ajuste velocidade e intervalos aleatórios.
11. Clique em "Criar rascunho".
<!-- screenshot: campanha WhatsApp com remetente, template e distribuição -->

## Resultado esperado
"Campanha criada como rascunho". Ainda precisa ser iniciada.

## Regras e limites
- Público máximo: 5.000.
- Telefone no CRM não comprova consentimento.
- Números com qualidade `RED` ficam indisponíveis.
- O remetente não muda depois de iniciar.
- SDR só com template aprovado.
- Disparo pode atrasar cerca de 1 minuto além do intervalo sorteado.

## Erros comuns
- "Adicione pelo menos um destinatário".
- "Escolha o público da campanha".
- "Escolha exatamente um membro para receber as conversas.".
- "Escolha ao menos dois membros para dividir as conversas.".
- "O SDR só pode ser ligado a campanhas com template aprovado.".
- "O público passa de 5.000 destinatários. Refine os filtros.".

## Relacionados
- [Controlar campanhas e entender bloqueios de números](/ajuda/crm/controlar-campanhas-bloqueios-whatsapp)
- [Enviar um modelo aprovado no WhatsApp](/ajuda/crm/enviar-modelo-aprovado-whatsapp)$hlp$, $hlp$howto$hlp$, $hlp$/campaigns/whatsapp$hlp$, $hlp$techsales.marketing.campaigns.view.workspace$hlp$, $hlp$internal$hlp$, 310, 1, true),
($hlp$crm$hlp$, $hlp$criar-contato$hlp$, $hlp$Criar contato$hlp$, $hlp$Criar contato.$hlp$, $hlp$# Criar contato
**Para que serve:** Criar contato.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. O botão exige `techsales.contacts.create.own`. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Contatos (`/contacts`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Clique em "Criar contato".
2. Preencha "Nome *" e, se necessário, "Sobrenome", "Email", "Telefone", "WhatsApp (celular)" e "Cargo".
3. Em "Empresa", selecione uma empresa existente ou conclua a criação da empresa.
4. Clique em "Criar contato".
<!-- screenshot: Criar contato: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem "Contato criado" permite usar "Ir para o contato".
## Regras e limites
Nome é obrigatório. Empresa é opcional, mas um nome de empresa digitado precisa ser selecionado na lista. Telefone e WhatsApp são validados antes da gravação.
## Erros comuns
"Informe ao menos o nome": preencha o campo. "Email inválido": corrija o endereço. "Já existe um contato com esses dados (duplicado).": consulte o contato existente. "Empresa selecionada não é mais válida. Selecione outra ou deixe em branco.": refaça a seleção. "Limite de contatos do plano atingido. Faça upgrade para criar mais.": procure o administrador.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/contacts$hlp$, NULL, $hlp$internal$hlp$, 101, 1, true),
($hlp$crm$hlp$, $hlp$criar-editar-roteiros-de-ligacao$hlp$, $hlp$Criar e editar roteiros de ligação$hlp$, $hlp$Configure scripts de voz, teste a abertura e arquive roteiros já usados.$hlp$, $hlp$# Criar e editar roteiros de ligação
**Para que serve:** Criar roteiros para ligações e preservar o histórico dos usados.
**Quem pode fazer:** Abrir exige `techsales.prospecting_scripts.view.workspace`; criar, editar e excluir exigem create, update e delete de `techsales.prospecting_scripts`. Arquivar e restaurar exigem update.
**Onde fica:** Menu > TechSales > Prospecção > Campanhas > Roteiros de ligação (`/prospecting`).
**Antes de começar:** Prepare objetivo, mensagem inicial e orientações do agente.

## Passo a passo
1. Abra "Roteiros de ligação" e clique em "Novo script".
2. Preencha "Nome" e "Objetivo".
3. Informe "Voz (ElevenLabs voice_id)" ou deixe vazio para a voz padrão.
4. Preencha "Mensagem de abertura" e "Prompt do sistema".
5. Para ouvir a abertura, clique no botão de reprodução ao lado da voz.
6. Salve.
7. Para editar, clique no nome do roteiro.
8. Para retirar um roteiro usado, clique em "Arquivar roteiro".
9. Ative "Mostrar arquivados" e use "Restaurar roteiro" quando precisar.
10. Roteiro sem uso: "Excluir roteiro" e confirme.
<!-- screenshot: formulário do script e lista com Mostrar arquivados -->

## Resultado esperado
"Script salvo", "Roteiro arquivado", "Roteiro restaurado" ou "Roteiro excluído".

## Regras e limites
Roteiros em uso são arquivados, não excluídos. Abertura e prompt aceitam variáveis como {{lead.name}} e {{lead.company}}.

## Erros comuns
- "Defina uma voz e a mensagem de abertura primeiro": preencha os dois campos.
- "Não foi possível carregar os roteiros.": recarregue.
- "Não foi possível concluir a ação.": confira sua permissão.

## Relacionados
- [Configurar público e roteiros de uma campanha](/ajuda/crm/configurar-campanha-de-prospeccao)
- [Criar o fluxo de uma sequência multicanal](/ajuda/crm/criar-fluxo-de-sequencia)$hlp$, $hlp$howto$hlp$, $hlp$/prospecting$hlp$, $hlp$techsales.prospecting_search.view.workspace$hlp$, $hlp$internal$hlp$, 409, 1, true),
($hlp$crm$hlp$, $hlp$criar-empresa$hlp$, $hlp$Criar empresa$hlp$, $hlp$Criar empresa.$hlp$, $hlp$# Criar empresa
**Para que serve:** Criar empresa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. O botão aceita `techsales.companies.manage.workspace`, `techsales.companies.create.workspace` ou `techsales.companies.create.own`. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Clique em "Criar empresa".
2. Preencha "Nome *".
3. Opcionalmente, preencha "Domínio" e "CNPJ".
4. Clique em "Criar".
<!-- screenshot: Criar empresa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A empresa passa a integrar a base.
## Regras e limites
O nome é obrigatório. O CNPJ informado precisa ser válido.
## Erros comuns
"Informe o nome": preencha o nome. "CNPJ inválido.": confira os dígitos. "Falha ao criar": revise os dados e tente novamente.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/companies$hlp$, NULL, $hlp$internal$hlp$, 102, 1, true),
($hlp$crm$hlp$, $hlp$criar-filas-tarefas$hlp$, $hlp$Criar filas de tarefas$hlp$, $hlp$Agrupar contatos, leads ou negócios para executar o trabalho em sequência.$hlp$, $hlp$# Criar filas de tarefas
**Para que serve:** Agrupar registros para tratar um item de cada vez.
**Quem pode fazer:** Membros ativos com TechSales licenciado e autorização para consultar e alterar as filas. O banco aplica a permissão `techsales.task_queues`.
**Onde fica:** Menu > TechSales > Tarefas > Filas (`/tasks/queues`).
**Antes de começar:** Defina os contatos, leads ou negócios que deseja organizar.

## Passo a passo
1. Na área "Nova fila", preencha "Nome".
2. Se necessário, preencha "Descrição (opcional)".
3. Clique em "Criar fila". Aparece "Fila criada".
4. Clique em "Adicionar". Na janela "Adicionar contatos à fila", selecione os registros e clique em "Adicionar (N)".
5. Use a ação de execução da fila para começar o atendimento sequencial.
6. Para remover uma fila, use sua ação de exclusão.
<!-- screenshot: Nova fila com Nome, Descrição (opcional) e uma fila cadastrada -->

## Resultado esperado
O cadastro mostra "Fila criada". A fila fica disponível para receber itens e ser executada.

## Regras e limites
- "Nome" é obrigatório, até 120 caracteres.
- A descrição é opcional, até 500 caracteres.
- A fila organiza contatos, leads ou negócios; não é a lista geral de tarefas.

## Erros comuns
- Se a criação falhar, confira o nome e os limites de tamanho.
- Falhas de criação ou exclusão mostram a mensagem devolvida pelo servidor.

## Relacionados
- [Executar uma fila de tarefas](/ajuda/crm/executar-fila-tarefas)
- [Organizar tarefas](/ajuda/crm/organizar-tarefas)$hlp$, $hlp$howto$hlp$, $hlp$/tasks/queues$hlp$, NULL, $hlp$internal$hlp$, 207, 2, true),
($hlp$crm$hlp$, $hlp$criar-fluxo-de-sequencia$hlp$, $hlp$Criar o fluxo de uma sequência multicanal$hlp$, $hlp$Monte e salve as etapas de uma sequência sem iniciar disparos.$hlp$, $hlp$# Criar o fluxo de uma sequência multicanal
**Para que serve:** Planejar uma abordagem com etapas de e-mail, WhatsApp, chamada, espera, condição, tarefa, agente e encerramento.
**Quem pode fazer:** Quem tem `system.automation.sequences.view.own`, `.view.team` ou `.view.workspace`. Criar exige create; editar exige update.
**Onde fica:** Menu > TechSales > Sequências de prospecção (`/prospecting/sequences`).
**Antes de começar:** Para usar e-mail, conecte sua conta em Canais.

## Passo a passo
1. Clique em "Nova sequência".
2. Preencha "Nome da sequência".
3. Abra "Fluxo" e adicione as etapas.
4. Selecione cada etapa e preencha a configuração.
5. Use "Mover etapa para cima" ou "Mover etapa para baixo".
6. Use "Duplicar etapa" ou "Remover etapa".
7. Nas condições, revise "Critério", "Caminho Sim" e "Caminho Não".
8. Nas chamadas, revise "Modo de chamada" e "Roteiro da telefonia".
9. Clique em "Salvar rascunho".
<!-- screenshot: aba Fluxo com etapas e configuração da etapa selecionada -->

## Resultado esperado
"Rascunho salvo. Nenhuma execução foi iniciada."

## Regras e limites
Nome até 120 caracteres. "Rascunhos recentes (até 100)" reabre rascunhos. Alterações não salvas pedem confirmação antes de trocar de rascunho. Não administradores enviam e-mail só pela própria conta; administradores escolhem a conta.

## Erros comuns
- "Informe o nome da sequência.": preencha o nome.
- "Este rascunho tem uma definição inválida e não foi aberto.": peça revisão.
- "Conecte sua conta de e-mail em Canais para usar passos de e-mail.": conecte a conta.

## Relacionados
- [Configurar canais e planejamento de uma sequência](/ajuda/crm/configurar-canais-planejamento-de-sequencia)
- [Validar e criar uma versão imutável de sequência](/ajuda/crm/validar-versionar-sequencia)
- [Reservar o público de uma sequência](/ajuda/crm/reservar-publico-de-sequencia)$hlp$, $hlp$howto$hlp$, $hlp$/prospecting/sequences$hlp$, $hlp$system.automation.sequences.view.workspace$hlp$, $hlp$internal$hlp$, 404, 1, true),
($hlp$crm$hlp$, $hlp$criar-gerenciar-campanhas-de-prospeccao$hlp$, $hlp$Criar e gerenciar campanhas de prospecção$hlp$, $hlp$Crie uma campanha de ligação e controle sua execução pela lista.$hlp$, $hlp$# Criar e gerenciar campanhas de prospecção
**Para que serve:** Criar campanhas de discagem automática e acessar sua configuração.
**Quem pode fazer:** Usuários liberados pelo menu Prospecção, com as permissões de voz `techsales.prospecting_voice.view/create/update/delete.workspace`, conforme a ação.
**Onde fica:** Menu > TechSales > Prospecção > Campanhas (`/prospecting/campaigns`).
**Antes de começar:** Defina o nome. Configure público e roteiros antes de iniciar.

## Passo a passo
1. Clique em "Nova campanha".
2. Preencha "Nome".
3. Clique em "Criar".
4. Clique no nome da campanha para configurar.
5. Use o botão de reprodução para iniciar (status running).
6. Use o botão de pausa para pausar (status paused).
7. Para remover, clique na lixeira e confirme "Remover?".
<!-- screenshot: lista de campanhas com status e ícones de reprodução, pausa e exclusão -->

## Resultado esperado
"Campanha criada" confirma. A tela abre os detalhes da campanha.

## Regras e limites
O nome é obrigatório. A campanha nasce com 3 tentativas, intervalo de 240 minutos e janela de segunda a sexta, 09:00–18:00 (America/Sao_Paulo), sem leads e sem roteiros.

## Erros comuns
"Nenhuma campanha ainda." indica lista vazia. Se "Criar" não fizer nada, confira o "Nome".

## Relacionados
- [Configurar público e roteiros de uma campanha](/ajuda/crm/configurar-campanha-de-prospeccao)
- [Criar e editar roteiros de ligação](/ajuda/crm/criar-editar-roteiros-de-ligacao)$hlp$, $hlp$howto$hlp$, $hlp$/prospecting/campaigns$hlp$, $hlp$techsales.prospecting_search.view.workspace$hlp$, $hlp$internal$hlp$, 401, 1, true),
($hlp$crm$hlp$, $hlp$criar-gerenciar-paginas-agendamento$hlp$, $hlp$Criar e gerenciar páginas de agendamento$hlp$, $hlp$Definir horários, vincular o calendário e compartilhar um link público de reservas.$hlp$, $hlp$# Criar e gerenciar páginas de agendamento
**Para que serve:** Criar links para clientes reservarem horários.
**Quem pode fazer:** Gestor+ ou `system.booking.view.workspace`/`.manage.workspace`; criar, alterar, excluir e cancelar seguem `system.booking`.
**Onde fica:** Menu > TechSales > Relacionar > Reuniões > Agendamentos (`/settings/booking`).
**Antes de começar:** Defina duração e disponibilidade. Conecte um calendário para gerar evento e Meet.

## Passo a passo
1. Clique em "Nova página".
2. Preencha "Título *" e "Slug *".
3. Informe "Descrição" e "Duração (min)".
4. Defina "Buffer antes", "Buffer depois", "Antecedência mínima (h)" e "Antecedência máxima (dias)".
5. Confira "Fuso horário".
6. Escolha "Conta de calendário (Google Agenda + Meet)".
7. Em "Criar como", escolha "Lead" ou "Contato".
8. Preencha "Cor", "Local / link" e "Disponibilidade semanal".
9. Clique em "Salvar".
10. Copie o link ou abra a página pública pelos ícones.
11. Use o olho para ver "Reservas".
12. Edite pelo lápis; exclua pela lixeira ("Excluir página?").
<!-- screenshot: formulário de página de agendamento -->

## Resultado esperado
"Página salva". Endereço público: `/book/<slug>`.

## Regras e limites
- Título 1–160; slug 2–80 (letras, números, hífen).
- Duração 5–480 min; buffers 0–240 min.
- Antecedência mínima 0–720 h; máxima 1–365 dias.
- Até 8 intervalos por dia.
- Sem calendário, não gera evento nem Meet.

## Erros comuns
- "Sem calendário": vincule uma conta.
- "Nenhuma reserva ainda." / "Nenhuma página criada ainda.".

## Relacionados
- [Conectar e gerenciar calendários](/ajuda/crm/conectar-gerenciar-calendarios)$hlp$, $hlp$howto$hlp$, $hlp$/settings/booking$hlp$, $hlp$system.booking.view.workspace$hlp$, $hlp$internal$hlp$, 314, 1, true),
($hlp$crm$hlp$, $hlp$criar-landing-pages$hlp$, $hlp$Criar landing pages$hlp$, $hlp$Cadastrar uma página e abrir seu editor.$hlp$, $hlp$# Criar landing pages
**Para que serve:** Cadastrar páginas montadas no editor.
**Quem pode fazer:** Gestor+ ou `techsales.marketing.landing_pages.view.workspace`/`.manage.workspace`. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Captar > Landing Pages (`/landing-pages`).
**Antes de começar:** Defina objetivo e endereço da página.

## Passo a passo
1. Clique em "Nova landing page". A página é criada com o título "Nova landing page" e um endereço automático.
2. Abra a página criada e edite os dados.
3. Conclua o cadastro.
4. Abra a edição pelo lápis.
5. Monte e publique no editor.
6. Para excluir, use a lixeira da lista.
<!-- screenshot: lista de landing pages -->

## Resultado esperado
"Landing page criada". A página fica disponível para edição.

## Regras e limites
- Cadastro e publicação são etapas distintas.
- A exclusão pede confirmação. Ao concluir, aparece "Excluída".

## Erros comuns
- "Erro ao excluir": atualize a lista e confira se a página continua lá.

## Relacionados
- [Editar e publicar landing pages](/ajuda/crm/editar-publicar-landing-pages)$hlp$, $hlp$howto$hlp$, $hlp$/landing-pages$hlp$, $hlp$techsales.marketing.landing_pages.view.workspace$hlp$, $hlp$internal$hlp$, 505, 2, true),
($hlp$crm$hlp$, $hlp$criar-lead$hlp$, $hlp$Criar lead$hlp$, $hlp$Criar lead.$hlp$, $hlp$# Criar lead
**Para que serve:** Criar lead.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. O botão exige `techsales.leads.create.own`. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Clique em "Criar lead".
2. Em "Buscar contato", pesquise por e-mail, nome ou telefone. Selecione um contato ou clique em "Criar do zero".
3. Preencha "Nome *". Complete "Sobrenome", "Email", "Telefone", "Cargo" e "Fonte" quando disponíveis.
4. Se informar "Empresa", selecione o resultado ou crie a empresa antes de continuar.
5. Opcionalmente, informe "LinkedIn" e clique em "Buscar". Revise os dados preenchidos.
6. Clique em "Criar lead".
<!-- screenshot: Criar lead: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
O lead é criado com status inicial new e relações de empresa e contato processadas pelo sistema.
## Regras e limites
Nome é obrigatório. Email e telefone passam por verificação de duplicidade. LinkedIn pode iniciar enriquecimento; revise o retorno antes de salvar. "Site da empresa" aparece quando a empresa selecionada ainda não tem domínio.
## Erros comuns
"Informe ao menos o nome": preencha o nome. "Email inválido": corrija o endereço. "Lead duplicado": abra o registro existente.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/leads$hlp$, NULL, $hlp$internal$hlp$, 100, 1, true),
($hlp$crm$hlp$, $hlp$criar-publicar-workflows$hlp$, $hlp$Criar e publicar workflows$hlp$, $hlp$Salve um rascunho, publique uma versão e acompanhe execuções de automações.$hlp$, $hlp$# Criar e publicar workflows
**Para que serve:** Configurar automações, separando o rascunho da versão publicada.
**Quem pode fazer:** Gestor+ ou `system.workflows.manage.workspace`. Decisões de aprovação exigem permissão de aprovação.
**Onde fica:** Menu > TechSales > Otimizar > Workflows (`/settings/workflows`).
**Antes de começar:** Defina o gatilho e as ações. Se houver distribuição, crie a regra antes.

## Passo a passo
1. Abra a aba "Workflows".
2. Crie ou abra um workflow. O editor mostra "Novo workflow" ou "Editar workflow"; preencha o nome.
3. Configure o gatilho e as etapas.
4. Salve o rascunho.
5. Clique em "Salvar rascunho" para guardar sem ativar, ou em "Salvar e publicar".
6. Abra "Execuções recentes".
7. Abra "Política de envio" para revisar regras de envio.
8. Em decisão pendente, preencha "Comentário da decisão (opcional)" e aprove ou rejeite.
<!-- screenshot: abas Workflows, Execuções recentes e Política de envio -->

## Resultado esperado
"Rascunho salvo — publique para ativar"; "Publicado — v…"; "Aprovado — retomada enfileirada".

## Regras e limites
Salvar não é publicar. Aprovar ou rejeitar muda o andamento da execução.

## Erros comuns
- "Erro ao salvar": revise o rascunho.
- "Erro ao publicar": confira a configuração.
- "Erro no teste": revise o registro de teste.
- "Erro ao remover": confira sua autorização.

## Relacionados
- [Criar regras de distribuição](/ajuda/crm/criar-regras-de-distribuicao)
- [Erros comuns](/ajuda/crm/erros-comuns)$hlp$, $hlp$howto$hlp$, $hlp$/settings/workflows$hlp$, $hlp$system.workflows.manage.workspace$hlp$, $hlp$internal$hlp$, 413, 2, true),
($hlp$crm$hlp$, $hlp$criar-regras-de-distribuicao$hlp$, $hlp$Criar regras de distribuição$hlp$, $hlp$Defina responsáveis e uma estratégia de rodízio para usar em workflows.$hlp$, $hlp$# Criar regras de distribuição
**Para que serve:** Distribuir leads e negócios entre responsáveis.
**Quem pode fazer:** Gestor+ ou `system.automation.rotation.view.workspace`/`.manage.workspace`. Gravar e excluir exigem gerenciamento.
**Onde fica:** Menu > TechSales > Otimizar > Distribuição (`/settings/rotation`).
**Antes de começar:** A regra é usada no Workflow pela ação "Distribuir via regra".

## Passo a passo
1. Clique em "Nova regra".
2. Preencha "Nome".
3. Escolha "Entidade" e "Estratégia".
4. Em "Responsáveis", use "+ Adicionar membro".
5. Na estratégia por peso, ajuste o peso de cada um.
6. Defina "Ativa" ou "Pausada".
7. Clique em "Salvar".
8. Clique em "copiar para usar no Workflow".
9. Use o identificador na ação "Distribuir via regra".
10. Para editar ou excluir, use lápis ou lixeira.
<!-- screenshot: formulário de distribuição com estratégia e responsáveis -->

## Resultado esperado
"Regra salva" e "ID copiado".

## Regras e limites
Nome e ao menos um responsável são obrigatórios. Pesos só valem na estratégia por peso ("peso ignorado" nas demais). Pausar é diferente de excluir.

## Erros comuns
- "Dê um nome para a regra": preencha "Nome".
- "Adicione ao menos um responsável": inclua um membro.

## Relacionados
- [Criar e publicar workflows](/ajuda/crm/criar-publicar-workflows)
- [Permissões](/ajuda/crm/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/settings/rotation$hlp$, $hlp$system.automation.rotation.view.workspace$hlp$, $hlp$internal$hlp$, 412, 1, true),
($hlp$crm$hlp$, $hlp$criar-relatorios-personalizados$hlp$, $hlp$Criar relatórios personalizados$hlp$, $hlp$Configurar agrupamentos, métricas e visualizações e salvar relatórios.$hlp$, $hlp$# Criar relatórios personalizados
**Para que serve:** Montar consultas resumidas sobre o CRM e salvar a configuração.
**Quem pode fazer:** Gestor+ ou `system.analytics.reports.view.workspace`/`.manage.workspace`. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Otimizar > Relatórios (`/reports`).
**Antes de começar:** Defina a entidade e o indicador.

## Passo a passo
1. Em "Salvos", clique em "Novo".
2. Escolha "Entidade" e "Agrupar por".
3. Escolha "Métrica" e, se numérica, o "Campo".
4. Escolha "Visualização": "Barras", "Linha", "Pizza" ou "Tabela".
5. Ajuste "Período por" e "Período", quando houver.
6. Clique em "Executar".
7. Preencha "Nome *" e, se quiser, "Descrição".
8. Clique em "Salvar".
9. Para reabrir, clique no relatório em "Salvos".
10. Use a estrela para favoritar ou a lixeira para excluir ("Excluir relatório?").
<!-- screenshot: configuração de entidade, métrica e visualização -->

## Resultado esperado
O relatório aparece em "Salvos" e pode ir para um painel.

## Regras e limites
- "Contagem" não exige campo numérico.
- Agrupamentos e períodos variam por entidade.
- O botão "CSV" exporta os resultados exibidos. Ele fica desabilitado sem resultados.

## Erros comuns
- "Informe o nome.": preencha "Nome *".
- "Erro": falha sem detalhe; tente de novo.

## Relacionados
- [Gerenciar painéis de relatórios](/ajuda/crm/gerenciar-paineis)$hlp$, $hlp$howto$hlp$, $hlp$/reports$hlp$, $hlp$system.analytics.reports.view.workspace$hlp$, $hlp$internal$hlp$, 503, 2, true),
($hlp$crm$hlp$, $hlp$editar-contato$hlp$, $hlp$Editar contato$hlp$, $hlp$Editar contato.$hlp$, $hlp$# Editar contato
**Para que serve:** Editar contato.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A edição exige `techsales.contacts.update.own` ou `techsales.contacts.update.workspace`, dentro do escopo autorizado. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Contatos (`/contacts/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra o registro pela listagem.
2. No painel de propriedades, clique no campo que deseja alterar.
3. Informe o novo valor e saia do campo para concluir a edição.
4. Confira a mensagem "Atualizado".
<!-- screenshot: Editar contato: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A propriedade editada aparece atualizada na ficha.
## Regras e limites
A gravação ocorre por campo. Campos e opções dependem do catálogo da entidade e das permissões. Registros acessíveis apenas por vínculo podem mostrar somente um resumo, sem edição.
## Erros comuns
"Email inválido.": revise o endereço. "CNPJ inválido.": revise o documento, quando o campo existir. "CEP inválido. Use 8 dígitos (99999-999).": corrija o CEP, quando disponível.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/contacts/$id$hlp$, NULL, $hlp$internal$hlp$, 112, 1, true),
($hlp$crm$hlp$, $hlp$editar-contatos-em-massa$hlp$, $hlp$Editar campos de contatos em massa$hlp$, $hlp$Editar campos de contatos em massa.$hlp$, $hlp$# Editar campos de contatos em massa
**Para que serve:** Editar campos de contatos em massa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A edição exige `techsales.contacts.update.own` ou `techsales.contacts.update.workspace`, dentro do escopo autorizado. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Contatos (`/contacts`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Selecione os registros na listagem.
2. Clique em "Editar em massa".
3. Em "Propriedade a atualizar", escolha o campo e informe o novo valor.
4. Se necessário, clique em "Adicionar outra propriedade".
5. Clique em "Atualizar" e depois em "Confirmar alteração".
<!-- screenshot: Editar campos de contatos em massa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem informa quantos registros foram atualizados.
## Regras e limites
No máximo 5.000 IDs por solicitação. Valor em branco limpa o campo, exceto quando obrigatório. Propriedades repetidas não são aceitas. Pipeline, etapa e substatus podem exigir seleção em cascata. 
## Erros comuns
"Nenhum registro foi alterado. Verifique suas permissões.": revise o escopo. "A mesma propriedade foi escolhida duas vezes.": remova a repetida. "Não foi possível carregar as propriedades.": clique em "Tentar novamente".
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/contacts$hlp$, NULL, $hlp$internal$hlp$, 115, 1, true),
($hlp$crm$hlp$, $hlp$editar-empresa$hlp$, $hlp$Editar empresa$hlp$, $hlp$Editar empresa.$hlp$, $hlp$# Editar empresa
**Para que serve:** Editar empresa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A edição exige `techsales.companies.update.own` ou `techsales.companies.update.workspace`, dentro do escopo autorizado. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra o registro pela listagem.
2. No painel de propriedades, clique no campo que deseja alterar.
3. Informe o novo valor e saia do campo para concluir a edição.
4. Confira a mensagem "Atualizado".
<!-- screenshot: Editar empresa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A propriedade editada aparece atualizada na ficha.
## Regras e limites
A gravação ocorre por campo. Campos e opções dependem do catálogo da entidade e das permissões. Registros acessíveis apenas por vínculo podem mostrar somente um resumo, sem edição.
## Erros comuns
"Email inválido.": revise o endereço. "CNPJ inválido.": revise o documento, quando o campo existir. "CEP inválido. Use 8 dígitos (99999-999).": corrija o CEP, quando disponível.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/companies/$id$hlp$, NULL, $hlp$internal$hlp$, 121, 1, true),
($hlp$crm$hlp$, $hlp$editar-empresas-em-massa$hlp$, $hlp$Editar campos de empresas em massa$hlp$, $hlp$Editar campos de empresas em massa.$hlp$, $hlp$# Editar campos de empresas em massa
**Para que serve:** Editar campos de empresas em massa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A edição exige `techsales.companies.update.own` ou `techsales.companies.update.workspace`, dentro do escopo autorizado. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Selecione os registros na listagem.
2. Clique em "Editar em massa".
3. Em "Propriedade a atualizar", escolha o campo e informe o novo valor.
4. Se necessário, clique em "Adicionar outra propriedade".
5. Clique em "Atualizar" e depois em "Confirmar alteração".
<!-- screenshot: Editar campos de empresas em massa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem informa quantos registros foram atualizados.
## Regras e limites
No máximo 5.000 IDs por solicitação. Valor em branco limpa o campo, exceto quando obrigatório. Propriedades repetidas não são aceitas. Pipeline, etapa e substatus podem exigir seleção em cascata. 
## Erros comuns
"Nenhum registro foi alterado. Verifique suas permissões.": revise o escopo. "A mesma propriedade foi escolhida duas vezes.": remova a repetida. "Não foi possível carregar as propriedades.": clique em "Tentar novamente".
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/companies$hlp$, NULL, $hlp$internal$hlp$, 124, 1, true),
($hlp$crm$hlp$, $hlp$editar-enviar-proposta$hlp$, $hlp$Editar e enviar uma proposta$hlp$, $hlp$Revisar a proposta, solicitar aprovação e disponibilizar link público e PDF.$hlp$, $hlp$# Editar e enviar uma proposta
**Para que serve:** Preparar o documento comercial, registrar a aprovação interna e disponibilizar a proposta ao cliente.
**Quem pode fazer:** Membros ativos com acesso à proposta. Editar exige atualização em `techsales.proposals`. Compartilhar e baixar PDF exigem `techsales.proposal_share`; enviar exige `techsales.proposal_send`.
**Onde fica:** Menu > TechSales > Propostas > Proposta (`/proposals/$id`).
**Antes de começar:** Confira o status e se a proposta está marcada como "Travada".

## Passo a passo
1. Clique em "Editar" para abrir o assistente, quando a proposta não estiver travada.
2. Revise "Título *", "Responsável" e "Validade".
3. Confira os itens e o campo "Valor total da proposta".
4. Revise o modelo e o conteúdo. Avance pelas etapas e clique em "Salvar proposta".
5. Para revisão interna de um rascunho, clique em "Enviar para aprovação".
6. Escolha "Revisor", preencha "Comentário" se necessário e clique em "Enviar para revisão".
7. Quando a ação estiver disponível, clique em "Enviar ao cliente".
8. Use "Copiar link" para compartilhar o endereço público ou "Baixar PDF" para obter o documento.
<!-- screenshot: proposta com status, versão, Editar, Copiar link, Baixar PDF e Enviar ao cliente -->

## Resultado esperado
A edição atualiza a proposta. A solicitação de revisão mostra "Aprovação solicitada.". O envio mostra "Proposta enviada e selada.". A cópia mostra "Link copiado.".

## Regras e limites
- "Editar" não aparece para uma proposta travada.
- A solicitação de aprovação fica disponível para rascunhos não travados.
- O revisor precisa de permissão de aprovação. Você não pode aprovar a própria solicitação.
- "Enviar ao cliente" aparece para propostas em rascunho ou aprovadas, conforme a permissão. A ação registra o envio e sela o documento; não confirma entrega de e-mail.
- Os itens não são alterados no assistente. Edite a cotação ou os itens de linha do negócio de origem.
- Compartilhe o link público e o PDF apenas com os destinatários pretendidos.

## Erros comuns
- "Informe o título.": preencha "Título *".
- "Não foi possível carregar a proposta.": clique em "Tentar novamente".
- "A origem não tem itens de linha.": confira a cotação ou o negócio de origem.
- Se "Enviar para revisão" estiver desabilitado, selecione um revisor.

## Relacionados
- [Gerenciar propostas](/ajuda/crm/gerenciar-propostas)
- [Gerenciar cotações e gerar propostas](/ajuda/crm/gerenciar-cotacoes)$hlp$, $hlp$howto$hlp$, $hlp$/proposals/$id$hlp$, NULL, $hlp$internal$hlp$, 203, 1, true),
($hlp$crm$hlp$, $hlp$editar-lead$hlp$, $hlp$Editar lead$hlp$, $hlp$Editar lead.$hlp$, $hlp$# Editar lead
**Para que serve:** Editar lead.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A edição exige `techsales.leads.update.own` ou `techsales.leads.update.workspace`, dentro do escopo autorizado. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra o registro pela listagem.
2. No painel de propriedades, clique no campo que deseja alterar.
3. Informe o novo valor e saia do campo para concluir a edição.
4. Confira a mensagem "Atualizado".
<!-- screenshot: Editar lead: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A propriedade editada aparece atualizada na ficha.
## Regras e limites
A gravação ocorre por campo. Campos e opções dependem do catálogo da entidade e das permissões. Registros acessíveis apenas por vínculo podem mostrar somente um resumo, sem edição.
## Erros comuns
"Email inválido.": revise o endereço. "CNPJ inválido.": revise o documento, quando o campo existir. "CEP inválido. Use 8 dígitos (99999-999).": corrija o CEP, quando disponível.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/leads/$id$hlp$, NULL, $hlp$internal$hlp$, 103, 1, true),
($hlp$crm$hlp$, $hlp$editar-leads-em-massa$hlp$, $hlp$Editar campos de leads em massa$hlp$, $hlp$Editar campos de leads em massa.$hlp$, $hlp$# Editar campos de leads em massa
**Para que serve:** Editar campos de leads em massa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A edição exige `techsales.leads.update.own` ou `techsales.leads.update.workspace`, dentro do escopo autorizado. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Selecione os registros na listagem.
2. Clique em "Editar em massa".
3. Em "Propriedade a atualizar", escolha o campo e informe o novo valor.
4. Se necessário, clique em "Adicionar outra propriedade".
5. Clique em "Atualizar" e depois em "Confirmar alteração".
<!-- screenshot: Editar campos de leads em massa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem informa quantos registros foram atualizados.
## Regras e limites
No máximo 5.000 IDs por solicitação. Valor em branco limpa o campo, exceto quando obrigatório. Propriedades repetidas não são aceitas. Pipeline, etapa e substatus podem exigir seleção em cascata. 
## Erros comuns
"Nenhum registro foi alterado. Verifique suas permissões.": revise o escopo. "A mesma propriedade foi escolhida duas vezes.": remova a repetida. "Não foi possível carregar as propriedades.": clique em "Tentar novamente".
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/leads$hlp$, NULL, $hlp$internal$hlp$, 106, 1, true),
($hlp$crm$hlp$, $hlp$editar-publicar-landing-pages$hlp$, $hlp$Editar e publicar landing pages$hlp$, $hlp$Montar blocos, configurar a página e controlar a publicação.$hlp$, $hlp$# Editar e publicar landing pages
**Para que serve:** Montar o conteúdo e publicar a página.
**Quem pode fazer:** Gestor+ ou `techsales.marketing.landing_pages.view.workspace`/`.manage.workspace`. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Landing Pages > edição (`/landing-pages/$id`).
**Antes de começar:** Cadastre a landing page.

## Passo a passo
1. Escolha os blocos de conteúdo.
2. Clique em um bloco para editar as propriedades.
3. Abra "Configurações".
4. Em "SEO", ajuste "Título da página", "Slug (URL)" e "Meta descrição".
5. Em "Tema", ajuste "Cor primária", "Cor de fundo" e "Fonte".
6. Aguarde "Salvo".
7. Clique em "Preview".
8. Clique em "Publicar".
9. Para retirar do ar, clique em "Despublicar".
<!-- screenshot: editor com bloco selecionado e SEO -->

## Resultado esperado
A página fica publicada ou volta a rascunho.

## Regras e limites
- Endereço público: "/lp/slug".
- "Avançado" › "Status": "Rascunho", "Publicada" e "Arquivada".
- "Desfazer (Ctrl+Z)" e "Refazer (Ctrl+Y)".

## Erros comuns
Se salvar falhar, o editor mostra a mensagem. Só considere salvo após ver "Salvo".

## Relacionados
- [Criar landing pages](/ajuda/crm/criar-landing-pages)
- [Gerenciar formulários públicos](/ajuda/crm/gerenciar-formularios-publicos)$hlp$, $hlp$howto$hlp$, $hlp$/landing-pages/$id$hlp$, $hlp$techsales.marketing.landing_pages.view.workspace$hlp$, $hlp$internal$hlp$, 506, 1, true),
($hlp$crm$hlp$, $hlp$enriquecer-cadastros$hlp$, $hlp$Enriquecer contatos, leads e empresas$hlp$, $hlp$Completar dados de cadastros com Apollo, Lusha e consulta de CNPJ.$hlp$, $hlp$# Enriquecer contatos, leads e empresas
**Para que serve:** Preencher e-mail, telefone, nome, cargo, empresa e LinkedIn com dados de provedores externos.
**Quem pode fazer:** Executar exige `techsales.prospecting_enrichment.manage.own/team/workspace`. Consultar o histórico exige `.view`. Em lote, cada registro também precisa poder ser alterado (ou visto, na simulação).
**Onde fica:** Listas de Contatos (`/contacts`) e Leads (`/leads`) > selecione registros > "Enriquecer". Ficha da empresa (`/companies/$id`) > "Enriquecer via CNPJ". Ficha do Lead, ao trocar o LinkedIn.
**Antes de começar:** Conecte Apollo ou Lusha nas integrações. Para empresas, cadastre o CNPJ.

## Passo a passo
1. Na lista de Contatos ou Leads, selecione os registros e clique em "Enriquecer".
2. Em "Provedores (na ordem)", escolha Apollo, Lusha ou os dois.
3. Em "Modo", escolha "Preencher apenas vazios" ou "Sobrescrever existentes".
4. Em "Execução", escolha "Aplicar mudanças" ou "Simular (sem consumir crédito)".
5. Confirme e acompanhe o resumo: atualizados, sem mudanças, falhas e créditos.
6. Para empresa, abra a ficha e clique em "Enriquecer via CNPJ".
7. No Lead, salve uma nova URL de LinkedIn. O sistema reenriquece sozinho.
<!-- screenshot: janela Enriquecer na lista de leads -->

## Resultado esperado
Os campos são preenchidos conforme o modo escolhido. Telefones pedidos ao Apollo podem chegar alguns minutos depois.

## Regras e limites
- Até 500 registros por chamada; seleções maiores são divididas em lotes de 500.
- Campos de Lead: e-mail, telefone, nome, sobrenome, empresa, cargo e LinkedIn. Contato: os mesmos, sem empresa.
- Os provedores rodam em cascata, na ordem escolhida.
- Foto colocada manualmente nunca é trocada.
- Conta-se um crédito por retorno encontrado de cada provedor, mesmo sem mudança de campo.
- A simulação não grava mudanças nem créditos, mas ainda consulta os provedores.
- CNPJ: usa BrasilAPI e, se falhar, ReceitaWS. Exige 14 dígitos e só preenche campos vazios (nome, setor, porte, telefone, endereço, cidade, estado, CEP e domínio).

## Erros comuns
- "Apollo não conectado: configure APOLLO_API_KEY em Integrações.": conecte o Apollo.
- "Lusha não conectado: configure LUSHA_API_KEY em Integrações.": conecte o Lusha.
- "Créditos do Apollo.io esgotados. Atualize o plano para voltar a enriquecer.": renove os créditos.
- "Cadastre o CNPJ antes de enriquecer.": informe o CNPJ.
- "CNPJ não encontrado nas bases públicas.": confira o número.

## Relacionados
- [Visão geral do TechSales](/ajuda/crm)$hlp$, $hlp$howto$hlp$, $hlp$/settings/enrichment$hlp$, $hlp$techsales.prospecting_enrichment.view.own$hlp$, $hlp$internal$hlp$, 161, 1, true),
($hlp$crm$hlp$, $hlp$entrar-em-uma-sala-publica-de-video$hlp$, $hlp$Entrar em uma sala pública de vídeo$hlp$, $hlp$Entrar em uma sala pública de vídeo.$hlp$, $hlp$# Entrar em uma sala pública de vídeo

**Para que serve:** Entrar em uma sala pública de vídeo, no contexto da tela `/meet/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/meet/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link da reunião.
2. Informe Seu nome e E-mail opcional.
3. Use a ação de entrada apresentada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O token e o estado da reunião condicionam a entrada; falha de acesso não se resolve compartilhando credenciais internas.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /meet/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/meet/$token$hlp$, NULL, $hlp$internal$hlp$, 201, 1, true),
($hlp$crm$hlp$, $hlp$enviar-modelo-aprovado-whatsapp$hlp$, $hlp$Enviar um modelo aprovado no WhatsApp$hlp$, $hlp$Selecionar um template aprovado pela Meta e preencher as variáveis.$hlp$, $hlp$# Enviar um modelo aprovado no WhatsApp
**Para que serve:** Iniciar ou continuar uma conversa fora da janela de 24 horas.
**Quem pode fazer:** Quem pode criar mensagens em `techsales.inbox.whatsapp`.
**Onde fica:** Menu > TechSales > Inbox unificada > WhatsApp (`/inbox/whatsapp`).
**Antes de começar:** Tenha um modelo `APPROVED` na conta usada.

## Passo a passo
1. Abra a conversa.
2. Localize "Modelo aprovado pela Meta".
3. Em "Escolha um modelo aprovado", selecione o modelo.
4. Preencha as variáveis do corpo e do cabeçalho.
5. Se o modelo pedir mídia, anexe.
6. Clique em "Enviar modelo".
<!-- screenshot: modelo selecionado com variáveis -->

## Resultado esperado
O servidor confirma a aprovação e envia.

## Regras e limites
- O modelo é conferido na conta e no canal da conversa.
- Pendente ou reprovado não pode ser enviado.
- Se a consulta à Meta falhar, o envio é bloqueado até funcionar.
- Enviar modelo não abre janela de texto livre; só a resposta do cliente abre.

## Erros comuns
- "Este modelo não está aprovado pela Meta. Escolha outro modelo aprovado.".
- "Não foi possível confirmar o modelo na conta do WhatsApp agora. Tente novamente em instantes.".
- "Este modelo tem cabeçalho de mídia: anexe o arquivo antes de enviar.".
- "Preencha a variável do cabeçalho do modelo.".
- "Preencha a variável {{1}} do modelo.": o número indica a variável vazia.

## Relacionados
- [Atender conversas de WhatsApp](/ajuda/crm/atender-conversas-whatsapp)$hlp$, $hlp$howto$hlp$, $hlp$/inbox/whatsapp$hlp$, NULL, $hlp$internal$hlp$, 305, 1, true),
($hlp$crm$hlp$, $hlp$enviar-whatsapp-pela-ficha$hlp$, $hlp$Enviar WhatsApp pela ficha$hlp$, $hlp$Enviar uma mensagem de WhatsApp a partir da ficha do Contato ou do Lead.$hlp$, $hlp$# Enviar WhatsApp pela ficha
**Para que serve:** Falar com o cliente pelo WhatsApp sem sair da ficha do Contato ou do Lead.
**Quem pode fazer:** Quem tem uma permissão de ver (`techsales.inbox.whatsapp.view.own/team/workspace`) e uma de criar (`techsales.inbox.whatsapp.create.own/team/workspace`). Liberar número bloqueado exige `system.whatsapp_suppressions.manage.workspace`. O servidor confere tudo de novo no envio.
**Onde fica:** Ficha do Contato (`/contacts/$id`) ou do Lead (`/leads/$id`) > barra de ações da timeline > "Enviar WhatsApp". A ação também pode estar em "Mais".
**Antes de começar:** O cadastro precisa ter telefone. Sem telefone, a ação não abre.

## Passo a passo
1. Abra a ficha do Contato ou do Lead.
2. Na barra da timeline, clique em "Enviar WhatsApp". Não confunda com "Registrar WhatsApp", que só registra uma atividade.
3. Confira o campo "Para". Ele vem do cadastro e não pode ser editado aqui.
4. Dentro da janela de 24 horas, escreva em "Mensagem" ou escolha um item em "Template (opcional)". "Mensagem livre" envia sem modelo.
5. Fora da janela, escolha um "Modelo aprovado pela Meta" e preencha as variáveis.
6. Se quiser, anexe um arquivo em "Mídia (opcional)".
7. Clique em "Enviar".
<!-- screenshot: janela Enviar WhatsApp na ficha do contato -->

## Resultado esperado
A mensagem é enviada e aparece na conversa e na timeline do cadastro.

## Regras e limites
- A janela de 24 horas conta da última mensagem **recebida** do cliente.
- Fora da janela, ou se o cliente nunca escreveu, só é possível enviar modelo aprovado pela Meta.
- O servidor confere se o modelo está aprovado, no idioma certo, com variáveis e mídia obrigatória preenchidas.
- A ficha mostra "Bloqueios de WhatsApp" quando o número foi recusado:
  - "Número sem WhatsApp (recusado pela Meta)": bloqueio de 90 dias.
  - "Aguardando nova tentativa (limite de engajamento da Meta)": espera de 7 dias; se repetir, 30 dias.
- "Liberar número" pede confirmação ("Liberar número para WhatsApp?"). O número volta a receber campanhas e sequências. Se a Meta recusar de novo, ele é bloqueado outra vez. Liberar não garante a entrega.
- Modo somente leitura bloqueia o envio.

## Erros comuns
- "A janela de 24 horas terminou. Escolha um modelo aprovado pela Meta para continuar.": escolha um modelo aprovado.
- Modelo não aprovado ou variáveis incompletas: revise o modelo e preencha todas as variáveis.
- "Não foi possível verificar bloqueios de WhatsApp deste cadastro.": recarregue a ficha.

## Relacionados
- [Gerenciar campanhas de WhatsApp](/ajuda/crm)
- [Visão geral do TechSales](/ajuda/crm)$hlp$, $hlp$howto$hlp$, $hlp$/contacts/$id$hlp$, $hlp$techsales.inbox.whatsapp.view.own$hlp$, $hlp$internal$hlp$, 160, 1, true),
($hlp$crm$hlp$, $hlp$erros-comuns$hlp$, $hlp$Erros comuns e soluções no TechSales$hlp$, $hlp$Mensagens de erro reais do TechSales e o que fazer em cada caso.$hlp$, $hlp$# Erros comuns e soluções no TechSales

## Cadastros

| Mensagem | O que fazer |
|---|---|
| "Informe ao menos o nome" | Preencha o campo Nome. |
| "Email inválido" | Corrija o e-mail. |
| "Lead duplicado" / "Já existe um contato com esses dados (duplicado)." | Procure o registro existente antes de criar outro. |
| "CNPJ inválido." | Confira os 14 dígitos do CNPJ. |
| "Empresa selecionada não é mais válida. Selecione outra ou deixe em branco." | Escolha outra empresa. |
| "Limite de contatos do plano atingido. Faça upgrade para criar mais." | Fale com o administrador do plano. |

## Permissões e ações em massa

| Mensagem | O que fazer |
|---|---|
| "Você não tem permissão para excluir este registro." | Peça a ação a quem tem permissão. |
| "Nenhum registro foi alterado. Verifique suas permissões." | Revise os registros e seu acesso. |
| "Nenhum registro para exportar" / "Nada para exportar" | Ajuste filtros ou selecione registros. |
| "Falha ao selecionar todos" | Tente de novo. |
| "A mesma propriedade foi escolhida duas vezes." | Remova a propriedade repetida na edição em massa. |

## Vendas

| Mensagem | O que fazer |
|---|---|
| "Adicione itens de linha ao negócio para gerar uma cotação." | Cadastre os itens no negócio. |
| "A origem não tem itens de linha." | Confira a cotação ou o negócio de origem. |
| "Informe o título." | Preencha o título da proposta. |
| "Cotação não encontrada" / "Proposta não encontrada" | Confira o registro e seu acesso. |

## WhatsApp

| Mensagem | O que fazer |
|---|---|
| "A janela de 24 horas terminou. Escolha um modelo aprovado pela Meta para continuar." | Envie um modelo aprovado. |
| "Este modelo não está aprovado pela Meta. Escolha outro modelo aprovado." | Escolha um modelo `APPROVED`. |
| "Arquivo maior que 16MB (limite do WhatsApp)" | Reduza o arquivo. |
| "Sem permissão para enviar WhatsApp." | Peça a permissão de envio. |
| "Aguardando nova tentativa (limite de engajamento da Meta)" | Aguarde o prazo de espera. |
| "O público passa de 5.000 destinatários. Refine os filtros." | Reduza o público. |

## E-mail e calendário

| Mensagem | O que fazer |
|---|---|
| "Nenhuma conta Gmail conectada" / "Nenhuma conta própria autorizada para envio." | Conecte seu Gmail em Conexão de Email. |
| "Erro ao iniciar OAuth" | Libere novas abas e tente de novo. |
| "Falha na conexão" (calendário) | Refaça a autorização do Google. |

## Sequências e prospecção

| Mensagem | O que fazer |
|---|---|
| "Informe o nome da sequência." | Preencha o nome. |
| "Conecte sua conta de e-mail em Canais para usar passos de e-mail." | Conecte a conta. |
| "Salve o rascunho para criar versões." | Salve antes de versionar. |
| "Não foi possível preparar a inscrição. Nenhum envio foi iniciado." | Confira versão, permissões e evidência. |
| "Sem acesso à Fila de prospecção" | Peça a permissão. |
| "Nenhum questionário ativo." | Ative um questionário. |

## Relacionados

- [Perguntas frequentes](/ajuda/crm/perguntas-frequentes)
- [Permissões do TechSales](/ajuda/crm/permissoes)$hlp$, $hlp$troubleshooting$hlp$, NULL, NULL, $hlp$internal$hlp$, 5, 1, true),
($hlp$crm$hlp$, $hlp$excluir-contato$hlp$, $hlp$Excluir contato$hlp$, $hlp$Excluir contato.$hlp$, $hlp$# Excluir contato
**Para que serve:** Excluir contato.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A ficha exige `techsales.contacts.delete.workspace` ou `techsales.contacts.manage.workspace`; delete.own não habilita a exclusão nessa ficha. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Contatos (`/contacts/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra a ficha do registro.
2. Clique no ícone "Excluir contato".
3. Revise a confirmação e confirme a exclusão.
<!-- screenshot: Excluir contato: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem "Excluído" aparece e a navegação volta à listagem.
## Regras e limites
A ação depende da permissão sobre o registro. Não há restauração nesta ficha. Não confirme se precisar preservar o cadastro.
## Erros comuns
"Você não tem permissão para excluir este registro.": solicite ao administrador a revisão do acesso.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/contacts/$id$hlp$, NULL, $hlp$internal$hlp$, 113, 1, true),
($hlp$crm$hlp$, $hlp$excluir-contatos-em-massa$hlp$, $hlp$Excluir contatos em massa$hlp$, $hlp$Excluir contatos em massa.$hlp$, $hlp$# Excluir contatos em massa
**Para que serve:** Excluir contatos em massa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A ficha exige `techsales.contacts.delete.workspace` ou `techsales.contacts.manage.workspace`; delete.own não habilita a exclusão nessa ficha. A barra da lista usa as chaves delete.own e delete.workspace. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Contatos (`/contacts`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Marque os registros desejados na listagem.
2. Clique em "Excluir" na barra de seleção.
3. Revise a quantidade e confirme.
4. Confira se a mensagem informa exclusão completa ou parcial.
<!-- screenshot: Excluir contatos em massa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
Os registros autorizados são removidos e a listagem é atualizada.
## Regras e limites
A seleção não amplia suas permissões. Confira o total antes de confirmar. Uma operação pode remover apenas parte dos registros.
## Erros comuns
Se a mensagem indicar exclusão parcial, atualize a lista e peça revisão das permissões. "Você não tem permissão para excluir este registro.": solicite revisão de acesso.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/contacts$hlp$, NULL, $hlp$internal$hlp$, 114, 1, true),
($hlp$crm$hlp$, $hlp$excluir-empresa$hlp$, $hlp$Excluir empresa$hlp$, $hlp$Excluir empresa.$hlp$, $hlp$# Excluir empresa
**Para que serve:** Excluir empresa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A ficha aceita `techsales.companies.delete.workspace`, `techsales.companies.manage.workspace` ou `techsales.companies.delete.own` para registro próprio. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra a ficha do registro.
2. Clique no ícone "Excluir empresa".
3. Revise a confirmação e confirme a exclusão.
<!-- screenshot: Excluir empresa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem "Excluído" aparece e a navegação volta à listagem.
## Regras e limites
A ação depende da permissão sobre o registro. Não há restauração nesta ficha. Não confirme se precisar preservar o cadastro.
## Erros comuns
"Você não tem permissão para excluir este registro.": solicite ao administrador a revisão do acesso.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/companies/$id$hlp$, NULL, $hlp$internal$hlp$, 122, 1, true),
($hlp$crm$hlp$, $hlp$excluir-empresas-em-massa$hlp$, $hlp$Excluir empresas em massa$hlp$, $hlp$Excluir empresas em massa.$hlp$, $hlp$# Excluir empresas em massa
**Para que serve:** Excluir empresas em massa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A ficha aceita `techsales.companies.delete.workspace`, `techsales.companies.manage.workspace` ou `techsales.companies.delete.own` para registro próprio. A barra da lista usa as chaves delete.own e delete.workspace. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Marque os registros desejados na listagem.
2. Clique em "Excluir" na barra de seleção.
3. Revise a quantidade e confirme.
4. Confira se a mensagem informa exclusão completa ou parcial.
<!-- screenshot: Excluir empresas em massa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
Os registros autorizados são removidos e a listagem é atualizada.
## Regras e limites
A seleção não amplia suas permissões. Confira o total antes de confirmar. Uma operação pode remover apenas parte dos registros.
## Erros comuns
Se a mensagem indicar exclusão parcial, atualize a lista e peça revisão das permissões. "Você não tem permissão para excluir este registro.": solicite revisão de acesso.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/companies$hlp$, NULL, $hlp$internal$hlp$, 123, 1, true),
($hlp$crm$hlp$, $hlp$excluir-lead$hlp$, $hlp$Excluir lead$hlp$, $hlp$Excluir lead.$hlp$, $hlp$# Excluir lead
**Para que serve:** Excluir lead.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A ficha aceita `techsales.leads.delete.workspace`, `techsales.leads.manage.workspace`, `techsales.leads.delete.team` ou `techsales.leads.delete.own`, conforme o registro. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra a ficha do registro.
2. Clique no ícone "Excluir lead".
3. Revise a confirmação e confirme a exclusão.
<!-- screenshot: Excluir lead: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem "Excluído" aparece e a navegação volta à listagem.
## Regras e limites
A ação depende da permissão sobre o registro. Não há restauração nesta ficha. Não confirme se precisar preservar o cadastro.
## Erros comuns
"Você não tem permissão para excluir este registro.": solicite ao administrador a revisão do acesso.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/leads/$id$hlp$, NULL, $hlp$internal$hlp$, 104, 1, true),
($hlp$crm$hlp$, $hlp$excluir-leads-em-massa$hlp$, $hlp$Excluir leads em massa$hlp$, $hlp$Excluir leads em massa.$hlp$, $hlp$# Excluir leads em massa
**Para que serve:** Excluir leads em massa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A ficha aceita `techsales.leads.delete.workspace`, `techsales.leads.manage.workspace`, `techsales.leads.delete.team` ou `techsales.leads.delete.own`, conforme o registro. A barra da lista usa as chaves delete.own e delete.workspace. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Marque os registros desejados na listagem.
2. Clique em "Excluir" na barra de seleção.
3. Revise a quantidade e confirme.
4. Confira se a mensagem informa exclusão completa ou parcial.
<!-- screenshot: Excluir leads em massa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
Os registros autorizados são removidos e a listagem é atualizada.
## Regras e limites
A seleção não amplia suas permissões. Confira o total antes de confirmar. Uma operação pode remover apenas parte dos registros.
## Erros comuns
Se a mensagem indicar exclusão parcial, atualize a lista e peça revisão das permissões. "Você não tem permissão para excluir este registro.": solicite revisão de acesso.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/leads$hlp$, NULL, $hlp$internal$hlp$, 105, 1, true),
($hlp$crm$hlp$, $hlp$executar-fila-de-prospeccao$hlp$, $hlp$Executar uma fila de prospecção$hlp$, $hlp$Escolha um questionário e percorra os leads ou contatos de uma fila.$hlp$, $hlp$# Executar uma fila de prospecção
**Para que serve:** Trabalhar os registros de uma fila com um questionário comercial.
**Quem pode fazer:** Usuários com `techsales.prospecting_queue.view.workspace`. Gravar a qualificação depende da permissão da operação.
**Onde fica:** Menu > TechSales > Prospecção > Meu trabalho > Filas (`/prospecting/queues/$queueId/play`).
**Antes de começar:** Tenha uma fila com itens e um questionário ativo.

## Passo a passo
1. Abra a execução da fila.
2. Em "Escolha um questionário", use "Selecionar questionário".
3. Clique em "Começar".
4. Revise os dados, o histórico e o painel de qualificação.
5. Avance pelos itens. Fora dos campos, S, N ou seta para a direita avançam.
6. Ao terminar, clique em "Voltar para filas".
<!-- screenshot: escolha de questionário e item da fila -->

## Resultado esperado
Ao fim, a tela mostra "Fila concluída 🎉".

## Regras e limites
Carrega até 200 itens. Avançar só muda o item exibido; não salva respostas nem muda status.

## Erros comuns
- "Sem acesso à Fila de prospecção": peça a permissão ao administrador.
- "Nenhum questionário ativo.": crie ou ative um questionário.
- "Esta fila não possui itens.": revise a fila.

## Relacionados
- [Navegar na prospecção](/ajuda/crm/navegar-na-prospeccao)
- [Permissões](/ajuda/crm/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/prospecting/queues/$queueId/play$hlp$, $hlp$techsales.prospecting_search.view.workspace$hlp$, $hlp$internal$hlp$, 403, 1, true),
($hlp$crm$hlp$, $hlp$executar-fila-tarefas$hlp$, $hlp$Executar uma fila de tarefas$hlp$, $hlp$Tratar os itens da fila, registrar anotações e concluir ou pular cada atendimento.$hlp$, $hlp$# Executar uma fila de tarefas
**Para que serve:** Executar uma fila em sequência, sem abrir cada registro separadamente.
**Quem pode fazer:** Membros ativos com acesso à fila e autorização para atualizar seus itens. O banco aplica a permissão `techsales.task_queues`.
**Onde fica:** Menu > TechSales > Tarefas > Filas > Executar fila (`/tasks/queues/$queueId/play`).
**Antes de começar:** Crie uma fila e adicione itens.

## Passo a passo
1. Abra a execução da fila.
2. Confira o nome do registro e os dados de contato.
3. Clique em "Email" para preparar uma mensagem, quando houver e-mail.
4. Clique em "Ligar" para abrir o discador do dispositivo, quando houver telefone.
5. Registre o atendimento em "Anotações".
6. Clique em "Concluir (C)" para concluir o item ou em "Pular (S)" para pulá-lo.
7. Continue até aparecer "Fila concluída 🎉".
8. Clique em "Voltar para filas".
<!-- screenshot: item da fila com Email, Ligar, Anotações, Pular (S) e Concluir (C) -->

## Resultado esperado
A ação salva as anotações do item e avança para o próximo pendente. Ao terminar, aparece "Todos os itens foram tratados.".

## Regras e limites
- Itens concluídos ou pulados saem da lista de pendentes. "Pular (S)" não conclui o atendimento.
- Atalhos: C e S. Prefira os botões enquanto edita anotações.
- As anotações são gravadas ao concluir ou pular; não há salvamento automático ao sair.
- "Ligar" depende de um aplicativo de chamadas no dispositivo.

## Erros comuns
- Se uma ação falhar, leia a mensagem e tente novamente antes de sair.
- Se "Email" ou "Ligar" não aparecer, o registro não tem o dado correspondente.

## Relacionados
- [Criar filas de tarefas](/ajuda/crm/criar-filas-tarefas)
- [Organizar tarefas](/ajuda/crm/organizar-tarefas)$hlp$, $hlp$howto$hlp$, $hlp$/tasks/queues/$queueId/play$hlp$, NULL, $hlp$internal$hlp$, 208, 2, true),
($hlp$crm$hlp$, $hlp$exportar-contatos$hlp$, $hlp$Exportar contatos$hlp$, $hlp$Exportar contatos.$hlp$, $hlp$# Exportar contatos
**Para que serve:** Exportar contatos.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Exige `techsales.contacts.export.workspace`. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Contatos (`/contacts`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Ajuste os filtros e confira a página exibida.
2. Clique em "Exportar" e escolha o formato desejado.
3. Salve o arquivo gerado e confira seu conteúdo.
<!-- screenshot: Exportar contatos: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
Um arquivo é gerado com os registros carregados na página.
## Regras e limites
Não é uma exportação de todos os resultados do filtro. Os formatos disponíveis são CSV, JSON e XLSX. "Exportar selecionados" considera os selecionados presentes nas linhas carregadas; não conte com registros de outras páginas.
## Erros comuns
"Nenhum registro para exportar": ajuste os filtros para carregar resultados.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/contacts$hlp$, NULL, $hlp$internal$hlp$, 117, 1, true),
($hlp$crm$hlp$, $hlp$exportar-empresas$hlp$, $hlp$Exportar empresas$hlp$, $hlp$Exportar empresas.$hlp$, $hlp$# Exportar empresas
**Para que serve:** Exportar empresas.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Exige `techsales.companies.export.workspace`. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Ajuste os filtros e confira a página exibida.
2. Clique em "Exportar" e escolha o formato desejado.
3. Salve o arquivo gerado e confira seu conteúdo.
<!-- screenshot: Exportar empresas: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
Um arquivo é gerado com os registros carregados na página.
## Regras e limites
Não é uma exportação de todos os resultados do filtro. Os formatos disponíveis são CSV, JSON e XLSX. "Exportar selecionados" considera os selecionados presentes nas linhas carregadas; não conte com registros de outras páginas.
## Erros comuns
"Nenhum registro para exportar": ajuste os filtros para carregar resultados.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/companies$hlp$, NULL, $hlp$internal$hlp$, 126, 1, true),
($hlp$crm$hlp$, $hlp$exportar-leads$hlp$, $hlp$Exportar leads$hlp$, $hlp$Exportar leads.$hlp$, $hlp$# Exportar leads
**Para que serve:** Exportar leads.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Exige `techsales.leads.export.workspace`. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Ajuste os filtros e confira a página exibida.
2. Clique em "Exportar".
3. Salve o arquivo gerado e confira seu conteúdo.
<!-- screenshot: Exportar leads: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
Um arquivo é gerado com os registros carregados na página.
## Regras e limites
Não é uma exportação de todos os resultados do filtro. Leads usa CSV e colunas fixas; selecionar linhas não muda o conteúdo desta exportação.
## Erros comuns
"Nenhum registro para exportar": ajuste os filtros para carregar resultados.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/leads$hlp$, NULL, $hlp$internal$hlp$, 108, 1, true),
($hlp$crm$hlp$, $hlp$filtrar-contatos$hlp$, $hlp$Filtrar contatos$hlp$, $hlp$Filtrar contatos.$hlp$, $hlp$# Filtrar contatos
**Para que serve:** Filtrar contatos.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Os registros disponíveis respeitam suas permissões e o escopo de acesso. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Contatos (`/contacts`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Selecione uma aba da listagem, como "Sem responsável".
2. Use "Etapa do ciclo" e "Responsável".
3. Use a busca da listagem para restringir os resultados.
4. Revise os registros e ajuste a paginação.
<!-- screenshot: Filtrar contatos: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A lista mostra apenas os resultados que atendem aos critérios e ao seu acesso.
## Regras e limites
Filtros não alteram cadastros nem concedem acesso. Estas telas oferecem abas predefinidas; não foi identificada ação de salvar visualização nelas.
## Erros comuns
Se a lista ficar vazia, remova critérios e confira a aba ativa. Erros de consulta retornam a mensagem do serviço, sem mensagem fixa nesta ação.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/contacts$hlp$, NULL, $hlp$internal$hlp$, 118, 1, true),
($hlp$crm$hlp$, $hlp$filtrar-empresas$hlp$, $hlp$Filtrar empresas$hlp$, $hlp$Filtrar empresas.$hlp$, $hlp$# Filtrar empresas
**Para que serve:** Filtrar empresas.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Os registros disponíveis respeitam suas permissões e o escopo de acesso. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Selecione uma aba da listagem, como "Sem responsável".
2. Use "Setor" e os demais filtros disponíveis.
3. Use a busca da listagem para restringir os resultados.
4. Revise os registros e ajuste a paginação.
<!-- screenshot: Filtrar empresas: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A lista mostra apenas os resultados que atendem aos critérios e ao seu acesso.
## Regras e limites
Filtros não alteram cadastros nem concedem acesso. Estas telas oferecem abas predefinidas; não foi identificada ação de salvar visualização nelas.
## Erros comuns
Se a lista ficar vazia, remova critérios e confira a aba ativa. Erros de consulta retornam a mensagem do serviço, sem mensagem fixa nesta ação.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/companies$hlp$, NULL, $hlp$internal$hlp$, 127, 1, true),
($hlp$crm$hlp$, $hlp$filtrar-leads$hlp$, $hlp$Filtrar leads$hlp$, $hlp$Filtrar leads.$hlp$, $hlp$# Filtrar leads
**Para que serve:** Filtrar leads.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Os registros disponíveis respeitam suas permissões e o escopo de acesso. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Selecione uma aba da listagem, como "Sem responsável".
2. Use "Etapa do lead", "Responsável", "Origem", "Score" ou "Data de criação".
3. Use a busca da listagem para restringir os resultados.
4. Revise os registros e ajuste a paginação.
<!-- screenshot: Filtrar leads: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A lista mostra apenas os resultados que atendem aos critérios e ao seu acesso.
## Regras e limites
Filtros não alteram cadastros nem concedem acesso. Para reutilizar os critérios, use "Adicionar visualização".
## Erros comuns
Se a lista ficar vazia, remova critérios e confira a aba ativa. Erros de consulta retornam a mensagem do serviço, sem mensagem fixa nesta ação.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/leads$hlp$, NULL, $hlp$internal$hlp$, 109, 1, true),
($hlp$crm$hlp$, $hlp$gerenciar-base-de-conhecimento$hlp$, $hlp$Gerenciar a base de conhecimento$hlp$, $hlp$Organizar categorias e manter artigos públicos de atendimento.$hlp$, $hlp$# Gerenciar a base de conhecimento
**Para que serve:** Manter artigos públicos para autoatendimento do cliente.
**Quem pode fazer:** Gestor+ ou `system.kb.articles.view.workspace`/`.manage.workspace`. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Atender > Base de conhecimento (`/settings/kb`).
**Antes de começar:** Planeje as categorias. Não confunda com esta Ajuda interna.

## Passo a passo
1. Abra "Categorias" e clique em "Nova".
2. Na janela "Nova categoria", preencha e clique em "Salvar".
3. Abra "Artigos" e crie um artigo. A janela se chama "Novo artigo".
4. Preencha conteúdo, categoria e publicação e clique em "Salvar".
5. Para revisar, use o lápis.
6. Para remover, use a lixeira.
<!-- screenshot: abas Artigos e Categorias -->

## Resultado esperado
Categorias e artigos ficam disponíveis na base.

## Regras e limites
- Conteúdo público: não publique informação interna ou dados pessoais.
- Remover uma categoria pede confirmação ("Remover?"). Os artigos dela continuam, sem categoria.

## Erros comuns
Falhas de salvamento mostram a mensagem do servidor.

## Relacionados
- [Habilitar o portal do cliente](/ajuda/crm/habilitar-portal-do-cliente)
- [Gerenciar macros](/ajuda/crm/gerenciar-macros)$hlp$, $hlp$howto$hlp$, $hlp$/settings/kb$hlp$, $hlp$system.kb.articles.view.workspace$hlp$, $hlp$internal$hlp$, 512, 2, true),
($hlp$crm$hlp$, $hlp$gerenciar-cotacoes$hlp$, $hlp$Gerenciar cotações e gerar propostas$hlp$, $hlp$Consultar cotações e transformar os dados comerciais em proposta ou contrato.$hlp$, $hlp$# Gerenciar cotações e gerar propostas
**Para que serve:** Acompanhar cotações e reaproveitar seus dados para preparar propostas e contratos.
**Quem pode fazer:** Membros ativos com TechSales licenciado e acesso aos registros. Compartilhar exige `techsales.quote_share`; excluir exige exclusão em `techsales.quotes`. Gerar contrato exige `techcontracts.contracts.create.own` ou `techcontracts.contracts.create.workspace`.
**Onde fica:** Menu > TechSales > Cotações (`/settings/quotes`).
**Antes de começar:** Crie uma cotação na área "Cotações" de um negócio com itens de linha.

## Passo a passo
1. Consulte "Total emitidas", "Aceitas" e "Valor aceito".
2. Localize a cotação pelo título ou número e confira status, valor e visualizações.
3. Clique em "Gerar proposta" para abrir o assistente de proposta.
4. Revise "Título *", "Responsável" e "Validade".
5. Confira os itens e ajuste "Valor total da proposta", se necessário.
6. Revise o modelo e o conteúdo nas etapas seguintes. Clique em "Criar proposta".
7. Abra a proposta criada para revisar, solicitar aprovação, compartilhar ou enviar.
8. Para gerar um contrato direto da cotação, use a ação de geração de contrato. A mesma ação existe no detalhe da proposta.
9. Para compartilhar a cotação, use os ícones de abrir ou copiar o link.
10. Para excluir, clique no ícone de lixeira e confirme "Excluir esta cotação?".
<!-- screenshot: cotação na lista com Gerar proposta, geração de contrato e ícones de compartilhamento -->

## Resultado esperado
A proposta reaproveita os vínculos e dados comerciais da cotação. O contrato é criado ou o registro já existente é reutilizado.

## Regras e limites
- O fluxo permite Cotação → Proposta → Contrato e também Cotação → Contrato.
- A proposta reaproveita empresa, contato, negócio, moeda, valor, validade e responsável, salvo ajustes feitos no assistente.
- Se já existir proposta para a cotação, ela é reutilizada. O contrato também evita duplicação para a mesma origem.
- A escolha automática do modelo de contrato considera os serviços do catálogo, priorizando modelos publicados e padrão elegíveis.
- O assistente de proposta não altera os itens da cotação.
- No negócio, o menu "Ações" da cotação oferece "Copiar link" e "Baixar PDF" fora do status de rascunho. A lista geral não tem botão próprio de PDF.
- Status: "Rascunho", "Publicada", "Enviada", "Aceita", "Recusada" e "Expirada".
- "Valor aceito" soma as cotações aceitas e é exibido em BRL; confira a moeda de cada cotação.

## Erros comuns
- "Nenhuma cotação. Crie a partir da aba "Cotações" em um negócio.": abra o negócio e crie a cotação.
- "Cotação não encontrada": confira a origem e seu acesso.
- "Proposta não encontrada": confira a proposta usada como origem do contrato.
- "Informe o título.": preencha o título no assistente.
- "Não foi possível carregar os dados.": clique em "Tentar novamente".

## Relacionados
- [Atualizar um negócio](/ajuda/crm/atualizar-negocio)
- [Editar e enviar uma proposta](/ajuda/crm/editar-enviar-proposta)$hlp$, $hlp$howto$hlp$, $hlp$/settings/quotes$hlp$, NULL, $hlp$internal$hlp$, 204, 1, true),
($hlp$crm$hlp$, $hlp$gerenciar-faturas$hlp$, $hlp$Gerenciar faturas$hlp$, $hlp$Consultar cobranças, criar faturas e registrar pagamentos.$hlp$, $hlp$# Gerenciar faturas
**Para que serve:** Consultar faturas e executar ações de cobrança.
**Quem pode fazer:** Menu visível a membros com TechSales; as ações usam `techfinance.invoices` (criar: `techfinance.invoices.create.own` ou `.create.workspace`).
**Onde fica:** Menu > TechSales > Vender > Faturas (`/invoices`).
**Antes de começar:** Tenha valor e vencimento. Pix, boleto e NFS-e dependem das integrações.

## Passo a passo
1. Use "Buscar por número ou descrição".
2. Escolha o status ou "Todos os status".
3. Clique em "Nova fatura".
4. Preencha "Descrição", "Valor (BRL)" e "Vencimento".
5. Clique em "Criar fatura".
6. Para pagamento manual, use "Marcar como paga".
7. Para excluir, use a lixeira e confirme "Excluir fatura?".
8. O botão "NFS-e" fica desabilitado enquanto o adaptador de NFS-e não estiver habilitado ("Adaptador NFS-e não habilitado"). Quando habilitado, a emissão mostra "Emissão de NFS-e iniciada".
<!-- screenshot: filtros e formulário Nova fatura -->

## Resultado esperado
"Fatura criada" ou "Marcada como paga".

## Regras e limites
- "Criar fatura" fica desabilitado sem valor ou vencimento.
- Status: "Rascunho", "Em aberto", "Pagas", "Vencidas", "Canceladas" e "Reembolsadas".
- "Emissão de NFS-e iniciada" não significa nota emitida.

## Erros comuns
- "Adaptador Pix não habilitado", "Adaptador boleto não habilitado", "Adaptador NFS-e não habilitado": peça ao administrador para configurar a integração.
- "Falha ao emitir NFS-e": leia a mensagem e revise a configuração.

## Relacionados
- [Permissões](/ajuda/crm/permissoes)
- [Erros comuns](/ajuda/crm/erros-comuns)$hlp$, $hlp$howto$hlp$, $hlp$/invoices$hlp$, NULL, $hlp$internal$hlp$, 515, 2, true),
($hlp$crm$hlp$, $hlp$gerenciar-formularios-publicos$hlp$, $hlp$Gerenciar formulários públicos$hlp$, $hlp$Configurar formulários cujos envios geram leads ou contatos.$hlp$, $hlp$# Gerenciar formulários públicos
**Para que serve:** Criar formulários públicos para captar leads ou contatos.
**Quem pode fazer:** Gestor+ ou `techsales.marketing.forms.view.workspace`/`.manage.workspace`. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Captar > Formulários (`/forms`).
**Antes de começar:** Defina se os envios geram leads ou contatos.

## Passo a passo
1. Clique em "Novo formulário".
2. Preencha "Nome", "Slug (URL pública)" e "Cria como".
3. Configure os campos e marque os obrigatórios.
4. Ajuste mensagem de sucesso e redirecionamento.
5. Configure a apresentação e a distribuição das inscrições: dono do formulário (padrão), membro específico ou rodízio.
6. Salve.
7. Para alterar, abra a edição e salve de novo.
8. Para ver envios, use a ação de visualização.
9. Para excluir, use a lixeira e confirme.
<!-- screenshot: edição do formulário com campos e distribuição -->

## Resultado esperado
"Formulário salvo". Cada envio gera lead ou contato, e o responsável é avisado.

## Regras e limites
- Tipos de campo: texto, e-mail, telefone, texto longo, seleção e número.
- Campos iniciais: "Nome", "Email", "Telefone" e "Mensagem"; "Nome" e "Email" começam obrigatórios.
- Em "Modo", escolha "Inline", "Pop-up" ou "Slide-in". Pop-up e slide-in usam "Gatilho", "Atraso (s)" ou "Scroll (%)".
- Registros existentes mantêm o responsável. Membros inativos não entram no rodízio; sem membros disponíveis, vale o dono.

## Erros comuns
A tela mostra a mensagem devolvida pelo servidor quando salvar ou excluir falha.

## Relacionados
- [Criar landing pages](/ajuda/crm/criar-landing-pages)
- [Gerenciar pesquisas](/ajuda/crm/gerenciar-pesquisas)$hlp$, $hlp$howto$hlp$, $hlp$/forms$hlp$, $hlp$techsales.marketing.forms.view.workspace$hlp$, $hlp$internal$hlp$, 504, 2, true),
($hlp$crm$hlp$, $hlp$gerenciar-macros$hlp$, $hlp$Gerenciar macros$hlp$, $hlp$Criar e manter textos reutilizáveis para atendimento.$hlp$, $hlp$# Gerenciar macros
**Para que serve:** Manter textos reutilizáveis com atalho e personalização.
**Quem pode fazer:** Gestor+ ou `system.automation.macros.view.workspace`/`.manage.workspace`. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Otimizar > Macros (`/settings/macros`).
**Antes de começar:** Prepare o texto.

## Passo a passo
1. Abra a criação de macro. A janela se chama "Nova macro".
2. Preencha "Nome *".
3. Informe "Atalho" e "Categoria", se quiser.
4. Preencha "Corpo *".
5. Use os campos de personalização.
6. Ajuste "Ativa" e salve.
7. Para alterar, abra a edição e salve.
8. Para excluir, use a lixeira e confirme "Excluir esta macro?".
<!-- screenshot: edição de macro -->

## Resultado esperado
"Macro criada." ou "Macro atualizada.".

## Regras e limites
- Nome e corpo obrigatórios.
- Exemplo de atalho: "ola-cliente".
- Personalização como "{{contact_first_name}}".

## Erros comuns
- "Informe nome e corpo.": preencha os dois.

## Relacionados
- [Acompanhar um ticket](/ajuda/crm/acompanhar-ticket)$hlp$, $hlp$howto$hlp$, $hlp$/settings/macros$hlp$, $hlp$system.automation.macros.view.workspace$hlp$, $hlp$internal$hlp$, 513, 2, true),
($hlp$crm$hlp$, $hlp$gerenciar-paineis$hlp$, $hlp$Gerenciar painéis de relatórios$hlp$, $hlp$Criar painéis e organizar widgets baseados em relatórios salvos.$hlp$, $hlp$# Gerenciar painéis de relatórios
**Para que serve:** Reunir relatórios salvos em painéis.
**Quem pode fazer:** Gestor+ ou `system.analytics.dashboards.view.workspace`/`.manage.workspace`. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Otimizar > Dashboards (`/dashboards`).
**Antes de começar:** Salve os relatórios que deseja exibir.

## Passo a passo
1. Clique em "Novo painel".
2. Preencha "Nome" e, se quiser, "Descrição".
3. Clique em "Criar".
4. Selecione o painel em "Painéis".
5. Clique em "Widget" e preencha a janela "Novo widget".
6. Preencha "Título" e escolha "Relatório".
7. Ajuste "Largura (colunas de 12)" e clique em "Salvar".
8. Para alterar o painel, use o lápis e "Salvar".
9. Para favoritar, clique na estrela.
10. Para excluir, use a lixeira e confirme.
<!-- screenshot: painel selecionado e formulário de widget -->

## Resultado esperado
O painel aparece na lista e o widget mostra o relatório.

## Regras e limites
- Widget exige relatório salvo.
- Larguras: 3, 4, 6, 8 e 12 colunas.
- Remover widget pede "Remover este widget?".

## Erros comuns
- "Informe um nome": preencha o nome do painel.
- "Informe um título": preencha o título do widget.
- "Selecione um relatório": escolha um relatório.

## Relacionados
- [Criar relatórios personalizados](/ajuda/crm/criar-relatorios-personalizados)$hlp$, $hlp$howto$hlp$, $hlp$/dashboards$hlp$, $hlp$system.analytics.dashboards.view.workspace$hlp$, $hlp$internal$hlp$, 501, 2, true),
($hlp$crm$hlp$, $hlp$gerenciar-pesquisas$hlp$, $hlp$Gerenciar pesquisas$hlp$, $hlp$Consultar modelos e respostas de pesquisas e abrir o construtor.$hlp$, $hlp$# Gerenciar pesquisas
**Para que serve:** Reunir pesquisas de satisfação, questionários de vendas e formulários livres.
**Quem pode fazer:** Membros ativos com TechSales licenciado.
**Onde fica:** Menu > TechSales > Captar > Pesquisas (`/surveys`).
**Antes de começar:** Para enviar a um atendimento, tenha um ticket.

## Passo a passo
1. Escolha "CSAT", "NPS", "Vendas" ou "Livre".
2. Em "CSAT" e "NPS", veja "Respostas recebidas", "Convites" e "Respondidas".
3. Clique em "Enviar para um ticket" para convidar.
4. Copie o link da pesquisa.
5. Clique em "Nova no construtor" para criar no editor.
6. Ou clique em "Nova pesquisa".
7. Para importar, clique em "Importar pesquisa com IA". Envie um "Arquivo da pesquisa" ou informe o "Endereço da página", revise o "Título" e confirme.
<!-- screenshot: abas de pesquisas e indicadores -->

## Resultado esperado
Mostra modelos e resultados. "Nova no construtor" abre o editor.

## Regras e limites
- Carrega até 500 respostas, das mais recentes.
- Sem nota, a resposta não entra na média.
- NPS: 9–10 promotores; até 6 detratores.

## Erros comuns
- Falha no construtor mostra a mensagem do servidor.
- "Link copiado." confirma a cópia.

## Relacionados
- [Construir pesquisas](/ajuda/crm/construir-pesquisas)
- [Consultar e organizar tickets](/ajuda/crm/consultar-organizar-tickets)$hlp$, $hlp$howto$hlp$, $hlp$/surveys$hlp$, NULL, $hlp$internal$hlp$, 507, 2, true),
($hlp$crm$hlp$, $hlp$gerenciar-propostas$hlp$, $hlp$Gerenciar propostas$hlp$, $hlp$Criar propostas e consultar os registros por responsável, status e valor.$hlp$, $hlp$# Gerenciar propostas
**Para que serve:** Cadastrar uma proposta e acompanhar a carteira comercial.
**Quem pode fazer:** Membros ativos com TechSales licenciado. As ações dependem das permissões de `techsales.proposals` e do acesso a cada registro.
**Onde fica:** Menu > TechSales > Propostas (`/proposals`).
**Antes de começar:** Para criar, tenha permissão de criação de propostas.

## Passo a passo
1. Clique em "Nova proposta".
2. Preencha "Título".
3. Se necessário, informe "Valor (BRL)".
4. Clique em "Criar".
5. Na área "Suas propostas", filtre por responsável e pelos campos "Status", "Valor (R$)", "Versão" ou "Empresa".
6. Alterne entre tabela e quadro para acompanhar os registros.
7. Abra uma proposta para editar seu conteúdo e preparar o envio.
8. Para ações em massa, selecione os registros e use apenas as ações liberadas para toda a seleção.
<!-- screenshot: Nova proposta com Título e Valor (BRL), seguida da lista com filtros -->

## Resultado esperado
A mensagem "Proposta criada" confirma o cadastro. A proposta fica disponível na carteira.

## Regras e limites
- O título é necessário para habilitar "Criar".
- O valor pode ficar sem preenchimento.
- Os status exibidos são "Rascunho", "Em revisão", "Aprovada", "Enviada", "Aceita", "Recusada", "Expirada" e "Cancelada".
- As ações em massa dependem das permissões dos registros selecionados.

## Erros comuns
- Se "Criar" estiver desabilitado, preencha "Título" e aguarde o processamento.
- Se uma ação em massa não estiver disponível, revise a seleção e as permissões.
- Falhas de criação ou exclusão mostram a mensagem devolvida pelo servidor.

## Relacionados
- [Editar e enviar uma proposta](/ajuda/crm/editar-enviar-proposta)
- [Gerenciar cotações e gerar propostas](/ajuda/crm/gerenciar-cotacoes)$hlp$, $hlp$howto$hlp$, $hlp$/proposals$hlp$, NULL, $hlp$internal$hlp$, 202, 2, true),
($hlp$crm$hlp$, $hlp$gerenciar-sequencias-automaticas$hlp$, $hlp$Gerenciar sequências automáticas$hlp$, $hlp$Configure cadências automáticas de tarefas e e-mails e acompanhe inscrições.$hlp$, $hlp$# Gerenciar sequências automáticas
**Para que serve:** Administrar sequências de tarefas e e-mails.
**Quem pode fazer:** Gestor+ ou `system.automation.sequences.view.workspace`/`.manage.workspace`. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Otimizar > Sequências (`/settings/sequences`).
**Antes de começar:** Não confunda com "Sequências de prospecção" (`/prospecting/sequences`).

## Passo a passo
1. Na aba "Sequências", clique em "Nova sequência".
2. Configure no editor e salve.
3. Para alterar, use o ícone de lápis.
4. Use o interruptor para ativar ou desativar.
5. Para excluir, clique na lixeira e confirme "Excluir esta sequência?".
6. Abra "Inscrições" para ver os inscritos.
7. Pause, retome ou remova inscrições pelos controles da linha.
8. Clique em "Rodar agora" para processar.
<!-- screenshot: lista de sequências, interruptor e aba Inscrições -->

## Resultado esperado
"Sequência salva". "Rodar agora" mostra quantas inscrições foram processadas.

## Regras e limites
A lista de inscrições mostra até 50. Esta tela não usa versões imutáveis.

## Erros comuns
"Nenhuma sequência ainda. Crie uma para começar." indica lista vazia. "Erro" sem detalhe: confira dados e permissões.

## Relacionados
- [Criar o fluxo de uma sequência multicanal](/ajuda/crm/criar-fluxo-de-sequencia)
- [Permissões](/ajuda/crm/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/settings/sequences$hlp$, $hlp$system.automation.sequences.view.workspace$hlp$, $hlp$internal$hlp$, 411, 1, true),
($hlp$crm$hlp$, $hlp$habilitar-portal-do-cliente$hlp$, $hlp$Habilitar o portal do cliente$hlp$, $hlp$Ativar o portal por contato e copiar seu link individual.$hlp$, $hlp$# Habilitar o portal do cliente
**Para que serve:** Liberar um link individual para o cliente acompanhar e abrir solicitações.
**Quem pode fazer:** Admin/dono ou `system.portal.view.workspace`/`system.portal.update.workspace`. Alterar exige update.
**Onde fica:** Menu > TechSales > Vender > Portal do cliente (`/settings/portal`).
**Antes de começar:** Cadastre o contato.

## Passo a passo
1. Busque em "Buscar contato…".
2. Na coluna "Ativo", ligue o acesso.
3. Em "Link público", clique em "Copiar".
4. Envie o link só ao cliente correspondente.
5. Para trocar o endereço, use "Gerar novo token".
6. Para desabilitar, desligue "Ativo".
<!-- screenshot: contato com acesso ativo e ações do link -->

## Resultado esperado
"Link copiado!". Regerar mostra "Token regenerado.".

## Regras e limites
- Busca por nome e e-mail.
- Comandos de link aparecem com o contato ativo.
- O link é uma credencial de acesso: não divulgue.

## Erros comuns
- "Nenhum contato.": ajuste a busca.
- "Erro.": confira o estado do contato e repita.

## Relacionados
- [Consultar e organizar tickets](/ajuda/crm/consultar-organizar-tickets)$hlp$, $hlp$howto$hlp$, $hlp$/settings/portal$hlp$, $hlp$system.portal.view.workspace$hlp$, $hlp$internal$hlp$, 509, 1, true),
($hlp$crm$hlp$, $hlp$iniciar-pausar-sequencia$hlp$, $hlp$Iniciar e pausar execuções de sequência$hlp$, $hlp$Confirme o início de uma inscrição e acompanhe as execuções da versão.$hlp$, $hlp$# Iniciar e pausar execuções de sequência
**Para que serve:** Iniciar os contatos reservados e acompanhar a execução.
**Quem pode fazer:** Quem vê sequências (`system.automation.sequences.view`) e pode gerenciá-las (`system.automation.sequences.manage`) para o responsável da execução. Retomar também exige poder atribuir (`system.automation.sequences.assign`). O servidor confere essas regras.
**Onde fica:** Menu > TechSales > Sequências de prospecção (`/prospecting/sequences`).
**Antes de começar:** Crie uma versão e reserve o público.

## Passo a passo
1. Localize "Execução e acompanhamento".
2. Confira a inscrição e os contatos reservados.
3. Clique em "Iniciar inscrição selecionada".
4. Leia o aviso e clique em "Confirmar início".
5. Clique em "Atualizar" para ver as execuções.
6. Para pausar, clique em "Pausar" (execuções ativas ou aguardando tarefa). Para retomar, clique em "Retomar" (execuções pausadas). Em execuções bloqueadas use "Revalidar e tentar novamente"; em incertas, "Conferir recibo existente".
7. Para cancelar, clique em "Cancelar inscrição e liberar reservas seguras".
8. Clique em "Confirmar cancelamento da inscrição".
<!-- screenshot: confirmação de início e acompanhamento das execuções -->

## Resultado esperado
Os contatos seguem as etapas conforme horários e limites da versão.

## Regras e limites
O envio só é confirmado após retorno do provedor. Chamadas humanas aguardam a atividade; automáticas aguardam o resultado da telefonia. Cancelar libera reservas sem envio pendente; envios aceitos ficam no histórico.

## Erros comuns
"Não foi possível carregar as execuções. Atualize para tentar novamente.": clique em "Atualizar".

## Relacionados
- [Reservar o público de uma sequência](/ajuda/crm/reservar-publico-de-sequencia)
- [Configurar canais e planejamento de uma sequência](/ajuda/crm/configurar-canais-planejamento-de-sequencia)$hlp$, $hlp$howto$hlp$, $hlp$/prospecting/sequences$hlp$, $hlp$system.automation.sequences.view.workspace$hlp$, $hlp$internal$hlp$, 408, 2, true),
($hlp$crm$hlp$, $hlp$manter-modelos-de-cotacao$hlp$, $hlp$Manter modelos de cotação$hlp$, $hlp$Manter modelos de cotação.$hlp$, $hlp$# Manter modelos de cotação

**Para que serve:** Manter modelos de cotação, no contexto da tela `/settings/quote-templates`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.quote_templates`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/quote-templates`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/quote-templates.
2. Abra o modelo no editor apresentado.
3. Revise o conteúdo e avalie Converter para editor visual quando a ação estiver disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Modelos de cotação não são modelos de proposta nem de contrato; a conversão de editor exige revisão do resultado.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/quote-templates com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/quote-templates$hlp$, NULL, $hlp$internal$hlp$, 159, 1, true),
($hlp$crm$hlp$, $hlp$manter-modelos-de-proposta-comercial$hlp$, $hlp$Manter modelos de proposta comercial$hlp$, $hlp$Manter modelos de proposta comercial.$hlp$, $hlp$# Manter modelos de proposta comercial

**Para que serve:** Manter modelos de proposta comercial, no contexto da tela `/settings/proposal-templates`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.proposal_templates`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/proposal-templates`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/proposal-templates.
2. Revise Nome, Descrição e Conteúdo no editor.
3. Confira o documento antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Modelos de proposta são próprios e podem se vincular ao catálogo de serviços; não são cláusulas de contrato. Edição do documento final da proposta ocorre pelo ProposalWizard.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/proposal-templates com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/proposal-templates$hlp$, NULL, $hlp$internal$hlp$, 158, 1, true),
($hlp$crm$hlp$, $hlp$manter-origens-de-leads$hlp$, $hlp$Manter origens de leads$hlp$, $hlp$Manter origens de leads.$hlp$, $hlp$# Manter origens de leads

**Para que serve:** Manter origens de leads, no contexto da tela `/settings/lead-sources`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.lead_sources`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/lead-sources`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/lead-sources.
2. Revise Nome (valor) e Rótulo em português no cadastro.
3. Salve a origem pelo formulário disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso techsales.lead_sources; pertence ao TechSales.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/lead-sources com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/lead-sources$hlp$, NULL, $hlp$internal$hlp$, 137, 1, true),
($hlp$crm$hlp$, $hlp$manter-templates-de-e-mail$hlp$, $hlp$Manter templates de e-mail$hlp$, $hlp$Manter templates de e-mail.$hlp$, $hlp$# Manter templates de e-mail

**Para que serve:** Manter templates de e-mail, no contexto da tela `/settings/email-templates`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.automation.email_templates`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/email-templates`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Templates de email nas configurações.
2. Consulte os modelos e abra a criação ou edição disponível.
3. Revise o conteúdo antes de salvar ou excluir um modelo.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Usa system.automation.email_templates. Um modelo salvo não configura a conexão de e-mail nem garante envio.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/email-templates com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/email-templates$hlp$, NULL, $hlp$internal$hlp$, 122, 1, true),
($hlp$crm$hlp$, $hlp$navegar-na-prospeccao$hlp$, $hlp$Navegar na prospecção$hlp$, $hlp$Localize o trabalho diário, as campanhas, os públicos e os resultados da prospecção.$hlp$, $hlp$# Navegar na prospecção
**Para que serve:** Reunir as áreas de prospecção e abrir as ferramentas liberadas para você.
**Quem pode fazer:** Usuários liberados pelo menu Prospecção. Cada seção exige sua própria permissão, como `techsales.prospecting_queue.view.workspace`, `techsales.prospecting_scripts.view.workspace` ou `techsales.prospecting_search.view.workspace`.
**Onde fica:** Menu > TechSales > Prospecção (`/prospecting`).
**Antes de começar:** Entre no workspace em que pretende trabalhar.

## Passo a passo
1. Abra "Visão geral" para ver pendências, respostas, qualificados, reuniões e falhas.
2. Abra "Meu trabalho" para acessar as seções operacionais.
3. Abra "Campanhas" para as ferramentas de abordagem.
4. Abra "Públicos" para "Base interna", "Busca de prospects (Apollo)" e "Enriquecimento", quando liberados.
5. Abra "Resultados" para acompanhar por campanha, canal e agente.
<!-- screenshot: navegação principal da Prospecção e seções disponíveis -->

## Resultado esperado
Você encontra a área desejada. Links antigos com o parâmetro tab são convertidos para a navegação atual.

## Regras e limites
As seções aparecem conforme as permissões. Ter o menu não libera todas as ferramentas.

## Erros comuns
Se uma seção não aparecer, peça a permissão correspondente ao administrador.

## Relacionados
- [Executar uma fila de prospecção](/ajuda/crm/executar-fila-de-prospeccao)
- [Criar e editar roteiros de ligação](/ajuda/crm/criar-editar-roteiros-de-ligacao)
- [Criar o fluxo de uma sequência multicanal](/ajuda/crm/criar-fluxo-de-sequencia)$hlp$, $hlp$howto$hlp$, $hlp$/prospecting$hlp$, $hlp$techsales.prospecting_search.view.workspace$hlp$, $hlp$internal$hlp$, 400, 1, true),
($hlp$crm$hlp$, $hlp$organizar-lista-comunicacoes$hlp$, $hlp$Organizar a lista de comunicações$hlp$, $hlp$Filtrar, salvar visualizações e agir sobre registros selecionados.$hlp$, $hlp$# Organizar a lista de comunicações
**Para que serve:** Encontrar registros e reutilizar a organização da grade.
**Quem pode fazer:** Membros ativos. Alterar e excluir dependem da permissão sobre atividades.
**Onde fica:** Menu > TechSales > Relacionar > Comunicações (`/communications`).
**Antes de começar:** Tenha comunicações cadastradas.

## Passo a passo
1. Busque por assunto ou conteúdo.
2. Use o filtro "Tipo".
3. Ajuste ordenação e colunas.
4. Clique em "Adicionar visualização".
5. Clique no nome da visualização para reutilizar.
6. Marque registros.
7. Use "Editar em massa" ou "Excluir".
8. Use "Exportar selecionados".
<!-- screenshot: grade com filtro Tipo e barra de seleção -->

## Resultado esperado
A grade mostra o recorte escolhido.

## Regras e limites
- Sem importação nesta tela.
- Ações em massa respeitam o acesso a cada registro.

## Erros comuns
- "Nada para exportar": selecione registros.
- "Falha ao selecionar todos": tente de novo.

## Relacionados
- [Registrar e editar comunicações](/ajuda/crm/registrar-comunicacoes)
- [Permissões](/ajuda/crm/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/communications$hlp$, NULL, $hlp$internal$hlp$, 307, 1, true),
($hlp$crm$hlp$, $hlp$organizar-tarefas$hlp$, $hlp$Organizar tarefas$hlp$, $hlp$Localizar tarefas, salvar visualizações e executar ações individuais ou em massa.$hlp$, $hlp$# Organizar tarefas
**Para que serve:** Organizar o trabalho por status, prioridade e vencimento.
**Quem pode fazer:** Membros ativos com TechSales licenciado e permissões de `techsales.tasks` adequadas à ação e aos registros.
**Onde fica:** Menu > TechSales > Tarefas (`/tasks`).
**Antes de começar:** Confira quais tarefas estão no seu escopo de acesso.

## Passo a passo
1. Abra "Tarefas".
2. Use a busca "Buscar assunto, descrição…".
3. Ajuste os grupos "Status", "Priority" e "Due date".
4. Para cadastrar uma atividade, clique em "Criar tarefa" e preencha a janela.
5. Para reutilizar uma combinação de filtros, abra o menu de visões e clique em "Salvar como nova visão…". Em "Salvar visão", preencha "Nome", marque "Compartilhar com o workspace" se quiser e clique em "Salvar". A visão guarda filtros, busca e ordenação.
6. Selecione tarefas para executar as ações em massa disponíveis.
7. Use o botão de exportação e escolha "Exportar CSV" ou "Exportar Excel (XLSX)". São exportadas as tarefas exibidas no resultado atual. Sem registros, aparece "Nenhum registro para exportar".
8. Clique em "Queues" para organizar uma fila.
<!-- screenshot: Tarefas com busca, filtros, visualizações e seleção de registros -->

## Resultado esperado
A lista apresenta as tarefas filtradas. Uma visualização salva mostra "Visualização salva". Concluir ou reabrir uma tarefa mostra "Concluída" ou "Reaberta".

## Regras e limites
- Ações em massa podem ter resultado parcial por causa das permissões. Confira o resultado antes de repetir.
- Excluir uma tarefa e concluir uma tarefa são ações diferentes.
- As permissões valem na tela, no servidor e no banco.

## Erros comuns
- "Nenhum registro para exportar": ajuste os filtros para obter resultados.
- "Falha ao selecionar todos": tente novamente e confira seu acesso.
- "Erro ao salvar": tente salvar a visualização novamente.
- "Verifique suas permissões.": revise os registros que não foram alterados.

## Relacionados
- [Concluir e atribuir uma tarefa](/ajuda/crm/concluir-atribuir-tarefa)
- [Criar filas de tarefas](/ajuda/crm/criar-filas-tarefas)$hlp$, $hlp$howto$hlp$, $hlp$/tasks$hlp$, NULL, $hlp$internal$hlp$, 205, 2, true),
($hlp$crm$hlp$, $hlp$perguntas-frequentes$hlp$, $hlp$Perguntas frequentes do TechSales$hlp$, $hlp$Dúvidas comuns sobre o uso do TechSales.$hlp$, $hlp$# Perguntas frequentes do TechSales

## Por que não vejo um item do menu?
O item depende do seu cargo e das suas permissões. Peça ao administrador para revisar em Configurações › Permissões.

## Por que não vejo todos os registros?
Você vê os registros do seu escopo: seus, do seu time ou de todo o workspace, conforme o cargo.

## Por que um campo aparece com "•••"?
O administrador definiu esse campo como mascarado para o seu cargo.

## Posso mandar WhatsApp livre para qualquer contato?
Não. Texto livre só até 24 horas depois da última mensagem do cliente. Fora disso, use um modelo aprovado pela Meta.

## Por que um número foi pulado na campanha?
Ele pode estar bloqueado (sem WhatsApp, por 90 dias) ou em espera por limite de engajamento da Meta (7 ou 30 dias). A liberação manual fica na ficha do contato ou lead.

## Reservar público já envia mensagens?
Não. Reservar só separa os contatos. O envio começa ao clicar em "Iniciar inscrição selecionada".

## Qual a diferença entre "Sequências de prospecção" e "Sequências"?
"Sequências de prospecção" são multicanais (e-mail, WhatsApp, ligação) com versões imutáveis. "Sequências", em Otimizar, são cadências de tarefas e e-mails.

## A proposta pode ser criada a partir da cotação?
Sim. Em Cotações, clique em "Gerar proposta". A proposta guarda a origem e reaproveita os dados.

## Excluí um registro e ele continua lá. Por quê?
Você pode não ter permissão de exclusão. O sistema avisa quando a exclusão é recusada.

## O agente de IA precisa de aprovação para enviar?
Não. Cada mensagem é auditada antes do envio e refeita se violar alguma regra. Se não for possível, a conversa vai para um humano.

## Relacionados

- [Erros comuns](/ajuda/crm/erros-comuns)
- [Visão geral do TechSales](/ajuda/crm/visao-geral)$hlp$, $hlp$faq$hlp$, NULL, NULL, $hlp$internal$hlp$, 6, 1, true),
($hlp$crm$hlp$, $hlp$permissoes$hlp$, $hlp$Permissões do TechSales$hlp$, $hlp$Quem pode ver, criar, editar, excluir, exportar e administrar cada área do TechSales, e o que aparece mascarado.$hlp$, $hlp$# Permissões do TechSales

## Como o acesso funciona

- Você precisa ser **membro ativo** do workspace e o workspace precisa ter o TechSales licenciado. Membro inativo perde todo o acesso.
- Cada ação é uma chave no formato `techsales.<recurso>.<ação>.<escopo>`.
- **Escopos:** `own` (registros sob sua responsabilidade), `team` (do seu time), `workspace` (todo o workspace).
- **Negação vence:** se um cargo concede e uma regra nega, vale a negação.
- Administrador e dono do workspace têm acesso total ao workspace.
- Esconder o menu não basta: servidor e banco também verificam a permissão. Abrir a tela pela URL não libera nada.
- As permissões são gerenciadas em **Configurações › Pessoas & Acesso › Permissões** (`/settings/permissions`), só por dono/admin.

## Matriz recurso × ação

✔ = ação existe no catálogo e pode ser concedida ao cargo. — = ação não existe para o recurso.

| Área | Recurso | Ver | Criar | Editar | Excluir | Exportar | Administrar | Outras |
|---|---|---|---|---|---|---|---|---|
| Leads | `leads` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Contatos | `contacts` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Empresas | `companies` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Negócios | `deals` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir, aprovar |
| Cotações | `quotes` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir, aprovar |
| Enviar/compartilhar cotação | `quote_send`, `quote_share` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Propostas | `proposals` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir, aprovar |
| Enviar proposta | `proposal_send` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Compartilhar proposta | `proposal_share` | ✔ | — | — | — | — | ✔ | — |
| Modelos de proposta | `proposal_templates` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Tarefas e atividades | `tasks`, `activities` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Filas de tarefas | `task_queues` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Notas | `notes` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Reuniões | `meetings` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Comunicações | `communications` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Inbox (Email, WhatsApp, Chat) | `inbox.email`, `inbox.whatsapp`, `inbox.chat` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Contas de e-mail | `email_accounts` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Campanhas | `marketing.campaigns` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Formulários | `marketing.forms` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Landing pages | `marketing.landing_pages` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Agente SDR | `marketing.sdr_agent` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Pesquisas | `surveys` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Prospecção (busca, fila, roteiros, cadências, voz, enriquecimento…) | `prospecting_*` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir (conforme recurso) |
| Segmentos | `segments` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Tickets | `tickets` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Metas | `goals` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Painel | `dashboard` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |

Itens de **Otimizar** e algumas telas de configuração usam chaves `system.*` (ex.: `system.analytics.reports.view.workspace`, `system.workflows.manage.workspace`, `system.automation.sequences.view.workspace`). Sem a chave, o item aparece apenas para gestor ou superior.

## O que aparece para quem

- Itens de menu sem chave (Leads, Contatos, Empresas, Negócios, Inbox, Tarefas, Notas, Tickets…) aparecem a todo membro ativo com o módulo licenciado. Os **registros** listados dependem do escopo da sua permissão de ver (`own`, `team` ou `workspace`).
- Cargos com **visibilidade restrita** só enxergam registros do próprio escopo, mesmo que o menu apareça.
- Faturas seguem as permissões do TechFinance (`techfinance.invoices.*`).

## Campos ocultos, mascarados ou só leitura

O administrador pode definir regras por campo:

- **Oculto:** o campo não aparece para você.
- **Mascarado:** você vê só o primeiro e o último caractere, o resto vira `•` (ex.: `j•••••m`).
- **Somente leitura:** você vê o valor, mas não consegue alterar.

Essas regras são aplicadas no servidor, inclusive na exportação.

## Relacionados

- [Visão geral do TechSales](/ajuda/crm/visao-geral)
- [Erros comuns](/ajuda/crm/erros-comuns)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 3, 1, true),
($hlp$crm$hlp$, $hlp$preencher-um-formulario-de-landing-page$hlp$, $hlp$Preencher um formulário de landing page$hlp$, $hlp$Preencher um formulário de landing page.$hlp$, $hlp$# Preencher um formulário de landing page

**Para que serve:** Preencher um formulário de landing page, no contexto da tela `/lp/$slug`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/lp/$slug`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra a landing page publicada.
2. Leia o conteúdo e preencha os campos do formulário exibido.
3. Use a ação de envio apresentada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Campos e conteúdo dependem dos blocos da página; não há formulário único para todas as landing pages.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /lp/$slug com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/lp/$slug$hlp$, NULL, $hlp$internal$hlp$, 200, 1, true),
($hlp$crm$hlp$, $hlp$primeiros-15-minutos$hlp$, $hlp$Primeiros 15 minutos no TechSales$hlp$, $hlp$Checklist para o primeiro uso do módulo comercial.$hlp$, $hlp$# Primeiros 15 minutos no TechSales

1. Abra **Visão geral › Dashboard** e confira seus números do período.
2. Em **Minha conta › Conexão de email**, conecte sua conta de e-mail para enviar e receber pelo sistema.
3. Abra **Captar › Leads** e veja os leads sob sua responsabilidade.
4. Abra **Relacionar › Contatos** e **Relacionar › Empresas** para conhecer a carteira.
5. Abra um contato e veja a linha do tempo: e-mails, WhatsApp, ligações, notas e tarefas aparecem ali.
6. Em **Atender › Tarefas**, confira o que vence hoje.
7. Em **Relacionar › Inbox unificada**, responda conversas pendentes.
8. Em **Vender › Negócios**, mova um negócio de etapa no quadro.
9. Se algum menu não aparecer, peça ao administrador para revisar seu cargo em Configurações › Permissões.
10. Use o botão **?** no topo de qualquer tela para abrir o material daquela tela.

## Relacionados

- [Visão geral do TechSales](/ajuda/crm/visao-geral)
- [Permissões do TechSales](/ajuda/crm/permissoes)$hlp$, $hlp$quickstart$hlp$, NULL, NULL, $hlp$internal$hlp$, 2, 1, true),
($hlp$crm$hlp$, $hlp$registrar-atividade-de-contato$hlp$, $hlp$Registrar atividade de contato$hlp$, $hlp$Registrar atividade de contato.$hlp$, $hlp$# Registrar atividade de contato
**Para que serve:** Registrar atividade de contato.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Notas exigem view e create de `techsales.notes`; tarefas, de `techsales.tasks`; demais registros, de `techsales.activities`, nos escopos own, team ou workspace. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Contatos (`/contacts/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra a ficha.
2. Na barra da timeline, clique em "Nota" ou "Tarefa". Use "Mais" para outras ações disponíveis.
3. Preencha o conteúdo. Para tarefa, revise prazo e responsável.
4. Clique em "Salvar Nota" ou "Salvar Tarefa", conforme a ação.
<!-- screenshot: Registrar atividade de contato: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A atividade é registrada e a timeline é atualizada.
## Regras e limites
Registrar uma comunicação não é enviá-la. As ações disponíveis dependem das permissões e dos canais configurados.
## Erros comuns
Mensagens de falha são retornadas pelo serviço. Corrija os dados indicados antes de tentar novamente.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/contacts/$id$hlp$, NULL, $hlp$internal$hlp$, 120, 1, true),
($hlp$crm$hlp$, $hlp$registrar-atividade-de-empresa$hlp$, $hlp$Registrar atividade de empresa$hlp$, $hlp$Registrar atividade de empresa.$hlp$, $hlp$# Registrar atividade de empresa
**Para que serve:** Registrar atividade de empresa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Notas exigem view e create de `techsales.notes`; tarefas, de `techsales.tasks`; demais registros, de `techsales.activities`, nos escopos own, team ou workspace. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra a ficha.
2. Na barra da timeline, clique em "Nota" ou "Tarefa". Use "Mais" para outras ações disponíveis.
3. Preencha o conteúdo. Para tarefa, revise prazo e responsável.
4. Clique em "Salvar Nota" ou "Salvar Tarefa", conforme a ação.
<!-- screenshot: Registrar atividade de empresa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A atividade é registrada e a timeline é atualizada.
## Regras e limites
Registrar uma comunicação não é enviá-la. As ações disponíveis dependem das permissões e dos canais configurados.
## Erros comuns
Mensagens de falha são retornadas pelo serviço. Corrija os dados indicados antes de tentar novamente.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/companies/$id$hlp$, NULL, $hlp$internal$hlp$, 129, 1, true),
($hlp$crm$hlp$, $hlp$registrar-atividade-de-lead$hlp$, $hlp$Registrar atividade de lead$hlp$, $hlp$Registrar atividade de lead.$hlp$, $hlp$# Registrar atividade de lead
**Para que serve:** Registrar atividade de lead.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Notas exigem view e create de `techsales.notes`; tarefas, de `techsales.tasks`; demais registros, de `techsales.activities`, nos escopos own, team ou workspace. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra a ficha.
2. Na barra da timeline, clique em "Nota" ou "Tarefa". Use "Mais" para outras ações disponíveis.
3. Preencha o conteúdo. Para tarefa, revise prazo e responsável.
4. Clique em "Salvar Nota" ou "Salvar Tarefa", conforme a ação.
<!-- screenshot: Registrar atividade de lead: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A atividade é registrada e a timeline é atualizada.
## Regras e limites
Registrar uma comunicação não é enviá-la. As ações disponíveis dependem das permissões e dos canais configurados.
## Erros comuns
Mensagens de falha são retornadas pelo serviço. Corrija os dados indicados antes de tentar novamente.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/leads/$id$hlp$, NULL, $hlp$internal$hlp$, 111, 1, true),
($hlp$crm$hlp$, $hlp$registrar-comunicacoes$hlp$, $hlp$Registrar e editar comunicações$hlp$, $hlp$Cadastrar ligações, e-mails e reuniões no histórico.$hlp$, $hlp$# Registrar e editar comunicações
**Para que serve:** Registrar ligações, e-mails e reuniões. Registrar não envia mensagem.
**Quem pode fazer:** Membros ativos com permissão sobre atividades.
**Onde fica:** Menu > TechSales > Relacionar > Comunicações (`/communications`).
**Antes de começar:** Separe assunto e dados.

## Passo a passo
1. Clique em "Criar comunicação".
2. Preencha "Tipo" (obrigatório).
3. Preencha "Assunto", "Conteúdo" e "Resultado".
4. Em reuniões, informe "Local (reunião)".
5. Em ligações gravadas, "URL da gravação (call)".
6. Clique em "Salvar".
7. Para corrigir, edite e salve.
8. Para remover, exclua e confirme "Excluir este registro?".
<!-- screenshot: formulário de comunicação -->

## Resultado esperado
A comunicação aparece com tipo, assunto, resultado, duração e data.

## Regras e limites
- Lista só ligações, e-mails e reuniões. Tipo inicial: ligação.
- "Tipo" e "Assunto" podem ser editados na grade.
- Duração em minutos.

## Erros comuns
- Falha ao salvar: leia a mensagem e confira sua permissão.

## Relacionados
- [Organizar a lista de comunicações](/ajuda/crm/organizar-lista-comunicacoes)$hlp$, $hlp$howto$hlp$, $hlp$/communications$hlp$, NULL, $hlp$internal$hlp$, 306, 1, true),
($hlp$crm$hlp$, $hlp$registrar-notas$hlp$, $hlp$Registrar notas$hlp$, $hlp$Criar notas com conteúdo formatado e localizar registros pelo assunto ou conteúdo.$hlp$, $hlp$# Registrar notas
**Para que serve:** Manter notas livres e consultar seu conteúdo na lista.
**Quem pode fazer:** Membros ativos com TechSales licenciado e permissões de `techsales.activities`.
**Onde fica:** Menu > TechSales > Notas (`/notes`).
**Antes de começar:** Prepare o conteúdo que deseja registrar.

## Passo a passo
1. Abra "Notas".
2. Clique em "Criar nota".
3. Preencha "Assunto", se necessário.
4. Preencha "Conteúdo".
5. Clique em "Salvar". "Conteúdo" é obrigatório.
6. Localize a nota pelo assunto ou conteúdo.
7. Para corrigir rápido, edite "Assunto" direto na lista, se tiver permissão.
<!-- screenshot: formulário de nota com Assunto e Conteúdo e colunas da lista -->

## Resultado esperado
A nota aparece com "Assunto", prévia de "Conteúdo" e "Criada em".

## Regras e limites
- "Conteúdo" é obrigatório e aceita texto formatado.
- "Assunto" é opcional; sem ele, a lista mostra "(sem assunto)".
- A lista mostra até 120 caracteres do conteúdo.
- Esta tela lista só atividades do tipo nota. O formulário desta tela não associa a nota a lead, contato, empresa ou negócio.

## Erros comuns
- Se não conseguir salvar, confira "Conteúdo".
- Prévia abreviada não significa perda de texto.

## Relacionados
- [Campos e status](/ajuda/crm/campos-e-status)
- [Permissões](/ajuda/crm/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/notes$hlp$, NULL, $hlp$internal$hlp$, 209, 2, true),
($hlp$crm$hlp$, $hlp$reservar-publico-de-sequencia$hlp$, $hlp$Reservar o público de uma sequência$hlp$, $hlp$Prepare a inscrição do público em uma versão sem iniciar envios.$hlp$, $hlp$# Reservar o público de uma sequência
**Para que serve:** Separar os contatos elegíveis de uma versão antes da abordagem.
**Quem pode fazer:** Reservar exige `system.automation.sequences.assign.own`, `.assign.team` ou `.assign.workspace`.
**Onde fica:** Menu > TechSales > Sequências de prospecção (`/prospecting/sequences`).
**Antes de começar:** Configure "Público", salve, valide e crie uma versão. Tenha a evidência de autorização dos canais.

## Passo a passo
1. Abra "Público" e configure os filtros.
2. Salve o rascunho, valide e crie uma versão.
3. Localize "Inscrição do público em uma versão".
4. Escolha "Versão para inscrição".
5. Registre a origem da lista e a evidência de autorização no campo indicado.
6. Clique em "Reservar público sem iniciar disparos". Durante o processamento aparece "Calculando e reservando…". O botão fica desabilitado sem versão escolhida ou com justificativa de menos de 10 caracteres.
7. Confira o resumo e as exclusões.
<!-- screenshot: versão para inscrição, evidência de autorização e resumo do público -->

## Resultado esperado
"Público reservado. Nenhum disparo iniciado."

## Regras e limites
Usa uma fotografia dos filtros da versão. Exclui descadastros, duplicidades e as proteções configuradas (cliente, negócio aberto, outra sequência, WhatsApp recente). A evidência precisa de pelo menos 10 caracteres. Entrada dinâmica é ativada à parte.

## Erros comuns
- Botão desabilitado: justificativa curta, alterações não salvas ou versão desatualizada.
- "Não foi possível preparar a inscrição. Nenhum envio foi iniciado.": confira versão, permissões e evidência.

## Relacionados
- [Validar e criar uma versão imutável de sequência](/ajuda/crm/validar-versionar-sequencia)
- [Iniciar e pausar execuções de sequência](/ajuda/crm/iniciar-pausar-sequencia)$hlp$, $hlp$howto$hlp$, $hlp$/prospecting/sequences$hlp$, $hlp$system.automation.sequences.view.workspace$hlp$, $hlp$internal$hlp$, 407, 2, true),
($hlp$crm$hlp$, $hlp$responder-emails-inbox$hlp$, $hlp$Responder e-mails na Inbox$hlp$, $hlp$Localizar conversas de e-mail, definir responsáveis e enviar respostas.$hlp$, $hlp$# Responder e-mails na Inbox
**Para que serve:** Consultar e responder conversas de e-mail.
**Quem pode fazer:** Membros ativos com TechSales licenciado e acesso à conta de e-mail.
**Onde fica:** Menu > TechSales > Inbox unificada > Email (`/inbox/email`).
**Antes de começar:** Conecte e sincronize uma conta Gmail.

## Passo a passo
1. Escolha "Minhas", "Sem dono" ou "Todas".
2. Pesquise em "Buscar assunto, trecho ou contato…".
3. Abra a conversa.
4. Em "Atribuir a…", escolha o responsável.
5. Escreva a resposta.
6. Clique em "Enviar resposta".
7. Para nova mensagem, clique em "Novo email".
<!-- screenshot: conversa de e-mail com editor de resposta -->

## Resultado esperado
A resposta vai ao remetente e o histórico é atualizado.

## Regras e limites
- As abas não ampliam a visibilidade.
- A conversa precisa ter destinatário identificável.
- O painel do agente só aparece com atendimento automático ativo.

## Erros comuns
- "Selecione um membro ativo deste workspace.": confira o membro.
- Falha no envio: confira a conexão do Gmail.

## Relacionados
- [Conectar e sincronizar o Gmail](/ajuda/crm/conectar-sincronizar-gmail)
- [Controlar o agente no atendimento](/ajuda/crm/controlar-agente-atendimento)$hlp$, $hlp$howto$hlp$, $hlp$/inbox/email$hlp$, NULL, $hlp$internal$hlp$, 302, 1, true),
($hlp$crm$hlp$, $hlp$responder-uma-pesquisa-por-link$hlp$, $hlp$Responder uma pesquisa por link$hlp$, $hlp$Responder uma pesquisa por link.$hlp$, $hlp$# Responder uma pesquisa por link

**Para que serve:** Responder uma pesquisa por link, no contexto da tela `/survey/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/survey/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link recebido.
2. Responda às perguntas apresentadas.
3. Confira o envio no estado final da tela.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
As perguntas dependem da pesquisa publicada; resposta não concede acesso ao construtor de pesquisas.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /survey/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/survey/$token$hlp$, NULL, $hlp$internal$hlp$, 215, 1, true),
($hlp$crm$hlp$, $hlp$revisar-configuracoes-de-reunioes-em-video$hlp$, $hlp$Revisar configurações de reuniões em vídeo$hlp$, $hlp$Revisar configurações de reuniões em vídeo.$hlp$, $hlp$# Revisar configurações de reuniões em vídeo

**Para que serve:** Revisar configurações de reuniões em vídeo, no contexto da tela `/settings/video`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/video`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/video.
2. Consulte as configurações de reunião.
3. Altere e salve somente se possuir gerenciamento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Usa techsales.meeting_settings.view.workspace e manage.workspace. Pertence às reuniões do TechSales.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/video com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/video$hlp$, NULL, $hlp$internal$hlp$, 173, 1, true),
($hlp$crm$hlp$, $hlp$revisar-lembretes-de-reuniao$hlp$, $hlp$Revisar lembretes de reunião$hlp$, $hlp$Revisar lembretes de reunião.$hlp$, $hlp$# Revisar lembretes de reunião

**Para que serve:** Revisar lembretes de reunião, no contexto da tela `/settings/meeting-reminders`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.meeting_settings`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/meeting-reminders`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/meeting-reminders.
2. Revise os lembretes e opções de WhatsApp apresentados.
3. Confira a configuração antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso techsales.meeting_settings. Envio WhatsApp continua sujeito à janela de 24 horas e a templates aprovados quando exigidos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/meeting-reminders com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/meeting-reminders$hlp$, NULL, $hlp$internal$hlp$, 143, 1, true),
($hlp$crm$hlp$, $hlp$salvar-visao-de-leads$hlp$, $hlp$Salvar visualização de leads$hlp$, $hlp$Salvar visualização de leads.$hlp$, $hlp$# Salvar visualização de leads
**Para que serve:** Salvar visualização de leads.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Os registros disponíveis respeitam suas permissões e o escopo de acesso. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Escolha a aba e ajuste filtros e ordenação.
2. Clique em "Adicionar visualização".
3. No pedido "Nome da nova visualização", informe um nome e confirme.
4. Clique na aba com o nome salvo para reaplicar os critérios.
5. Para remover, use "Excluir visualização" e confirme "Excluir esta visualização?".
<!-- screenshot: Salvar visualização de leads: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem "Visualização salva" confirma o cadastro.
## Regras e limites
A criação usa visualização privada, não compartilhada e não padrão. Salva aba, filtros e ordenação; não inclui o texto da busca.
## Erros comuns
"Erro ao salvar": tente novamente e confira o acesso ao workspace.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)$hlp$, $hlp$howto$hlp$, $hlp$/leads$hlp$, NULL, $hlp$internal$hlp$, 130, 1, true),
($hlp$crm$hlp$, $hlp$validar-versionar-sequencia$hlp$, $hlp$Validar e criar uma versão imutável de sequência$hlp$, $hlp$Confira a configuração salva e preserve uma revisão antes de reservar contatos.$hlp$, $hlp$# Validar e criar uma versão imutável de sequência
**Para que serve:** Conferir a configuração e preservar uma revisão que pode receber inscrições.
**Quem pode fazer:** Criar versão exige `system.automation.sequences.manage.own`, `.manage.team` ou `.manage.workspace`.
**Onde fica:** Menu > TechSales > Sequências de prospecção (`/prospecting/sequences`).
**Antes de começar:** Salve o rascunho.

## Passo a passo
1. Abra o rascunho em "Rascunhos recentes (até 100)".
2. Clique em "Salvar rascunho" se houver alterações.
3. Clique em "Validar configuração salva".
4. Corrija as pendências indicadas.
5. Ao ver "Configuração conferida para criar uma versão.", clique em "Criar versão imutável".
6. Confira a revisão em "Versões de configuração".
<!-- screenshot: validação aprovada e histórico de versões -->

## Resultado esperado
A versão preserva a configuração. Criar versão não ativa a sequência nem inscreve pessoas.

## Regras e limites
Conexões, permissões e modelos são conferidos de novo antes de cada disparo. O histórico mostra até 25 versões.

## Erros comuns
- "Salve o rascunho para criar versões.": salve primeiro.
- "Não foi possível concluir. Confira suas permissões, as conexões e se o rascunho foi alterado em outra sessão.": revise e repita.
- "Não foi possível carregar o histórico de versões.": tente novamente.

## Relacionados
- [Reservar o público de uma sequência](/ajuda/crm/reservar-publico-de-sequencia)
- [Iniciar e pausar execuções de sequência](/ajuda/crm/iniciar-pausar-sequencia)$hlp$, $hlp$howto$hlp$, $hlp$/prospecting/sequences$hlp$, $hlp$system.automation.sequences.view.workspace$hlp$, $hlp$internal$hlp$, 406, 1, true),
($hlp$crm$hlp$, $hlp$visao-geral$hlp$, $hlp$Visão geral do TechSales$hlp$, $hlp$Para que serve o TechSales, quem usa, mapa das telas e ligação com os outros módulos.$hlp$, $hlp$# Visão geral do TechSales

O TechSales é o módulo comercial do TechERP. Concentra CRM, prospecção, campanhas de e-mail e WhatsApp, Inbox, negócios, cotações, propostas e atendimento.

## Quem usa

- **Vendedores e SDRs:** leads, contatos, empresas, negócios, tarefas e Inbox.
- **Gestores comerciais:** painéis, relatórios, sequências, distribuição e agentes de IA.
- **Marketing:** landing pages, formulários, pesquisas e campanhas.
- **Atendimento:** tickets, base de conhecimento, macros e SLA.

O que cada pessoa vê depende do cargo e das permissões. Veja [Permissões do TechSales](/ajuda/crm/permissoes).

## Mapa das telas (menu lateral)

| Grupo | Telas |
|---|---|
| Visão geral | Dashboard (`/dashboard`) |
| Captar | Prospecção, Sequências de prospecção, Leads, Landing Pages, Formulários, Pesquisas, Campanhas Email, Campanhas WhatsApp, Agente SDR |
| Relacionar | Contatos, Empresas, Inbox unificada (Email, WhatsApp, Chat ao vivo), Comunicações, Notas, Reuniões (Calendários, Agendamentos), Conexão de Email |
| Vender | Negócios, Propostas, Cotações, Faturas, Portal do cliente |
| Atender | Tickets, Tarefas (Filas), Base de conhecimento |
| Otimizar | Dashboards, Relatórios, Analytics, Workflows, Sequências, Distribuição, SLA por etapa, Macros |

## Como se conecta aos outros módulos

- **Cotação → Proposta → Contrato:** a proposta nasce da cotação e o contrato (TechContracts) nasce da proposta, guardando a origem.
- **Empresas e Contatos** são cadastros do Core ERP, compartilhados com os demais módulos.
- **Faturas** usam as permissões do TechFinance.
- **Inbox, WhatsApp e e-mail** usam as contas configuradas em Configurações › Integrações.

## Relacionados

- [Primeiros 15 minutos](/ajuda/crm/primeiros-15-minutos)
- [Campos e status](/ajuda/crm/campos-e-status)
- [Erros comuns](/ajuda/crm/erros-comuns)
- [Perguntas frequentes](/ajuda/crm/perguntas-frequentes)$hlp$, $hlp$overview$hlp$, $hlp$/dashboard$hlp$, NULL, $hlp$internal$hlp$, 1, 1, true)
ON CONFLICT (module_key, slug) DO NOTHING;
INSERT INTO public.help_articles
  (module_key, slug, title, summary, body_md, article_type, route_pattern, min_permission, audience, sort_order, version, is_published)
VALUES
($hlp$ats$hlp$, $hlp$acompanhar-dashboard$hlp$, $hlp$Acompanhar o dashboard do TechHire$hlp$, $hlp$Ver funil, entrevistas próximas, vagas e contratações.$hlp$, $hlp$# Acompanhar o dashboard do TechHire
**Para que serve:** Ter uma visão rápida do recrutamento.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Visão geral > Dashboard (`/ats-dashboard`).
**Antes de começar:** Cadastre vagas e candidaturas para ver números.

## Passo a passo
1. Abra "Dashboard".
2. Confira "Vagas publicadas", "Candidaturas (30d)", "Contratados" e "Taxa de conversão".
3. Veja o "Funil de candidaturas".
4. Em "Próximas entrevistas (7 dias)", clique em "Agenda →".
5. Use "Ir para Vagas" ou "Insights avançados" para aprofundar.
<!-- screenshot: dashboard do TechHire -->

## Resultado esperado
Os indicadores do workspace aparecem atualizados.

## Regras e limites
- Os dados são renovados a cada 30 segundos.
- Mostra até 8 entrevistas e 20 vagas em destaque.

## Erros comuns
- Números zerados: ainda não há vagas ou candidaturas.

## Relacionados
- [Consultar insights](/ajuda/ats/consultar-insights)
- [Gerenciar vagas](/ajuda/ats/gerenciar-vagas)$hlp$, $hlp$howto$hlp$, $hlp$/ats-dashboard$hlp$, NULL, $hlp$internal$hlp$, 10, 1, true),
($hlp$ats$hlp$, $hlp$acompanhar-multi-posting$hlp$, $hlp$Acompanhar o multi-posting$hlp$, $hlp$Ver e gerenciar a publicação de vagas em sites externos.$hlp$, $hlp$# Acompanhar o multi-posting
**Para que serve:** Distribuir vagas em job boards.
**Quem pode fazer:** Ver exige `techhire.jobs.view`. Republicar e encerrar exigem `techhire.jobs.publish.workspace` e permissão sobre a vaga.
**Onde fica:** Menu > TechHire > Sourcing > Multi-posting (`/sourcing/multi-posting`).
**Antes de começar:** Tenha vagas publicadas.

## Passo a passo
1. Filtre por site ("LinkedIn Jobs", "Indeed", "Vagas.com") e status.
2. Use "Abrir", "Republicar" ou "Encerrar".
<!-- screenshot: multi-posting -->

## Resultado esperado
"Publicação atualizada" ou "Publicação encerrada".

## Regras e limites
- O modo depende do provedor. LinkedIn possui caminho de publicação real quando há conta conectada e configuração válida. Indeed e Vagas.com ainda retornam publicações simuladas no código atual. Nesses dois sites, o status ou a ausência do selo de simulação não comprova publicação; confira o destino externo.
- Mostra até 200 publicações.

## Erros comuns
- "Registro indisponível ou sem permissão para esta ação.": peça acesso.

## Relacionados
- [Gerenciar vagas](/ajuda/ats/gerenciar-vagas)$hlp$, $hlp$howto$hlp$, $hlp$/sourcing/multi-posting$hlp$, $hlp$techhire.jobs.view.own$hlp$, $hlp$internal$hlp$, 66, 2, true),
($hlp$ats$hlp$, $hlp$acompanhar-observabilidade-hunting$hlp$, $hlp$Acompanhar a observabilidade do hunting$hlp$, $hlp$Ver uso diário, sucesso e erros das chamadas ao LinkedIn.$hlp$, $hlp$# Acompanhar a observabilidade do hunting
**Para que serve:** Evitar estourar os limites diários do LinkedIn.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Hunting (LinkedIn) > Observabilidade (`/hunting/observability`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Confira "Requisições · 24h", "Taxa de sucesso", "Latência média" e "Erros · 24h".
2. Em "Budgets diários por endpoint (UTC)", veja quanto já foi usado.
3. Clique em "Atualizar" para recarregar.
<!-- screenshot: observabilidade -->

## Resultado esperado
Os números das últimas 24 horas aparecem.

## Regras e limites
- Limites diários exibidos: busca 20, perfil 80, mensagens 40, convites 15.
- Mostra as últimas 100 requisições.
- Alerta a partir de 80% do limite.

## Erros comuns
- Muitos erros: confira a conexão da conta LinkedIn.

## Relacionados
- [Buscar perfis no LinkedIn](/ajuda/ats/buscar-perfis-linkedin)$hlp$, $hlp$howto$hlp$, $hlp$/hunting/observability$hlp$, NULL, $hlp$internal$hlp$, 44, 1, true),
($hlp$ats$hlp$, $hlp$acompanhar-vaga$hlp$, $hlp$Acompanhar uma vaga$hlp$, $hlp$Gerir propriedades e candidaturas da vaga.$hlp$, $hlp$# Acompanhar uma vaga
**Para que serve:** Mover candidatos pelas etapas e registrar a contratação.
**Quem pode fazer:** Quem vê a vaga. Adicionar candidato exige `techhire.candidates.create`. Exportar exige `techhire.jobs.export.workspace` e `techhire.candidates.export.workspace`.
**Onde fica:** Vagas > clique na vaga (`/jobs/$id`).
**Antes de começar:** Abra a vaga.

## Passo a passo
1. Clique em "Adicionar candidato", escolha em "Candidato" e clique em "Adicionar".
2. Mova as candidaturas entre as etapas.
3. Edite o painel "Propriedades".
4. Ao contratar, preencha "Registrar contratação": modelo "Interna", "Outsourcing" ou "Hunting".
5. Para exportar, clique em "CSV".
<!-- screenshot: detalhe da vaga -->

## Resultado esperado
"Candidato adicionado à vaga" ou "Contratação registrada".

## Regras e limites
- Etapas padrão: Aplicado, Triagem, Entrevista RH, Entrevista técnica, Teste, Proposta, Contratado, Rejeitado.
- Pipelines próprios podem ter outras etapas.

## Erros comuns
- "Sem permissão para confirmar contratação.": peça acesso.
- "Falha ao mover em massa": confira sua permissão.

## Relacionados
- [Gerenciar vagas](/ajuda/ats/gerenciar-vagas)$hlp$, $hlp$howto$hlp$, $hlp$/jobs/$id$hlp$, $hlp$techhire.jobs.view.own$hlp$, $hlp$internal$hlp$, 23, 1, true),
($hlp$ats$hlp$, $hlp$agendar-uma-entrevista-pelo-link$hlp$, $hlp$Agendar uma entrevista pelo link$hlp$, $hlp$Agendar uma entrevista pelo link.$hlp$, $hlp$# Agendar uma entrevista pelo link

**Para que serve:** Agendar uma entrevista pelo link, no contexto da tela `/schedule/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/schedule/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link de agendamento recebido.
2. Consulte as opções de horário.
3. Selecione uma opção disponível e confira a confirmação.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Agendamento de entrevista do TechHire; não confunda com /book/$slug de reuniões comerciais.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /schedule/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/schedule/$token$hlp$, NULL, $hlp$internal$hlp$, 212, 1, true),
($hlp$ats$hlp$, $hlp$analisar-sourcing$hlp$, $hlp$Analisar o sourcing$hlp$, $hlp$Desempenho das sequências, canais e funil.$hlp$, $hlp$# Analisar o sourcing
**Para que serve:** Saber quais cadências funcionam.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Sourcing > Analytics (`/sourcing/analytics`).
**Antes de começar:** Tenha sequências ativas.

## Passo a passo
1. Escolha "7 dias", "30 dias" ou "90 dias".
2. Veja "Performance por sequência", "Por canal", "Funil por step" e "A/B por variante".
3. Clique em "CSV" para exportar.
<!-- screenshot: analytics de sourcing -->

## Resultado esperado
As métricas do período aparecem.

## Regras e limites
- Padrão: 30 dias.
- Considera até 5.000 inscrições.

## Erros comuns
- "Não foi possível carregar as métricas": clique em "Tentar de novo".

## Relacionados
- [Criar sequências de outreach](/ajuda/ats/criar-sequencias-outreach)$hlp$, $hlp$howto$hlp$, $hlp$/sourcing/analytics$hlp$, NULL, $hlp$internal$hlp$, 65, 1, true),
($hlp$ats$hlp$, $hlp$buscar-perfis-linkedin$hlp$, $hlp$Buscar perfis no LinkedIn$hlp$, $hlp$Pesquisar perfis e importar para o TechHire.$hlp$, $hlp$# Buscar perfis no LinkedIn
**Para que serve:** Encontrar candidatos fora do banco.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Hunting (LinkedIn) > Buscar perfis (`/hunting/search`).
**Antes de começar:** A conta LinkedIn precisa estar conectada.

## Passo a passo
1. Preencha "Palavras-chave", "Localização", "Empresa atual", "Setor" ou "Escola".
2. Em "Rede", escolha "1º", "2º" ou "3º+".
3. Clique em "Buscar". Use "Carregar mais" para ver outros.
4. Marque os perfis e clique em "Importar selecionados".
5. Acompanhe "Novos", "Já existiam", "Enriquecidos" e "Falhas".
<!-- screenshot: busca no LinkedIn -->

## Resultado esperado
"Importação concluída · N novos · N já existiam · N enriquecidos".

## Regras e limites
- 20 resultados por página.
- Perfis já existentes não são duplicados.
- Respeita janela de horário e limite diário.

## Erros comuns
- "Unipile não configurado": peça ao administrador.
- "Conta LinkedIn desconectada": reconecte a conta.
- "Budget diário atingido": tente amanhã.
- "Fora da janela horária": tente no horário permitido.

## Relacionados
- [Tratar candidatos capturados](/ajuda/ats/tratar-candidatos-capturados)$hlp$, $hlp$howto$hlp$, $hlp$/hunting/search$hlp$, NULL, $hlp$internal$hlp$, 42, 1, true),
($hlp$ats$hlp$, $hlp$calcular-match-scores$hlp$, $hlp$Calcular match scores$hlp$, $hlp$Ver a nota de compatibilidade entre vaga e candidato.$hlp$, $hlp$# Calcular match scores
**Para que serve:** Priorizar candidatos mais aderentes.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Inteligência (IA) > Match Scores (`/match-scores`).
**Antes de começar:** Gere um match pela candidatura.

## Passo a passo
1. Veja "Vaga", "Candidato", "Score" e "Resumo".
2. Clique em "Recalcular" para atualizar.
<!-- screenshot: match scores -->

## Resultado esperado
A nota de 0 a 100 é atualizada.

## Regras e limites
- Lista até 200 resultados.
- A nota apoia a triagem; não decide.

## Erros comuns
- "Nenhum match calculado ainda.": calcule a partir da candidatura.
- "Candidato não encontrado": o registro foi removido.

## Relacionados
- [Acompanhar uma vaga](/ajuda/ats/acompanhar-vaga)$hlp$, $hlp$howto$hlp$, $hlp$/match-scores$hlp$, NULL, $hlp$internal$hlp$, 14, 1, true),
($hlp$ats$hlp$, $hlp$campos-e-status$hlp$, $hlp$Campos e status do TechHire$hlp$, $hlp$Referência dos status de vagas, candidatos, candidaturas e ofertas.$hlp$, $hlp$# Campos e status do TechHire

## Vaga
Rascunho, Publicada, Em pausa, Preenchida, Encerrada.

## Candidato
Novo, Em processo, Em entrevista, Em oferta, Contratado, Arquivado.

## Etapas padrão da candidatura
Aplicado, Triagem, Entrevista RH, Entrevista técnica, Teste, Proposta, Contratado, Rejeitado.

## Oferta
Rascunho, Para assinatura, Assinada, Recusada, Cancelada. Aprovação: Aprovação não solicitada, Aguardando aprovação, Versão aprovada, Reprovada — revisar condições.

## Solicitação LGPD
Pendente, Em andamento, Concluída, Rejeitada.

## Relacionados

- [Visão geral](/ajuda/ats/visao-geral)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 3, 1, true),
($hlp$ats$hlp$, $hlp$candidatar-se-a-uma-vaga-publica$hlp$, $hlp$Candidatar-se a uma vaga pública$hlp$, $hlp$Candidatar-se a uma vaga pública.$hlp$, $hlp$# Candidatar-se a uma vaga pública

**Para que serve:** Candidatar-se a uma vaga pública, no contexto da tela `/careers/$slug`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/careers/$slug`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra a vaga publicada.
2. Leia descrição e requisitos.
3. Preencha Nome completo, E-mail e os demais campos solicitados.
4. Envie a candidatura e confira a confirmação.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O formulário solicita link do currículo PDF; não presuma upload de arquivo. Vaga indisponível não aceita candidatura pela simples troca de slug.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /careers/$slug com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/careers/$slug$hlp$, NULL, $hlp$internal$hlp$, 194, 1, true),
($hlp$ats$hlp$, $hlp$configurar-emails-por-etapa$hlp$, $hlp$Configurar e-mails por etapa$hlp$, $hlp$Enviar e-mail automático quando a candidatura muda de etapa.$hlp$, $hlp$# Configurar e-mails por etapa
**Para que serve:** Avisar o candidato a cada etapa.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Comunicação > E-mails por etapa (`/stage-emails`).
**Antes de começar:** Prepare o texto.

## Passo a passo
1. Escolha a "Etapa do funil".
2. Marque "Ativo — disparar nesta etapa".
3. Preencha "Assunto" e "Corpo do e-mail". Use os botões de variáveis.
4. Clique em "Salvar template".
5. Para apagar, clique em "Remover".
<!-- screenshot: e-mails por etapa -->

## Resultado esperado
"Template salvo".

## Regras e limites
- Assunto até 200 e corpo até 8.000 caracteres.
- Remover não pede confirmação.

## Erros comuns
- "Você não tem permissão para excluir este e-mail de etapa.": peça ao dono ou admin.

## Relacionados
- [Configurar pipelines](/ajuda/ats/configurar-pipelines)$hlp$, $hlp$howto$hlp$, $hlp$/stage-emails$hlp$, NULL, $hlp$internal$hlp$, 70, 1, true),
($hlp$ats$hlp$, $hlp$configurar-pipelines$hlp$, $hlp$Configurar pipelines de recrutamento$hlp$, $hlp$Criar e ordenar as etapas dos funis.$hlp$, $hlp$# Configurar pipelines de recrutamento
**Para que serve:** Adaptar o funil ao processo da vaga.
**Quem pode fazer:** Ver exige `techhire.pipelines.view` ou `techhire.jobs.view`. Criar exige `.create`. Tornar padrão exige `techhire.pipelines.update.workspace`.
**Onde fica:** Menu > TechHire > Recrutamento > Pipelines (`/pipelines`).
**Antes de começar:** Defina as etapas.

## Passo a passo
1. Preencha "Nome" e as "Etapas".
2. Defina o tipo de cada etapa: "Em andamento", "Ganho (contratado)" ou "Perdido (rejeitado)".
3. Clique em "Salvar pipeline".
4. Use "Duplicar", "Tornar padrão" ou "Excluir".
<!-- screenshot: pipelines -->

## Resultado esperado
"Pipeline salvo".

## Regras e limites
- De 2 a 20 etapas.
- Nome até 120 caracteres.
- Excluir pede: "Excluir este pipeline?".

## Erros comuns
- "Pipeline precisa de no mínimo 2 etapas": adicione etapas.

## Relacionados
- [Gerenciar vagas](/ajuda/ats/gerenciar-vagas)$hlp$, $hlp$howto$hlp$, $hlp$/pipelines$hlp$, $hlp$techhire.pipelines.view.own$hlp$, $hlp$internal$hlp$, 31, 1, true),
($hlp$ats$hlp$, $hlp$configurar-sequencia-outreach$hlp$, $hlp$Configurar uma sequência de outreach$hlp$, $hlp$Ritmo, horários, passos e variantes A/B.$hlp$, $hlp$# Configurar uma sequência de outreach
**Para que serve:** Definir como e quando cada mensagem sai.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Sourcing > Sequências > "Abrir" (`/sourcing/sequences/$id`).
**Antes de começar:** Crie a sequência.

## Passo a passo
1. Em "Throttling & quiet hours", ajuste "Fuso horário", "Limite diário", "Quiet hours (hora 0–23)" e "Dias de envio". Clique em "Salvar configurações".
2. Em "Adicionar step ou variante (A/B)", escolha "Posição", "Variante", "Peso", "Canal" e "Atraso (dias)".
3. Preencha o conteúdo do canal (por exemplo "Assunto" e "Corpo").
4. Clique em "Adicionar step".
<!-- screenshot: configurar sequência -->

## Resultado esperado
"Step adicionado" ou "Configurações salvas".

## Regras e limites
- Canais: Email, WhatsApp (tarefa), LinkedIn — Convite, LinkedIn — Mensagem, LinkedIn (tarefa manual), Espera, Aguardar aceite do convite.
- Convite do LinkedIn até 300 caracteres.
- Atraso de 0 a 180 dias; até 50 posições.
- Use "Aguardar aceite do convite" depois de um convite.

## Erros comuns
- Sem envio: confira os dias de envio e as quiet hours.

## Relacionados
- [Criar sequências de outreach](/ajuda/ats/criar-sequencias-outreach)$hlp$, $hlp$howto$hlp$, $hlp$/sourcing/sequences/$id$hlp$, NULL, $hlp$internal$hlp$, 67, 1, true),
($hlp$ats$hlp$, $hlp$consultar-dei-analytics$hlp$, $hlp$Consultar DEI Analytics$hlp$, $hlp$Ver a distribuição dos dados de diversidade autodeclarados.$hlp$, $hlp$# Consultar DEI Analytics
**Para que serve:** Acompanhar a diversidade do banco de candidatos.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Análise > DEI Analytics (`/dei-analytics`).
**Antes de começar:** Nenhum. Os campos são opcionais para o candidato.

## Passo a passo
1. Abra "DEI Analytics".
2. Veja "Gênero", "Raça/Cor", "Pessoa com deficiência" e "LGBTQIA+".
<!-- screenshot: DEI analytics -->

## Resultado esperado
Os gráficos mostram o total de candidatos e a distribuição.

## Regras e limites
- Só leitura.
- Usa apenas dados que o candidato informou.

## Erros comuns
- Distribuição vazia: poucos candidatos responderam.

## Relacionados
- [Consultar insights](/ajuda/ats/consultar-insights)$hlp$, $hlp$howto$hlp$, $hlp$/dei-analytics$hlp$, NULL, $hlp$internal$hlp$, 80, 1, true),
($hlp$ats$hlp$, $hlp$consultar-insights$hlp$, $hlp$Consultar insights de recrutamento$hlp$, $hlp$Indicadores, funil, origens e análise por IA.$hlp$, $hlp$# Consultar insights de recrutamento
**Para que serve:** Entender a saúde do funil.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Análise > Insights ATS (`/insights`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Veja "Funil de candidaturas", "Fontes de candidatos" e "Tempo médio para fechar".
2. Em "Saúde do funil", escolha o período (30 a 180 dias).
3. Clique em "Analisar".
<!-- screenshot: insights -->

## Resultado esperado
A IA mostra a análise do período.

## Regras e limites
- Período padrão: 90 dias.
- Indicadores recentes usam 30 dias.

## Erros comuns
- "Não foi possível carregar os indicadores": clique em "Tentar novamente".
- "Créditos de IA esgotados. Adicione créditos no workspace.": peça recarga.

## Relacionados
- [Acompanhar o dashboard](/ajuda/ats/acompanhar-dashboard)$hlp$, $hlp$howto$hlp$, $hlp$/insights$hlp$, NULL, $hlp$internal$hlp$, 81, 1, true),
($hlp$ats$hlp$, $hlp$consultar-um-link-publico-de-entrevista$hlp$, $hlp$Consultar um link público de entrevista$hlp$, $hlp$Consultar um link público de entrevista.$hlp$, $hlp$# Consultar um link público de entrevista

**Para que serve:** Consultar um link público de entrevista, no contexto da tela `/interview/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/interview/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link recebido.
2. Confira os horários ou a confirmação apresentados.
3. Siga as opções de entrevista em vídeo quando disponíveis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Token indisponível deve ser revisado pela equipe de recrutamento.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /interview/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/interview/$token$hlp$, NULL, $hlp$internal$hlp$, 196, 1, true),
($hlp$ats$hlp$, $hlp$consultar-uma-oferta-publica$hlp$, $hlp$Consultar uma oferta pública$hlp$, $hlp$Consultar uma oferta pública.$hlp$, $hlp$# Consultar uma oferta pública

**Para que serve:** Consultar uma oferta pública, no contexto da tela `/offer/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/offer/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link de oferta recebido.
2. Revise a oferta e as ações disponíveis.
3. Confira as condições antes de responder.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Oferta de recrutamento do TechHire não é proposta comercial do TechSales.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /offer/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/offer/$token$hlp$, NULL, $hlp$internal$hlp$, 202, 1, true),
($hlp$ats$hlp$, $hlp$consultar-vagas-publicas$hlp$, $hlp$Consultar vagas públicas$hlp$, $hlp$Consultar vagas públicas.$hlp$, $hlp$# Consultar vagas públicas

**Para que serve:** Consultar vagas públicas, no contexto da tela `/careers`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/careers`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /careers.
2. Consulte as vagas publicadas.
3. Abra a vaga desejada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Não é a lista interna de vagas nem libera acesso ao ATS.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /careers com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/careers$hlp$, NULL, $hlp$internal$hlp$, 193, 1, true),
($hlp$ats$hlp$, $hlp$criar-sequencias-outreach$hlp$, $hlp$Criar sequências de outreach$hlp$, $hlp$Criar, ativar e pausar cadências multicanal.$hlp$, $hlp$# Criar sequências de outreach
**Para que serve:** Abordar candidatos em etapas.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Sourcing > Sequências (`/sourcing/sequences`).
**Antes de começar:** Defina o objetivo da cadência.

## Passo a passo
1. Clique em "Nova sequência".
2. Preencha "Nome" e "Descrição" e clique em "Criar".
3. Use "Abrir" para configurar os passos.
4. Use o botão "Pausar"/"Ativar" da linha.
<!-- screenshot: sequências de outreach -->

## Resultado esperado
"Sequência criada".

## Regras e limites
- Nome até 120 caracteres.
- Status: Ativa ou Pausada.

## Erros comuns
- Botão desabilitado: preencha o nome.

## Relacionados
- [Configurar uma sequência](/ajuda/ats/configurar-sequencia-outreach)$hlp$, $hlp$howto$hlp$, $hlp$/sourcing/sequences$hlp$, NULL, $hlp$internal$hlp$, 64, 1, true),
($hlp$ats$hlp$, $hlp$editar-ficha-candidato$hlp$, $hlp$Editar a ficha do candidato$hlp$, $hlp$Consultar e atualizar dados, candidaturas, entrevistas e ofertas.$hlp$, $hlp$# Editar a ficha do candidato
**Para que serve:** Ver tudo sobre um candidato em um só lugar.
**Quem pode fazer:** Quem vê o candidato. Editar e excluir dependem da permissão sobre o registro. Atribuir responsável exige `techhire.candidates.assign.workspace`. Contratar exige `techpeople.people.create`.
**Onde fica:** Candidatos > clique no nome (`/candidates/$id`).
**Antes de começar:** Abra o candidato pela lista.

## Passo a passo
1. Edite "Nome", "Email", "Telefone", "LinkedIn", "Localização", "Cargo", "Empresa" ou "Notas".
2. Consulte "Aplicações", "Entrevistas", "Ofertas" e "Histórico".
3. Para associar a uma vaga, abra "Associar candidato à vaga", escolha "Vaga" e "Origem" e confirme.
4. Para falar pelo LinkedIn, use "Contato LinkedIn": aba "Mensagem" ou "Convite".
5. Para contratar, clique em "Contratar" e preencha "Vínculo", "Cargo", "Data de início" e "Custo/hora (R$)".
6. Para excluir, clique em "Excluir" e confirme.
<!-- screenshot: ficha do candidato -->

## Resultado esperado
"Atualizado" ao salvar; "Candidato contratado" ao contratar.

## Regras e limites
- Status: Novo, Em processo, Em entrevista, Em oferta, Contratado, Arquivado.
- Convite do LinkedIn: até 300 caracteres.
- Contratar cria a pessoa no TechPeople.

## Erros comuns
- "Este candidato já está nessa vaga.": ele já foi associado.
- "Erro ao salvar": confira os campos e sua permissão.

## Relacionados
- [Gerenciar candidatos](/ajuda/ats/gerenciar-candidatos)
- [Gerenciar ofertas](/ajuda/ats/gerenciar-ofertas)$hlp$, $hlp$howto$hlp$, $hlp$/candidates/$id$hlp$, $hlp$techhire.candidates.view.own$hlp$, $hlp$internal$hlp$, 21, 1, true),
($hlp$ats$hlp$, $hlp$erros-comuns$hlp$, $hlp$Erros comuns do TechHire$hlp$, $hlp$Mensagens frequentes e como resolver.$hlp$, $hlp$# Erros comuns do TechHire

- **"Registro indisponível ou sem permissão para esta ação."**: falta permissão sobre o registro. Peça ao administrador.
- **"Informe o nome" / "Informe o título da vaga"**: preencha o campo obrigatório.
- **"AI Gateway: créditos esgotados..."**: os créditos de IA acabaram. Peça recarga.
- **"Conta LinkedIn desconectada"**: reconecte a conta nas integrações.
- **"Budget diário atingido"**: o limite diário do LinkedIn acabou. Tente amanhã.
- **"Este candidato já está nessa vaga."**: a associação já existe.

## Relacionados

- [Perguntas frequentes](/ajuda/ats/perguntas-frequentes)$hlp$, $hlp$troubleshooting$hlp$, NULL, NULL, $hlp$internal$hlp$, 5, 1, true),
($hlp$ats$hlp$, $hlp$gerar-briefing-diario$hlp$, $hlp$Gerar o briefing diário$hlp$, $hlp$Resumo por IA com prioridades, riscos e recomendações.$hlp$, $hlp$# Gerar o briefing diário
**Para que serve:** Saber o que priorizar hoje no recrutamento.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Inteligência (IA) > Briefing diário (`/briefing`).
**Antes de começar:** Nenhum. Na primeira visita o briefing é gerado sozinho.

## Passo a passo
1. Abra "Briefing diário".
2. Leia "Resumo", "Prioridades", "Riscos" e "Recomendações".
3. Para atualizar, clique em "Gerar novo briefing".
<!-- screenshot: briefing diário -->

## Resultado esperado
"Briefing gerado." e o novo resumo na tela.

## Regras e limites
- Usa dados das últimas 24 horas e dos últimos 7 dias.
- "Stale (>14d)" conta candidaturas paradas há mais de 14 dias.
- A IA sugere; a decisão é sempre de uma pessoa.

## Erros comuns
- "AI Gateway: limite de requisições. Tente novamente em instantes.": aguarde e tente de novo.
- "AI Gateway: créditos esgotados. Adicione créditos no Workspace.": peça ao administrador para recarregar os créditos.
- "Falha ao gerar briefing": tente novamente.

## Relacionados
- [Usar o Recruiter Copilot](/ajuda/ats/usar-recruiter-copilot)$hlp$, $hlp$howto$hlp$, $hlp$/briefing$hlp$, NULL, $hlp$internal$hlp$, 11, 1, true),
($hlp$ats$hlp$, $hlp$gerar-notas-entrevista$hlp$, $hlp$Gerar notas de entrevista com IA$hlp$, $hlp$Criar resumo e recomendação a partir da transcrição.$hlp$, $hlp$# Gerar notas de entrevista com IA
**Para que serve:** Registrar a entrevista sem digitar tudo.
**Quem pode fazer:** Quem vê a entrevista e pode atualizar a avaliação. O servidor confere.
**Onde fica:** Menu > TechHire > Inteligência (IA) > Notetaker IA (`/notetaker`).
**Antes de começar:** Tenha a transcrição ou as anotações.

## Passo a passo
1. Em "Entrevista", escolha uma entrevista recente.
2. Cole o texto em "Transcrição / anotações".
3. Clique em "Gerar notas com IA".
4. Revise "Resumo", "Pontos fortes", "Preocupações" e "Follow-ups sugeridos".
<!-- screenshot: notetaker -->

## Resultado esperado
"Notas geradas pela IA."

## Regras e limites
- Transcrição de 40 a 60.000 caracteres.
- Recomendação: Forte contratação, Contratar, Neutro, Não contratar, Forte rejeição.
- A recomendação é sugestão; revise antes de decidir.

## Erros comuns
- "Transcrição muito curta — cole ao menos algumas frases.": complete o texto.
- "Créditos da IA esgotados. Adicione créditos em Workspace → Uso.": peça recarga.

## Relacionados
- [Gerenciar scorecards](/ajuda/ats/gerenciar-scorecards)$hlp$, $hlp$howto$hlp$, $hlp$/notetaker$hlp$, $hlp$techhire.interviews.view.own$hlp$, $hlp$internal$hlp$, 15, 1, true),
($hlp$ats$hlp$, $hlp$gerenciar-candidatos$hlp$, $hlp$Gerenciar candidatos$hlp$, $hlp$Listar, filtrar, cadastrar, importar e exportar candidatos.$hlp$, $hlp$# Gerenciar candidatos
**Para que serve:** Manter o banco de talentos.
**Quem pode fazer:** Quem tem `techhire.candidates.view` (own, team ou workspace). Criar exige `techhire.candidates.create`. Exportar exige `techhire.candidates.export.workspace`. Excluir depende da permissão sobre o registro.
**Onde fica:** Menu > TechHire > Recrutamento > Candidatos (`/candidates`).
**Antes de começar:** Tenha o nome do candidato. Para importar, tenha a URL do LinkedIn ou o currículo.

## Passo a passo
1. Use a busca "Buscar por nome, email, cargo ou skill…" e escolha a visualização (cartões, tabela ou kanban).
2. Clique em "Novo candidato".
3. Em "Como deseja cadastrar o candidato?", escolha "Preencher manualmente", "Importar do LinkedIn" ou "Extrair de um CV (PDF)".
4. Manual: preencha "Nome *" e os demais campos e salve.
5. LinkedIn: informe "URL do perfil no LinkedIn" e clique em "Buscar perfil". Revise e salve.
6. CV: anexe o PDF ou use "Cole o texto do currículo" e clique em "Extrair e salvar".
7. Para exportar, clique em "CSV".
<!-- screenshot: lista de candidatos -->

## Resultado esperado
"Candidato salvo" ou "Candidato criado a partir do CV".

## Regras e limites
- Nome é obrigatório (até 200 caracteres).
- A URL do LinkedIn precisa ter /in/.
- Texto do CV: de 40 a 20.000 caracteres; PDF até 15 MB.
- A lista mostra até 300; o CSV exporta até 5.000.
- No kanban, só é possível mover para "Em processo" um candidato associado a uma vaga.
- Excluir pede confirmação: "Excluir este candidato?".

## Erros comuns
- "Informe o nome": preencha o nome.
- "URL inválida. Use o formato https://linkedin.com/in/usuario": corrija a URL.
- "Envie um PDF ou cole o texto do currículo (mínimo 40 caracteres)": complete o currículo.

## Relacionados
- [Editar a ficha do candidato](/ajuda/ats/editar-ficha-candidato)
- [Buscar perfis no LinkedIn](/ajuda/ats/buscar-perfis-linkedin)$hlp$, $hlp$howto$hlp$, $hlp$/candidates$hlp$, $hlp$techhire.candidates.view.own$hlp$, $hlp$internal$hlp$, 20, 1, true),
($hlp$ats$hlp$, $hlp$gerenciar-indicacoes$hlp$, $hlp$Gerenciar indicações$hlp$, $hlp$Registrar indicações, programas de bônus e ranking.$hlp$, $hlp$# Gerenciar indicações
**Para que serve:** Trazer candidatos por indicação.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Sourcing > Indicações (`/sourcing/referrals`).
**Antes de começar:** Para bônus, crie um programa.

## Passo a passo
1. Na aba "Indicações", clique em "Nova indicação".
2. Preencha "Nome do candidato *" e, se quiser, "Email", "Telefone", "LinkedIn", "Relacionamento" e "Por que recomenda?".
3. Clique em "Enviar indicação".
4. Na aba "Programas", clique em "Novo programa" e preencha "Nome *", "Bônus (centavos)", "Moeda" e "URL dos termos".
5. Configure o portal público e use "Copiar link".
6. Veja a aba "Ranking".
<!-- screenshot: indicações -->

## Resultado esperado
"Indicação enviada" ou "Programa criado".

## Regras e limites
- Mudar status ou bônus salva na hora, sem confirmação.
- Slug do portal: 3 a 40 caracteres, só letras minúsculas, números e hífen.
- Os status das indicações ainda aparecem em inglês.

## Erros comuns
- Botão desabilitado: preencha o nome.

## Relacionados
- [Gerenciar candidatos](/ajuda/ats/gerenciar-candidatos)$hlp$, $hlp$howto$hlp$, $hlp$/sourcing/referrals$hlp$, NULL, $hlp$internal$hlp$, 63, 1, true),
($hlp$ats$hlp$, $hlp$gerenciar-kits-entrevista$hlp$, $hlp$Gerenciar kits de entrevista$hlp$, $hlp$Montar conjuntos reutilizáveis de perguntas.$hlp$, $hlp$# Gerenciar kits de entrevista
**Para que serve:** Padronizar entrevistas.
**Quem pode fazer:** Ver exige `techhire.interview_kits.view`. Criar ou duplicar exige `.create`. Marcar padrão exige `.view.workspace` e `.update.workspace`. Editar e excluir dependem da permissão sobre o kit.
**Onde fica:** Menu > TechHire > Recrutamento > Kits de Entrevista (`/interview-kits`).
**Antes de começar:** Prepare as perguntas.

## Passo a passo
1. Clique em "Novo kit".
2. Preencha "Nome do kit" e marque "Kit padrão", se quiser.
3. Em "Perguntas", clique em "Adicionar". Escolha "Texto" ou "Vídeo".
4. No vídeo, informe o tempo em segundos.
5. Clique em "Salvar".
6. Use "Duplicar", "Desativar"/"Ativar" ou a lixeira na lista.
<!-- screenshot: kits de entrevista -->

## Resultado esperado
"Kit salvo".

## Regras e limites
- De 1 a 30 perguntas; cada uma até 2.000 caracteres.
- Vídeo: 15 a 600 segundos.
- Excluir pede confirmação: "Excluir este kit?".

## Erros comuns
- "Dê um nome ao kit": preencha o nome.
- "Preencha o texto de todas as perguntas": complete as perguntas.

## Relacionados
- [Gerenciar scorecards](/ajuda/ats/gerenciar-scorecards)$hlp$, $hlp$howto$hlp$, $hlp$/interview-kits$hlp$, $hlp$techhire.interview_kits.view.own$hlp$, $hlp$internal$hlp$, 30, 1, true),
($hlp$ats$hlp$, $hlp$gerenciar-ofertas$hlp$, $hlp$Gerenciar ofertas$hlp$, $hlp$Aprovar, enviar para assinatura, cancelar e excluir ofertas.$hlp$, $hlp$# Gerenciar ofertas
**Para que serve:** Formalizar a proposta ao candidato.
**Quem pode fazer:** Quem vê ofertas. Enviar, cancelar e excluir dependem da permissão sobre a oferta.
**Onde fica:** Menu > TechHire > Contratação > Ofertas (`/offers`).
**Antes de começar:** A oferta precisa estar aprovada para envio.

## Passo a passo
1. Revise "Salário" e "Início".
2. Na aprovação, escreva o "Parecer da aprovação" e clique em "Aprovar versão" ou "Reprovar".
3. Envie a oferta aprovada para assinatura.
4. Para copiar o link, use a ação de link.
5. Para cancelar, use "Cancelar oferta" e confirme.
<!-- screenshot: ofertas -->

## Resultado esperado
"Oferta disponível para assinatura. O envio por e-mail deve ser realizado pelo canal configurado."

## Regras e limites
- Status: Rascunho, Para assinatura, Assinada, Recusada, Cancelada.
- Alterar as condições exige nova aprovação.
- Só rascunhos sem aprovação pedida podem ser excluídos.
- Excluir pede: "Excluir definitivamente?".

## Erros comuns
- "Falha na aprovação": confira sua permissão.
- "Não foi possível copiar": copie manualmente.

## Relacionados
- [Editar a ficha do candidato](/ajuda/ats/editar-ficha-candidato)$hlp$, $hlp$howto$hlp$, $hlp$/offers$hlp$, $hlp$techhire.offers.view.own$hlp$, $hlp$internal$hlp$, 50, 1, true),
($hlp$ats$hlp$, $hlp$gerenciar-scorecards$hlp$, $hlp$Gerenciar scorecards$hlp$, $hlp$Criar modelos de avaliação com critérios e pesos.$hlp$, $hlp$# Gerenciar scorecards
**Para que serve:** Avaliar candidatos de forma comparável.
**Quem pode fazer:** Ver exige `techhire.scorecards.view`. Criar exige `.create`. Editar depende da permissão sobre o scorecard.
**Onde fica:** Menu > TechHire > Recrutamento > Scorecards (`/scorecards`).
**Antes de começar:** Defina os critérios.

## Passo a passo
1. Clique em "Novo scorecard".
2. Preencha "Nome" e "Descrição".
3. Em "Critérios (escala 0–5)", clique em "Critério" para adicionar e defina chave, rótulo e peso.
4. Clique em "Salvar".
<!-- screenshot: scorecards -->

## Resultado esperado
"Scorecard salvo".

## Regras e limites
- De 1 a 20 critérios; peso de 0,1 a 10.
- Notas de 0 a 5.
- Excluir pede: "Excluir scorecard?".

## Erros comuns
- "Informe nome e ao menos um critério": complete o formulário.

## Relacionados
- [Gerenciar kits de entrevista](/ajuda/ats/gerenciar-kits-entrevista)$hlp$, $hlp$howto$hlp$, $hlp$/scorecards$hlp$, $hlp$techhire.scorecards.view.own$hlp$, $hlp$internal$hlp$, 33, 1, true),
($hlp$ats$hlp$, $hlp$gerenciar-talent-pools$hlp$, $hlp$Gerenciar talent pools$hlp$, $hlp$Agrupar candidatos por interesse ou stack.$hlp$, $hlp$# Gerenciar talent pools
**Para que serve:** Manter grupos de talentos para vagas futuras.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Sourcing > Talent Pools (`/sourcing/pools`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Clique em "Novo pool".
2. Preencha "Nome" e "Descrição".
3. Em "Tipo", escolha "Estático — adicionar manualmente".
4. Clique em "Criar pool".
<!-- screenshot: talent pools -->

## Resultado esperado
"Pool criado".

## Regras e limites
- Nome até 120 e descrição até 500 caracteres.
- O tipo "Smart" ainda está marcado como "em breve".

## Erros comuns
- Botão desabilitado: preencha o nome.

## Relacionados
- [Editar a ficha do candidato](/ajuda/ats/editar-ficha-candidato)$hlp$, $hlp$howto$hlp$, $hlp$/sourcing/pools$hlp$, NULL, $hlp$internal$hlp$, 62, 1, true),
($hlp$ats$hlp$, $hlp$gerenciar-templates-hunting$hlp$, $hlp$Gerenciar templates de hunting$hlp$, $hlp$Criar mensagens do LinkedIn com variáveis.$hlp$, $hlp$# Gerenciar templates de hunting
**Para que serve:** Padronizar a primeira abordagem.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Hunting (LinkedIn) > Templates (`/hunting/templates`).
**Antes de começar:** Prepare o texto.

## Passo a passo
1. Clique em "Novo template".
2. Preencha "Nome" e escolha "Canal": "Mensagem direta", "InMail" ou "Pedido de conexão".
3. No InMail, preencha "Assunto (InMail)", se quiser.
4. Escreva a "Mensagem" com variáveis como {{primeiro_nome}}.
5. Clique em "Salvar".
6. Para remover, use a lixeira e confirme.
<!-- screenshot: templates de hunting -->

## Resultado esperado
"Template salvo".

## Regras e limites
- Nome até 120 e mensagem até 8.000 caracteres.
- Referência: InMail ~1.900 e convite 300 caracteres.
- Variáveis: {{nome}}, {{primeiro_nome}}, {{empresa_atual}}, {{cargo_atual}}, {{localizacao}}, {{vaga}}, {{vaga_local}}.

## Erros comuns
- "Você não tem permissão para excluir este modelo de hunting.": peça ao dono ou admin.

## Relacionados
- [Buscar perfis no LinkedIn](/ajuda/ats/buscar-perfis-linkedin)$hlp$, $hlp$howto$hlp$, $hlp$/hunting/templates$hlp$, NULL, $hlp$internal$hlp$, 43, 1, true),
($hlp$ats$hlp$, $hlp$gerenciar-vagas$hlp$, $hlp$Gerenciar vagas$hlp$, $hlp$Criar, filtrar e mover vagas entre status.$hlp$, $hlp$# Gerenciar vagas
**Para que serve:** Abrir e acompanhar as vagas.
**Quem pode fazer:** Quem vê vagas. Criar exige `techhire.jobs.create`. Publicar exige `techhire.jobs.publish.workspace`. Exportar exige `techhire.jobs.export.workspace`.
**Onde fica:** Menu > TechHire > Recrutamento > Vagas (`/jobs`).
**Antes de começar:** Tenha um pipeline de recrutamento.

## Passo a passo
1. Busque em "Buscar por título, departamento ou local…" ou filtre por "Pipeline".
2. Clique em "Nova vaga".
3. Preencha "Título *" e, se quiser, "Senioridade", "Vínculo", "Modalidade", "Localização", "Descrição", "Requisitos", "Status", "Pipeline" e "Negócio (opcional)".
4. Clique em "Criar vaga".
5. Para mudar o status, arraste a vaga ou use a alteração em lote.
<!-- screenshot: lista de vagas -->

## Resultado esperado
"Vaga criada".

## Regras e limites
- Status: Rascunho, Publicada, Em pausa, Preenchida, Encerrada.
- Título até 200; descrição até 20.000 caracteres.
- A lista mostra até 200 vagas.

## Erros comuns
- "Informe o título da vaga": preencha o título.
- "Falha ao mover vaga": confira sua permissão.

## Relacionados
- [Acompanhar uma vaga](/ajuda/ats/acompanhar-vaga)
- [Configurar pipelines](/ajuda/ats/configurar-pipelines)$hlp$, $hlp$howto$hlp$, $hlp$/jobs$hlp$, $hlp$techhire.jobs.view.own$hlp$, $hlp$internal$hlp$, 22, 1, true),
($hlp$ats$hlp$, $hlp$indicar-talento-por-link-publico$hlp$, $hlp$Indicar talento por link público$hlp$, $hlp$Indicar talento por link público.$hlp$, $hlp$# Indicar talento por link público

**Para que serve:** Indicar talento por link público, no contexto da tela `/refer/$slug`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/refer/$slug`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o link de indicação.
2. Preencha os dados solicitados no formulário.
3. Confira o resultado do envio.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Indicação do TechHire; não é criação direta de pessoa no TechPeople.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /refer/$slug com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/refer/$slug$hlp$, NULL, $hlp$internal$hlp$, 207, 1, true),
($hlp$ats$hlp$, $hlp$instalar-extensao-hunter$hlp$, $hlp$Instalar a extensão TechHire Hunter$hlp$, $hlp$Instalar e parear a extensão legada do navegador.$hlp$, $hlp$# Instalar a extensão TechHire Hunter
**Para que serve:** Capturar perfis direto do navegador (fluxo legado).
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Hunting > Hub > "Instalar extensão (legado)" (`/hunting/install`).
**Antes de começar:** Use Chrome 120+, Edge 120+ ou Brave.

## Passo a passo
1. Baixe "techhire-hunter.zip" e descompacte.
2. No navegador, ative o modo do desenvolvedor e carregue a pasta sem compactação.
3. No painel "Status do pareamento", clique em "Parear agora".
4. Clique em "Verificar novamente" para conferir.
<!-- screenshot: instalar extensão -->

## Resultado esperado
O status muda para "Pareado".

## Regras e limites
- Status possíveis: Verificando, Não instalada, Pendente, Pareado, Falhou.
- A extensão é legada; prefira a busca pelo LinkedIn.

## Erros comuns
- "Download falhou": tente de novo.
- Status "Falhou": clique em "Tentar novamente".

## Relacionados
- [Buscar perfis no LinkedIn](/ajuda/ats/buscar-perfis-linkedin)$hlp$, $hlp$howto$hlp$, $hlp$/hunting/install$hlp$, NULL, $hlp$internal$hlp$, 45, 1, true),
($hlp$ats$hlp$, $hlp$organizar-agendamento-entrevistas$hlp$, $hlp$Organizar o agendamento de entrevistas$hlp$, $hlp$Pools de entrevistadores, disponibilidade e horários em comum.$hlp$, $hlp$# Organizar o agendamento de entrevistas
**Para que serve:** Distribuir entrevistas e achar horários.
**Quem pode fazer:** Quem tem acesso a entrevistas ou pools. Criar pool exige `techhire.interviewer_pools.create`.
**Onde fica:** Menu > TechHire > Recrutamento > Scheduling (`/scheduling`).
**Antes de começar:** Cadastre os entrevistadores.

## Passo a passo
1. Em "Pools de entrevistadores", preencha "Nome da pool" e "Estratégia" ("Round-robin" ou "Balanceada (por carga)") e clique em "Criar pool".
2. Use "Adicionar membro…" e "Atribuir próximo".
3. Em "Disponibilidade semanal", clique em "Nova janela" e informe "Entrevistador", "Dia", "Início" e "Fim".
4. Em "Encontrar slots em comum", escolha os entrevistadores, "De", "Até", "Duração (min)" e "Passo (min)".
<!-- screenshot: scheduling -->

## Resultado esperado
"Pool criada" ou "Janela adicionada".

## Regras e limites
- Busca de 1 a 8 entrevistadores.
- Duração de 15 a 240 minutos.
- O fim precisa ser depois do início.

## Erros comuns
- "Escolha um entrevistador": selecione alguém.
- "Fim deve ser após início": corrija o horário.
- "Nenhum slot em comum encontrado": amplie o período.

## Relacionados
- [Gerenciar kits de entrevista](/ajuda/ats/gerenciar-kits-entrevista)$hlp$, $hlp$howto$hlp$, $hlp$/scheduling$hlp$, $hlp$techhire.interviews.view.own$hlp$, $hlp$internal$hlp$, 32, 1, true),
($hlp$ats$hlp$, $hlp$perguntas-frequentes$hlp$, $hlp$Perguntas frequentes do TechHire$hlp$, $hlp$Dúvidas comuns sobre o TechHire.$hlp$, $hlp$# Perguntas frequentes do TechHire

**A IA decide quem contratar?** Não. Briefing, Copilot, Match Scores e Notetaker só sugerem.

**Contratar no TechHire cria a pessoa no TechPeople?** Sim, pela ação "Contratar" na ficha do candidato.

**O multi-posting já publica nos sites?** LinkedIn possui caminho de publicação real, condicionado à conta e à configuração. Indeed e Vagas.com ainda usam retorno simulado. Confira o destino externo antes de considerar a vaga publicada.

**Anonimizar pode ser desfeito?** Não.

## Relacionados

- [Visão geral](/ajuda/ats/visao-geral)$hlp$, $hlp$faq$hlp$, NULL, NULL, $hlp$internal$hlp$, 6, 2, true),
($hlp$ats$hlp$, $hlp$permissoes$hlp$, $hlp$Permissões do TechHire$hlp$, $hlp$Quem vê, cria, edita e exclui em cada tela.$hlp$, $hlp$# Permissões do TechHire

| Tela | Ver | Criar | Outras ações |
|---|---|---|---|
| Candidatos | `techhire.candidates.view` | `techhire.candidates.create` | Exportar: `.export.workspace`; Atribuir: `.assign.workspace` |
| Vagas | `techhire.jobs.view` | `techhire.jobs.create` | Publicar: `.publish.workspace`; Exportar: `.export.workspace` |
| Pipelines | `techhire.pipelines.view` | `.create` | Padrão: `.update.workspace` |
| Scorecards | `techhire.scorecards.view` | `.create` | Editar e excluir por registro |
| Kits de entrevista | `techhire.interview_kits.view` | `.create` | Padrão: `.update.workspace` |
| Scheduling | `techhire.interviews` / `interviewer_pools` | Pool: `.create` | — |
| Ofertas | `techhire.offers` | — | Enviar, cancelar e excluir por registro |
| LGPD | `techhire.compliance.view` | `.create` | Exportar e anonimizar por registro |
| Contratar | — | `techpeople.people.create` | — |

Escopos: own (seus registros), team (do time) e workspace (todos). Deny sempre prevalece.

As telas de Hunting, Sourcing, E-mails por etapa e as de IA ainda não têm permissão própria: qualquer membro ativo com o módulo entra, e os dados ficam limitados ao workspace. Isso está registrado como divergência.

## Relacionados

- [Erros comuns](/ajuda/ats/erros-comuns)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 4, 1, true),
($hlp$ats$hlp$, $hlp$primeiros-15-minutos$hlp$, $hlp$Primeiros 15 minutos no TechHire$hlp$, $hlp$Roteiro rápido para começar a recrutar.$hlp$, $hlp$# Primeiros 15 minutos no TechHire

1. Abra **Pipelines** e confira o funil padrão. Veja [Configurar pipelines](/ajuda/ats/configurar-pipelines).
2. Abra **Vagas** e clique em "Nova vaga". Veja [Gerenciar vagas](/ajuda/ats/gerenciar-vagas).
3. Abra **Candidatos** e clique em "Novo candidato". Veja [Gerenciar candidatos](/ajuda/ats/gerenciar-candidatos).
4. Na vaga, clique em "Adicionar candidato" e mova pelas etapas.
5. Crie um **Scorecard** para avaliar entrevistas.
6. Acompanhe tudo no **Dashboard**.

## Relacionados

- [Visão geral](/ajuda/ats/visao-geral)$hlp$, $hlp$quickstart$hlp$, $hlp$/ats-dashboard$hlp$, NULL, $hlp$internal$hlp$, 2, 1, true),
($hlp$ats$hlp$, $hlp$revisar-flags-de-risco$hlp$, $hlp$Revisar flags de risco$hlp$, $hlp$Encontrar duplicatas, CVs suspeitos e sinais de fraude.$hlp$, $hlp$# Revisar flags de risco
**Para que serve:** Evitar cadastros duplicados ou suspeitos.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Inteligência (IA) > Flags de risco (`/fraud-flags`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Clique em "Rodar scan agora".
2. Revise as colunas "Candidato", "Tipo", "Severidade" e "Status".
3. Depois de tratar, clique em "Marcar resolvido".
<!-- screenshot: flags de risco -->

## Resultado esperado
O status passa de "Aberto" para "Resolvido".

## Regras e limites
- O scan analisa até 2.000 candidatos.
- A lista mostra até 500 flags.
- Uma flag é um alerta, não uma conclusão.

## Erros comuns
- "Sem flags. Rode um scan.": ainda não houve análise.

## Relacionados
- [Gerenciar candidatos](/ajuda/ats/gerenciar-candidatos)$hlp$, $hlp$howto$hlp$, $hlp$/fraud-flags$hlp$, NULL, $hlp$internal$hlp$, 13, 1, true),
($hlp$ats$hlp$, $hlp$tratar-candidatos-capturados$hlp$, $hlp$Tratar candidatos capturados$hlp$, $hlp$Enriquecer capturas com IA e definir responsável.$hlp$, $hlp$# Tratar candidatos capturados
**Para que serve:** Completar e distribuir os perfis capturados.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace. Mudar o responsável exige permissão sobre os candidatos.
**Onde fica:** Menu > TechHire > Hunting (LinkedIn) > Capturados (`/hunting/captures`).
**Antes de começar:** Tenha capturas recentes.

## Passo a passo
1. Filtre por "Responsável", se quiser.
2. Marque as linhas ou "Selecionar todos".
3. Clique em "Enriquecer com IA (n)".
4. Para distribuir, use "Definir responsável" e escolha um membro ou "Sem responsável".
<!-- screenshot: candidatos capturados -->

## Resultado esperado
Aparece "Enriquecidos: N · falhas: N" ou "Responsável atualizado em N candidato(s).".

## Regras e limites
- Mostra as 100 capturas mais recentes.
- Enriquece até 20 por vez.
- Define responsável para até 200 por vez, sem confirmação.

## Erros comuns
- "Você não tem permissão para alterar o responsável destes candidatos.": peça acesso.
- "Captura e candidato pertencem a empresas diferentes.": a captura é de outro workspace.

## Relacionados
- [Usar o hub de hunting](/ajuda/ats/usar-hub-de-hunting)$hlp$, $hlp$howto$hlp$, $hlp$/hunting/captures$hlp$, NULL, $hlp$internal$hlp$, 41, 1, true),
($hlp$ats$hlp$, $hlp$tratar-solicitacoes-lgpd$hlp$, $hlp$Tratar solicitações LGPD (DSAR)$hlp$, $hlp$Registrar pedidos de titulares, exportar, anonimizar e revisar retenção.$hlp$, $hlp$# Tratar solicitações LGPD (DSAR)
**Para que serve:** Cumprir pedidos de titulares de dados.
**Quem pode fazer:** Ver exige `techhire.compliance.view`. Registrar exige `techhire.compliance.create`. Exportar, anonimizar e rejeitar dependem da permissão sobre a solicitação; o banco confere.
**Onde fica:** Menu > TechHire > Compliance > LGPD & DSAR (`/compliance`).
**Antes de começar:** Tenha o ID do candidato (está na URL /candidates/...).

## Passo a passo
1. Na aba "Solicitações DSAR", clique em "Nova solicitação".
2. Em "Registrar DSAR", preencha "ID do candidato" e "Tipo de solicitação".
3. Se quiser, informe "E-mail do titular" e "Notas". Clique em "Registrar".
4. Para exportar, clique em "Baixar JSON".
5. Para anonimizar, clique em "Anonimizar", digite ANONIMIZAR e clique em "Confirmar".
6. Para recusar, clique em "Rejeitar".
7. Na aba "Retenção", revise os candidatos vencidos.
<!-- screenshot: registrar DSAR -->

## Resultado esperado
"Solicitação registrada", "Exportação concluída" ou "Candidato anonimizado".

## Regras e limites
- Tipos: Exportação de dados, Acesso aos dados, Exclusão / Anonimização, Retificação.
- Status: pendente, em andamento, concluída, rejeitada.
- Anonimizar não pode ser desfeito.
- Notas até 2.000 caracteres. Lista até 200 solicitações e 500 retenções.

## Erros comuns
- Confirmar desabilitado: digite exatamente ANONIMIZAR.
- ID inválido: copie o identificador da URL do candidato.

## Relacionados
- [Editar a ficha do candidato](/ajuda/ats/editar-ficha-candidato)$hlp$, $hlp$howto$hlp$, $hlp$/compliance$hlp$, $hlp$techhire.compliance.view.own$hlp$, $hlp$internal$hlp$, 90, 1, true),
($hlp$ats$hlp$, $hlp$triar-inbox-sourcing$hlp$, $hlp$Triar a inbox de sourcing$hlp$, $hlp$Tratar tarefas manuais, falhas e respostas.$hlp$, $hlp$# Triar a inbox de sourcing
**Para que serve:** Não deixar candidato sem retorno.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Sourcing > Inbox (`/sourcing/inbox`).
**Antes de começar:** Tenha sequências em andamento.

## Passo a passo
1. Na aba "Tarefas manuais", faça a tarefa e clique em "Concluí". Se o candidato respondeu, clique em "Respondeu".
2. Na aba "Falhas", clique em "Retomar" ou "Encerrar".
3. Na aba "Aguardando decisão", decida entre "Retomar" e "Encerrar".
<!-- screenshot: inbox de sourcing -->

## Resultado esperado
"Tarefa marcada como concluída", "Sequência retomada" ou "Sequência encerrada".

## Regras e limites
- Atenção: hoje "Pausar" encerra a inscrição em vez de pausar. Use só se quiser tirar o candidato da sequência.
- Mostra até 200 itens.

## Erros comuns
- "Enrollment não encontrado": a inscrição já foi encerrada.

## Relacionados
- [Criar sequências de outreach](/ajuda/ats/criar-sequencias-outreach)$hlp$, $hlp$howto$hlp$, $hlp$/sourcing/inbox$hlp$, NULL, $hlp$internal$hlp$, 61, 1, true),
($hlp$ats$hlp$, $hlp$usar-hub-de-hunting$hlp$, $hlp$Usar o hub de hunting$hlp$, $hlp$Ponto de entrada da busca no LinkedIn e das capturas.$hlp$, $hlp$# Usar o hub de hunting
**Para que serve:** Chegar rápido às ferramentas de hunting.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Hunting (LinkedIn) > Hub (`/hunting`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Veja "Capturados hoje", "Últimos 7 dias" e "Total no banco".
2. Escolha "Buscar no LinkedIn", "Capturados", "Execuções & métricas" ou "Templates de mensagem".
<!-- screenshot: hub de hunting -->

## Resultado esperado
Você abre a ferramenta escolhida.

## Regras e limites
- "Instalar extensão (legado)" leva ao fluxo antigo da extensão.

## Erros comuns
- Números zerados: ainda não há capturas.

## Relacionados
- [Buscar perfis no LinkedIn](/ajuda/ats/buscar-perfis-linkedin)
- [Tratar candidatos capturados](/ajuda/ats/tratar-candidatos-capturados)$hlp$, $hlp$howto$hlp$, $hlp$/hunting$hlp$, NULL, $hlp$internal$hlp$, 40, 1, true),
($hlp$ats$hlp$, $hlp$usar-recruiter-copilot$hlp$, $hlp$Usar o Recruiter Copilot$hlp$, $hlp$Perguntar à IA sobre vagas, funil, fontes e ofertas.$hlp$, $hlp$# Usar o Recruiter Copilot
**Para que serve:** Tirar dúvidas rápidas sobre o recrutamento.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Inteligência (IA) > Recruiter Copilot (`/copilot`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Clique em uma sugestão, como "Onde está o maior gargalo do funil?".
2. Ou escreva sua pergunta e envie.
3. Aguarde "Pensando..." e leia a resposta.
<!-- screenshot: recruiter copilot -->

## Resultado esperado
A resposta aparece na conversa.

## Regras e limites
- Considera os últimos 90 dias.
- Pergunta de 2 a 2.000 caracteres.
- A IA apoia; não decide sozinha.

## Erros comuns
- "AI Gateway: limite de requisições. Tente novamente em instantes.": aguarde e tente de novo.
- "AI Gateway: créditos esgotados. Adicione créditos no Workspace.": peça ao administrador para recarregar os créditos.
- "Falha ao consultar IA": tente novamente.

## Relacionados
- [Gerar o briefing diário](/ajuda/ats/gerar-briefing-diario)$hlp$, $hlp$howto$hlp$, $hlp$/copilot$hlp$, NULL, $hlp$internal$hlp$, 12, 1, true),
($hlp$ats$hlp$, $hlp$usar-sourcing$hlp$, $hlp$Usar o Sourcing & Talent CRM$hlp$, $hlp$Ponto de entrada do relacionamento com candidatos.$hlp$, $hlp$# Usar o Sourcing & Talent CRM
**Para que serve:** Chegar às ferramentas de sourcing.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Endereço `/sourcing` (sem item próprio no menu; use o grupo Sourcing).
**Antes de começar:** Nenhum.

## Passo a passo
1. Escolha "Inbox", "Talent Pools", "Sequências", "Indicações" ou "Analytics".
<!-- screenshot: sourcing -->

## Resultado esperado
A ferramenta escolhida abre.

## Regras e limites
- Multi-posting fica só no menu Sourcing.

## Erros comuns
- Não encontrou a tela: use o menu Sourcing.

## Relacionados
- [Triar a inbox de sourcing](/ajuda/ats/triar-inbox-sourcing)$hlp$, $hlp$howto$hlp$, $hlp$/sourcing$hlp$, NULL, $hlp$internal$hlp$, 60, 1, true),
($hlp$ats$hlp$, $hlp$validar-um-perfil-de-vaga-pelo-link$hlp$, $hlp$Validar um perfil de vaga pelo link$hlp$, $hlp$Validar um perfil de vaga pelo link.$hlp$, $hlp$# Validar um perfil de vaga pelo link

**Para que serve:** Validar um perfil de vaga pelo link, no contexto da tela `/role-profile/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/role-profile/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link recebido.
2. Leia o perfil de vaga.
3. Use os controles de validação disponíveis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Validação de perfil do recrutamento não é edição do cadastro compartilhado de cargos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /role-profile/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/role-profile/$token$hlp$, NULL, $hlp$internal$hlp$, 210, 1, true),
($hlp$ats$hlp$, $hlp$visao-geral$hlp$, $hlp$Visão geral do TechHire$hlp$, $hlp$Para que serve o TechHire, quem usa e o mapa das telas.$hlp$, $hlp$# Visão geral do TechHire

O TechHire é o módulo de recrutamento do TechERP: vagas, candidatos, entrevistas, ofertas, hunting no LinkedIn e sourcing.

## Quem usa

- **Recrutadores:** vagas, candidatos, entrevistas e hunting.
- **Gestores:** pipelines, scorecards, insights e aprovação de ofertas.
- **Compliance:** solicitações LGPD.

## Mapa das telas (menu lateral)

| Grupo | Telas |
|---|---|
| Visão geral | Dashboard |
| Recrutamento | Candidatos, Vagas, Pipelines, Scheduling, Scorecards, Kits de Entrevista |
| Sourcing | Inbox, Talent Pools, Sequências, Indicações, Analytics, Multi-posting |
| Hunting (LinkedIn) | Hub, Buscar perfis, Capturados, Templates, Observabilidade |
| Contratação | Ofertas |
| Comunicação | E-mails por etapa |
| Inteligência (IA) | Briefing diário, Recruiter Copilot, Flags de risco, Match Scores, Notetaker IA |
| Análise | Insights ATS, DEI Analytics |
| Compliance | LGPD & DSAR |

## Como se conecta aos outros módulos

- **Contratar** um candidato cria a pessoa no TechPeople.
- A vaga pode ser ligada a um **Negócio** do TechSales.

## Relacionados

- [Primeiros 15 minutos](/ajuda/ats/primeiros-15-minutos)
- [Permissões](/ajuda/ats/permissoes)$hlp$, $hlp$overview$hlp$, $hlp$/ats-dashboard$hlp$, NULL, $hlp$internal$hlp$, 1, 1, true)
ON CONFLICT (module_key, slug) DO NOTHING;
INSERT INTO public.help_articles
  (module_key, slug, title, summary, body_md, article_type, route_pattern, min_permission, audience, sort_order, version, is_published)
VALUES
($hlp$people$hlp$, $hlp$aceitar-acesso-pelo-vinculo-de-contratacao$hlp$, $hlp$Aceitar acesso pelo vínculo de contratação$hlp$, $hlp$Aceitar acesso pelo vínculo de contratação.$hlp$, $hlp$# Aceitar acesso pelo vínculo de contratação

**Para que serve:** Aceitar acesso pelo vínculo de contratação, no contexto da tela `/accept-employment/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/accept-employment/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link recebido.
2. Confira o vínculo e siga a ação de aceite apresentada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Acesso condicionado ao vínculo e à validação do token; não é cadastro aberto.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `people`; consulte os artigos desse módulo em `/ajuda/people`.

<!-- screenshot: capturar /accept-employment/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/accept-employment/$token$hlp$, NULL, $hlp$internal$hlp$, 189, 1, true),
($hlp$people$hlp$, $hlp$acompanhar-dashboard$hlp$, $hlp$Acompanhar o dashboard do TechPeople$hlp$, $hlp$Ver o quadro de pessoas, alocações, documentos e jornadas.$hlp$, $hlp$# Acompanhar o dashboard do TechPeople
**Para que serve:** Ter a visão geral do quadro e das jornadas internas.
**Quem pode fazer:** Membros ativos com o TechPeople. Os números respeitam o que você pode ver. Valores financeiros exigem `techpeople.allocations_financial.view`.
**Onde fica:** Menu > TechPeople > Visão geral > Dashboard (`/people/dashboard`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Abra a tela e confira "Pessoas ativas", "Alocações ativas", "Documentos a vencer" e "Margem de alocação".
2. Veja "Composição do quadro" e "Jornadas em andamento".
3. Clique em "Atualizar" para recarregar.
4. Use "Acessos rápidos" para ir a "Pessoas", "Onboarding" ou "Documentos".
<!-- screenshot: dashboard people -->

## Resultado esperado
Os indicadores aparecem conforme seu acesso.

## Regras e limites
- "Pessoas ativas" conta todos que não estão desligados nem arquivados.
- "Documentos a vencer" inclui vencidos e os dos próximos 30 dias.
- A margem estima 160 horas por mês vezes o percentual de alocação.
- Sem acesso financeiro, aparece "Restrito".
- Há uma inconsistência conhecida: planos cancelados podem entrar nos indicadores de jornadas em andamento e atrasadas. Confira o status na lista de Onboarding/Offboarding antes de usar esses totais.

## Erros comuns
- "Não foi possível carregar o dashboard": clique em "Tentar novamente".

## Relacionados
- [Visão geral](/ajuda/people/visao-geral)$hlp$, $hlp$howto$hlp$, $hlp$/people/dashboard$hlp$, NULL, $hlp$internal$hlp$, 5, 2, true),
($hlp$people$hlp$, $hlp$acompanhar-documentos$hlp$, $hlp$Acompanhar documentos a vencer$hlp$, $hlp$Monitorar documentos com validade nos próximos 60 dias ou vencidos.$hlp$, $hlp$# Acompanhar documentos a vencer
**Para que serve:** Ver certidões, contratos e documentos que vencem em até 60 dias ou já venceram.
**Quem pode fazer:** Quem tem `techpeople.documents.view` (ou é gestor). Responsável exige `techpeople.documents.update`; excluir, `techpeople.documents.delete`.
**Onde fica:** Menu > TechPeople > Pessoas > Documentos a vencer (`/people/documents`).
**Antes de começar:** O documento precisa ter validade preenchida na ficha da pessoa.

## Passo a passo
1. Escolha a aba "Todos", "A vencer" ou "Vencidos".
2. Clique no nome da pessoa para abrir a ficha.
3. Para ver o arquivo, clique no ícone "Baixar". Ele abre em nova aba.
4. Para ações em massa, marque as linhas e use "Exportar selecionados", "Responsável" ou "Excluir".
<!-- screenshot: documentos a vencer -->

## Resultado esperado
O arquivo abre em nova aba ou a ação em massa confirma o total.

## Regras e limites
- A lista traz até 200 documentos, do mais próximo de vencer ao mais distante.
- Pessoas arquivadas não aparecem.
- O status "A vencer" é marcado com 30 dias; por isso um documento da lista pode aparecer como "Válido".
- O link do arquivo vale 5 minutos.
- Excluir pede que você digite a quantidade de registros.

## Erros comuns
- "Documento sem arquivo": não há anexo.
- "Registro indisponível ou sem permissão para esta ação.": você não pode ver esse documento.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)$hlp$, $hlp$howto$hlp$, $hlp$/people/documents$hlp$, $hlp$techpeople.documents.view.own$hlp$, $hlp$internal$hlp$, 30, 1, true),
($hlp$people$hlp$, $hlp$acompanhar-offboarding$hlp$, $hlp$Acompanhar offboarding$hlp$, $hlp$Ver desligamentos e o checklist de compliance.$hlp$, $hlp$# Acompanhar offboarding
**Para que serve:** Acompanhar desligamentos e o checklist de saída.
**Quem pode fazer:** Quem tem `techpeople.offboarding.view` (own, team ou workspace).
**Onde fica:** Menu > TechPeople > Pessoas > Offboarding (`/people/offboarding`).
**Antes de começar:** O plano é iniciado na ficha da pessoa, aba "Onboarding · Desligamento".

## Passo a passo
1. Abra a tela.
2. Confira "Status", "Progresso", "Início" e "Alvo".
3. Clique em "Abrir" para ir à ficha.
<!-- screenshot: offboarding -->

## Resultado esperado
Você vê o andamento de cada desligamento.

## Regras e limites
- Mesmos status do onboarding. Concluídos e cancelados também aparecem.
- Tela só de consulta; as tarefas são marcadas na ficha.

## Erros comuns
- "Você não tem permissão para consultar esta tela.": falta `techpeople.offboarding.view`.

## Relacionados
- [Acompanhar onboarding](/ajuda/people/acompanhar-onboarding)$hlp$, $hlp$howto$hlp$, $hlp$/people/offboarding$hlp$, $hlp$techpeople.offboarding.view.own$hlp$, $hlp$internal$hlp$, 41, 1, true),
($hlp$people$hlp$, $hlp$acompanhar-onboarding$hlp$, $hlp$Acompanhar onboarding$hlp$, $hlp$Ver os planos de integração e o progresso de cada pessoa.$hlp$, $hlp$# Acompanhar onboarding
**Para que serve:** Ver o andamento da integração de quem entrou.
**Quem pode fazer:** Quem tem `techpeople.onboarding.view` (own, team ou workspace).
**Onde fica:** Menu > TechPeople > Pessoas > Onboarding (`/people/onboarding`).
**Antes de começar:** O plano é iniciado na ficha da pessoa, aba "Onboarding".

## Passo a passo
1. Abra a tela.
2. Confira "Status", "Progresso", "Início" e "Alvo".
3. Clique em "Abrir" para ir à ficha e marcar as tarefas.
<!-- screenshot: onboarding -->

## Resultado esperado
Você vê quanto do checklist já foi feito.

## Regras e limites
- Status: "Não iniciado", "Em andamento", "Concluído", "Cancelado".
- Planos concluídos e cancelados também aparecem.
- Tarefas feitas ou puladas contam no progresso.

## Erros comuns
- "Você não tem permissão para consultar esta tela.": falta `techpeople.onboarding.view`.
- "Nenhum onboarding em andamento": inicie um plano na ficha.

## Relacionados
- [Criar modelos de onboarding](/ajuda/people/criar-modelos-onboarding)
- [Acompanhar offboarding](/ajuda/people/acompanhar-offboarding)$hlp$, $hlp$howto$hlp$, $hlp$/people/onboarding$hlp$, $hlp$techpeople.onboarding.view.own$hlp$, $hlp$internal$hlp$, 40, 1, true),
($hlp$people$hlp$, $hlp$aprovar-horas-na-ficha$hlp$, $hlp$Aprovar e remover aprovação de horas na ficha$hlp$, $hlp$Decidir sobre apontamentos enviados e reabrir aprovações pelo timesheet.$hlp$, $hlp$# Aprovar e remover aprovação de horas na ficha

**Para que serve:** Decidir sobre apontamentos enviados e reabrir aprovações pelo timesheet.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. Aprovar depende de aprovador explícito no fluxo de TechProjects e das validações no banco; não há autoaprovação. A presença do botão não concede autorização.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Timesheet (`/people/$id`).
**Antes de começar:** O profissional precisa ter enviado o período no fluxo de timesheet; lançar horas na ficha não faz esse envio.

## Passo a passo
1. Ajuste o período e os filtros para localizar os apontamentos. Confira projeto, horas e situação antes de selecionar.
2. Marque as caixas das linhas desejadas ou a seleção de todas as linhas filtradas. Revise a seleção antes de mudar filtros.
3. Clique em "Aprovar" na barra de seleção. Aguarde a confirmação com a quantidade efetivamente aprovada.
4. Para reabrir, selecione os apontamentos aprovados e clique em "Remover aprovação". Aguarde a quantidade de aprovações removidas.
5. Confira novamente a situação das linhas e os totais; se o servidor recusar, corrija o envio ou a autorização em vez de repetir sem revisão.

## Resultado esperado
A tela apresenta a quantidade aprovada ou reaberta e atualiza as consultas.

## Regras e limites
- Aprovar aceita de 1 a 500 IDs; remover aprovação, de 1 a 200. Divida seleções maiores.
- O servidor busca itens de submissão com decisão pendente e envia a revisão para a decisão no banco. Não basta a linha não ter data de aprovação.
- Reabrir usa, neste painel, o motivo padrão "Aprovação reaberta pelo TechPeople"; não há campo de motivo nessa ação da ficha.
- A seleção é independente dos filtros: mudar filtros não limpa automaticamente os IDs já selecionados. Limpe a seleção e selecione novamente quando necessário.

## Erros comuns
- "Nenhum apontamento enviado para decisão: o profissional precisa enviar o período antes.": peça o envio antes de aprovar.
- Recusa do servidor: confira aprovador, revisão enviada e regras do período; visualizar a aba não basta.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/people/$id$hlp$, $hlp$techpeople.timesheet.view.own$hlp$, $hlp$internal$hlp$, 122, 1, true),
($hlp$people$hlp$, $hlp$campos-e-status$hlp$, $hlp$Campos e status do TechPeople$hlp$, $hlp$Significado dos status, vínculos e opções do módulo.$hlp$, $hlp$# Campos e status do TechPeople

## Pessoa
| Campo | Opções |
|---|---|
| Status | Ativo, Bench, Afastado, Em desligamento, Desligado |
| Vínculo | PJ, CLT, Terceiro, Estagiário, Outro |
| Senioridade | Estágio, Júnior, Pleno, Sênior, Especialista, Coordenação, Gerência |

## Planos de onboarding e offboarding
| Item | Status |
|---|---|
| Plano | Não iniciado, Em andamento, Concluído, Cancelado |
| Tarefa | Pendente, Em andamento, Concluída, Bloqueada, Ignorada |

## Documentos
Válido, A vencer, Vencido. A lista "Documentos a vencer" mostra os que vencem em até 60 dias.

## Saúde & segurança
| Item | Opções |
|---|---|
| Incidente – severidade | Baixa, Moderada, Alta, Crítica |
| Incidente – status | Aberto, Investigando, Resolvido, Arquivado |
| Avaliação psicossocial – risco | Baixo, Moderado, Alto, Crítico |
| Avaliação psicossocial – status | Aberta, Em andamento, Resolvida, Arquivada |

## Desempenho
| Item | Opções |
|---|---|
| Meta – tipo | KPI, OKR, Entrega |
| Meta – status | Rascunho, Ativa, Concluída, Cancelada |
| 1:1 – status | Agendada, Realizada, Não realizada, Cancelada |
| Avaliação – cadência | Mensal, Trimestral, Semestral, Anual, Pontual |

## Benefícios
Plano de saúde, Plano odontológico, Vale-refeição, Vale-alimentação, Vale-transporte, Seguro de vida, Gympass / academia, Educação, Auxílio-creche, Outro.

## Relacionados
- [Permissões](/ajuda/people/permissoes)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 3, 1, true),
($hlp$people$hlp$, $hlp$consultar-beneficios$hlp$, $hlp$Consultar benefícios e custos$hlp$, $hlp$Ver os benefícios ativos de todo o workspace e o total mensal.$hlp$, $hlp$# Consultar benefícios e custos
**Para que serve:** Ver todos os benefícios ativos e quanto custam por mês.
**Quem pode fazer:** Quem tem `techpeople.benefits.view` (ou é gestor). Editar exige `techpeople.benefits.update`; excluir, `techpeople.benefits.delete`.
**Onde fica:** Menu > TechPeople > Benefícios & custos > Benefícios (`/people/benefits`).
**Antes de começar:** Os benefícios são cadastrados na ficha da pessoa, aba "Benefícios".

## Passo a passo
1. Abra a tela. O topo mostra "Total mensal:".
2. Use "Buscar nesta lista…" ou clique no cabeçalho para ordenar.
3. Clique no nome em "Pessoa" para abrir a ficha.
4. Para alterar vários: marque as linhas, clique em "Editar em massa", marque "Provedor", "Plano" ou "Término", preencha e clique em "Aplicar".
5. Para exportar: "Exportar" e escolha CSV, JSON ou Excel (XLSX).
<!-- screenshot: benefícios -->

## Resultado esperado
"{N} registro(s) atualizado(s)" ou o arquivo exportado.

## Regras e limites
- Só aparecem benefícios ativos, até 500.
- "Total mensal:" soma o valor mensal; não desconta a "Cota empregado".
- Esta tela não cadastra benefício novo.

## Erros comuns
- "{alterados} de {selecionados} atualizado(s). Verifique suas permissões.": parte dos registros está fora do seu acesso.
- "Nenhum benefício ativo": cadastre na ficha da pessoa.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)$hlp$, $hlp$howto$hlp$, $hlp$/people/benefits$hlp$, $hlp$techpeople.benefits.view.own$hlp$, $hlp$internal$hlp$, 60, 1, true),
($hlp$people$hlp$, $hlp$consultar-margem-contrato$hlp$, $hlp$Consultar margem por contrato$hlp$, $hlp$Ver horas, receita, custo e margem de cada contrato no período.$hlp$, $hlp$# Consultar margem por contrato
**Para que serve:** Ver quanto cada contrato rende em horas, receita, custo e margem.
**Quem pode fazer:** Quem tem `techpeople.allocations.view` (ou é gestor) e pode ver os valores de todas as alocações (`techpeople.allocations_financial.view`).
**Onde fica:** Menu > TechPeople > Benefícios & custos > Margem por contrato (`/people/contract-margin`).
**Antes de começar:** Horas lançadas nas alocações.

## Passo a passo
1. Ajuste o "Período dos contratos" (padrão: início do mês até hoje).
2. Confira "Horas totais", "Receita", "Custo" e "Margem".
3. Na tabela "Contratos", clique no contrato para abri-lo.
<!-- screenshot: margem por contrato -->

## Resultado esperado
Cada contrato mostra pessoas, horas, receita, custo, margem e %.

## Regras e limites
- Entram todas as horas do período, aprovadas ou não.
- Receita = horas billable × tarifa (do apontamento ou da alocação).
- Custo = todas as horas × custo/hora da alocação.
- Não inclui impostos, despesas ou benefícios.
- Tela só de consulta.

## Erros comuns
- "Sem permissão para consultar os valores de todas as alocações do relatório.": peça acesso aos valores financeiros.

## Relacionados
- [Faturar horas aprovadas](/ajuda/people/faturar-horas)$hlp$, $hlp$howto$hlp$, $hlp$/people/contract-margin$hlp$, $hlp$techpeople.allocations.view.own$hlp$, $hlp$internal$hlp$, 82, 1, true),
($hlp$people$hlp$, $hlp$consultar-meu-time$hlp$, $hlp$Consultar meu time$hlp$, $hlp$Ver liderados diretos, horas, aprovações pendentes e documentos.$hlp$, $hlp$# Consultar meu time
**Para que serve:** O gestor vê os liderados diretos em uma tela.
**Quem pode fazer:** Membros ativos com o TechPeople que são gestores de alguém.
**Onde fica:** Menu > TechPeople > Pessoas > Meu time (`/people/my-team`).
**Antes de começar:** Seu usuário precisa estar ligado a uma pessoa, e você precisa ser o "Gestor" na alocação dos liderados.

## Passo a passo
1. Confira os cartões "Time", "Horas no mês", "Aprovação pendente" e "Docs a vencer (30d)".
2. Na tabela "Liderados", veja alocações, horas, "A aprovar", documentos e "Próxima 1:1".
3. Clique no nome para abrir a ficha e aprovar horas.
<!-- screenshot: meu time -->

## Resultado esperado
Você vê seus liderados e o que está pendente.

## Regras e limites
- Horas contam desde o primeiro dia do mês.
- Tela só de consulta.

## Erros comuns
- "Você ainda não tem liderados diretos cadastrados.": defina o gestor na ficha de cada pessoa.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)$hlp$, $hlp$howto$hlp$, $hlp$/people/my-team$hlp$, NULL, $hlp$internal$hlp$, 12, 1, true),
($hlp$people$hlp$, $hlp$consultar-riscos-psicossociais$hlp$, $hlp$Consultar riscos psicossociais$hlp$, $hlp$Ver avaliações psicossociais e sinais de risco de todo o workspace.$hlp$, $hlp$# Consultar riscos psicossociais
**Para que serve:** Ver avaliações e sinais de burnout ou assédio.
**Quem pode fazer:** Quem tem `techpeople.wellbeing.assessments.view` (ou é gestor). São dados sensíveis.
**Onde fica:** Menu > TechPeople > Saúde & segurança > Riscos psicossociais (`/people/psychosocial`).
**Antes de começar:** As avaliações são registradas na ficha da pessoa, aba "Psicossocial".

## Passo a passo
1. Em "Nível de risco", escolha "Todos os níveis", "Baixo", "Moderado", "Alto" ou "Crítico".
2. Confira "Data", "Risco", "Sinais", "Status" e "Follow-up".
3. Clique no nome da pessoa para abrir a ficha.
<!-- screenshot: riscos psicossociais -->

## Resultado esperado
A lista mostra as avaliações do nível escolhido.

## Regras e limites
- Até 200 avaliações, das mais recentes para as mais antigas.
- Status: "Aberta", "Em andamento", "Resolvida", "Arquivada".
- Tela só de consulta.

## Erros comuns
- "Nenhuma avaliação encontrada": registre na ficha da pessoa.

## Relacionados
- [Gerenciar incidentes](/ajuda/people/gerenciar-incidentes)$hlp$, $hlp$howto$hlp$, $hlp$/people/psychosocial$hlp$, $hlp$techpeople.wellbeing.assessments.view.own$hlp$, $hlp$internal$hlp$, 71, 1, true),
($hlp$people$hlp$, $hlp$criar-modelos-onboarding$hlp$, $hlp$Criar modelos de onboarding e offboarding$hlp$, $hlp$Montar checklists reutilizáveis de admissão e desligamento.$hlp$, $hlp$# Criar modelos de onboarding e offboarding
**Para que serve:** Definir as tarefas padrão aplicadas ao iniciar um plano.
**Quem pode fazer:** Ver: `techpeople.onboarding_templates.view`. Criar: `techpeople.onboarding_templates.create`. Editar e excluir são liberados por registro.
**Onde fica:** Menu > TechPeople > Pessoas > Modelos de onboarding (`/people/onboarding-templates`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Clique em "Novo modelo".
2. Preencha "Nome" e escolha o "Tipo": "Admissão" ou "Desligamento".
3. Se quiser, preencha "Cargo (opcional)", "Vínculo (opcional)" e "Descrição".
4. Deixe "Modelo ativo" ligado.
5. Em "Tarefas", clique em "Adicionar tarefa". Preencha "Título da tarefa", "Categoria" e "Dias" (prazo após o início do plano).
6. Clique em "Salvar".
<!-- screenshot: novo modelo -->

## Resultado esperado
"Modelo criado". Para editar, use o ícone "Editar modelo" ("Modelo atualizado").

## Regras e limites
- Nome de 2 a 200 caracteres; toda tarefa precisa de título.
- O modelo novo já vem com "Enviar documentação" (RH, 3 dias) e "Criar acessos (e-mail, ferramentas)" (TI, 1 dia).
- O ícone de alça sobe a tarefa uma posição.
- Use "Filtrar:" para ver "Todos", "Admissão" ou "Desligamento". Inativos aparecem com "Inativo".

## Erros comuns
- "Registro indisponível ou sem permissão para editar.": você não pode alterar esse modelo.
- Nome com 1 caractere: o botão salva, mas o servidor recusa.

## Relacionados
- [Acompanhar onboarding](/ajuda/people/acompanhar-onboarding)$hlp$, $hlp$howto$hlp$, $hlp$/people/onboarding-templates$hlp$, $hlp$techpeople.onboarding_templates.view.own$hlp$, $hlp$internal$hlp$, 42, 1, true),
($hlp$people$hlp$, $hlp$erros-comuns$hlp$, $hlp$Erros comuns no TechPeople$hlp$, $hlp$O que fazer quando algo não funciona.$hlp$, $hlp$# Erros comuns no TechPeople

| Mensagem | O que fazer |
|---|---|
| "Você não tem permissão para consultar esta tela." | Peça ao administrador a permissão de ver daquela tela. |
| "Pessoa indisponível ou sem acesso." | Você não pode ver essa pessoa. |
| "Registro indisponível ou sem permissão para esta ação." | Você não pode alterar esse registro. |
| "{alterados} de {selecionados} atualizado(s). Verifique suas permissões." | Parte da seleção está fora do seu acesso. |
| "Arquivo maior que 20 MB" | Reduza o arquivo do documento. |
| "Documento sem arquivo" | Anexe o arquivo na ficha. |
| "Nenhuma hora aprovada e disponível para faturamento." | Aprove as horas antes de faturar. |
| "Sem permissão para consultar os valores de todas as alocações do relatório." | Peça acesso aos valores financeiros das alocações. |
| "Falha ao baixar planilha" | Torne a planilha do Google pública com link. |
| Valor aparece como "—" ou "Restrito" | Falta acesso a dados financeiros. |

## Relacionados
- [Permissões](/ajuda/people/permissoes)
- [Perguntas frequentes](/ajuda/people/perguntas-frequentes)$hlp$, $hlp$troubleshooting$hlp$, NULL, NULL, $hlp$internal$hlp$, 5, 1, true),
($hlp$people$hlp$, $hlp$exportar-timesheet-na-ficha$hlp$, $hlp$Filtrar e exportar o timesheet da ficha$hlp$, $hlp$Baixar em CSV os apontamentos visíveis após os filtros da aba.$hlp$, $hlp$# Filtrar e exportar o timesheet da ficha

**Para que serve:** Baixar em CSV os apontamentos visíveis após os filtros da aba.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. O botão CSV usa os dados já carregados; não há chave de exportação específica nesse componente.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Timesheet (`/people/$id`).
**Antes de começar:** Abra a pessoa correta e tenha pelo menos uma linha no recorte desejado.

## Passo a passo
1. Escolha o período: semana, mês, últimos 30 dias, trimestre ou personalizado. Para personalizado, ajuste início e fim.
2. Aplique os filtros de projeto, aprovação e tipo faturável/interno. Confira a lista resultante.
3. Clique em "CSV" no cabeçalho de Apontamentos. Não é necessário selecionar caixas.
4. Abra o arquivo baixado como UTF-8, com separador ponto e vírgula. Confira datas, linhas e colunas antes de compartilhar.

## Resultado esperado
O navegador baixa um CSV cujo nome inclui o prefixo timesheet, parte do identificador da pessoa e o intervalo.

## Regras e limites
- A exportação considera todas as linhas filtradas, não apenas as selecionadas. CSV fica desabilitado sem linhas.
- O arquivo tem Data, Projeto, Tarefa, Descrição, Horas, Billable, Tarifa efetiva, Valor, Custo/h, Custo e Status.
- O CSV usa BOM UTF-8 e ponto e vírgula. Campos numéricos são serializados pelo código, não como moeda formatada.
- Na geração do CSV, tarifa ou custo ausentes são convertidos em zero. Isso não comprova tarifa gratuita nem custo efetivamente zero; confira as permissões e a origem dos valores.
- Os cartões de totais vêm do período carregado; os filtros locais de projeto/status/tipo recortam as linhas exportadas, não recalculam esses totais.

## Erros comuns
- CSV desabilitado: amplie o período ou remova filtros.
- Valores zero inesperados: confira se a tarifa/custo existe e está acessível; não use o arquivo como comprovação financeira sem revisão.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/people/$id$hlp$, $hlp$techpeople.timesheet.view.own$hlp$, $hlp$internal$hlp$, 123, 1, true),
($hlp$people$hlp$, $hlp$faturar-horas$hlp$, $hlp$Faturar horas aprovadas$hlp$, $hlp$Gerar fatura em rascunho com as horas billable aprovadas de uma alocação.$hlp$, $hlp$# Faturar horas aprovadas
**Para que serve:** Transformar horas billable aprovadas em fatura.
**Quem pode fazer:** Ver a tela e gerar fatura exige criar e ver faturas (`techfinance.invoices` ou `techsales.invoices`). O menu aparece com `techpeople.timesheet.view` ou `.approve`, ou para gestores.
**Onde fica:** Menu > TechPeople > Benefícios & custos > Faturamento de horas (`/people/billing`).
**Antes de começar:** As horas precisam estar lançadas como billable na ficha.

## Passo a passo
1. Em "Período", escolha as datas ou use "Limpar período".
2. Confira "Horas pendentes" e "Valor pendente".
3. Se houver horas sem aprovação na alocação, clique em "Aprovar pendentes".
4. Clique em "Faturar".
5. Confira o resumo, escolha o "Vencimento" (padrão: hoje + 15 dias) e clique em "Gerar fatura".
<!-- screenshot: faturamento de horas -->

## Resultado esperado
"Fatura {número} criada — {N} apontamento(s) vinculado(s)." A fatura nasce em rascunho.

## Regras e limites
- Só entram horas aprovadas, billable e ainda sem fatura.
- Valor = horas × tarifa do apontamento.
- A alocação só aparece se já tiver pelo menos uma hora aprovada.

## Erros comuns
- "Nenhuma hora aprovada e disponível para faturamento.": aprove as horas antes.
- "Ação financeira não autorizada.": falta permissão de faturas.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)$hlp$, $hlp$howto$hlp$, $hlp$/people/billing$hlp$, $hlp$techpeople.timesheet.view.own$hlp$, $hlp$internal$hlp$, 81, 1, true),
($hlp$people$hlp$, $hlp$gerenciar-acessos-vinculo-na-ficha$hlp$, $hlp$Preparar acesso e encerrar vínculos pela ficha$hlp$, $hlp$Consultar a contratação integrada, preparar convites e revisar acessos por vínculo.$hlp$, $hlp$# Preparar acesso e encerrar vínculos pela ficha

**Para que serve:** Consultar a contratação integrada, preparar convites e revisar acessos por vínculo.
**Quem pode fazer:** Além de ver a pessoa e a aba Alocações, o painel exige techpeople.employment.view.workspace. As operações exigem techpeople.employment.manage.workspace no cliente e no servidor. Convites e revisão de modelo também exigem system.roles.manage.workspace para aparecer na interface.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Alocações > Contratação integrada e acessos (`/people/$id`).
**Antes de começar:** Tenha um vínculo do novo fluxo e um modelo ativo aplicável. Cadastros históricos não são convertidos automaticamente.

## Passo a passo
1. Abra Alocações e localize "Contratação integrada e acessos". Confira origem, entidade WK, vigência e versão do acesso do vínculo correto.
2. Para preparar acesso, clique em "Preparar convite de acesso"; se já houver convite preparado, use "Obter convite preparado". Confira o campo de link retornado e compartilhe apenas por canal autorizado; a preparação não envia mensagem automaticamente.
3. Quando a tela indicar "Acesso do vínculo aplicado", confira a situação antes de tentar preparar novo convite.
4. Para mudar o pacote, clique em "Revisar modelo de acesso", escolha um modelo ativo, registre o motivo e confirme no diálogo. A revisão substitui a concessão desse vínculo, preservando outras origens.
5. Quando o fluxo de ciclo de vida integrado não estiver habilitado e o vínculo estiver ativo, para finalizar a relação, clique em "Encerrar este vínculo", revise o aviso, informe o motivo e confirme em "Encerrar vínculo e seus acessos".
6. Aguarde "Operação concluída." e confira novamente a situação e as alocações do vínculo.

## Resultado esperado
O contexto é recarregado após a operação; o convite preparado fica disponível como link. Encerrar afeta as alocações e o pacote de acesso originados naquele vínculo.

## Regras e limites
- Os botões operacionais descritos ficam na seção de vínculos ativos. Com lifecycle_enabled, o botão de encerramento deste painel não aparece; não trate sua ausência como simples falha de permissão.
- Revisar modelo e encerrar vínculo exigem motivo de 10 a 2.000 caracteres, após remover espaços nas extremidades.
- Revisar modelo envia a revisão do vínculo para controle de concorrência no servidor.
- Encerrar um vínculo preserva os demais e os acessos manuais; não equivale a revogar todo o acesso da pessoa.
- Sem vínculo do novo fluxo, o painel informa que cadastros históricos permanecem preservados. Não crie vínculo apenas para contornar a ausência de acesso.

## Erros comuns
- Painel ausente: confira a aba Alocações e techpeople.employment.view.workspace.
- Ações ausentes: falta techpeople.employment.manage.workspace ou a ação não se aplica ao estado do vínculo.
- "Operação não concluída.": leia o erro apresentado, atualize o contexto e revise modelo, motivo e estado do vínculo.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/people/$id$hlp$, $hlp$techpeople.employment.view.workspace$hlp$, $hlp$internal$hlp$, 128, 1, true),
($hlp$people$hlp$, $hlp$gerenciar-alocacoes-na-ficha$hlp$, $hlp$Criar e manter alocações na ficha$hlp$, $hlp$Vincular a pessoa a contratos e projetos e manter período, capacidade e rateio.$hlp$, $hlp$# Criar e manter alocações na ficha

**Para que serve:** Vincular a pessoa a contratos e projetos e manter período, capacidade e rateio.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. Criar depende da capacidade de criar registros para a pessoa; editar e excluir dependem da autorização do registro, não apenas da edição do perfil.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Alocações (`/people/$id`).
**Antes de começar:** Tenha a pessoa cadastrada e os contratos, projetos e vínculos aplicáveis disponíveis.

## Passo a passo
1. Clique em "Nova alocação". Para alterar uma existente, use o ícone de lápis no cartão autorizado.
2. Selecione o contrato de prestação e, se aplicável, o contrato de compra do prestador. Confira o vínculo de contratação apresentado para novas alocações governadas.
3. Informe projeto, gestor e Cargo/Função na alocação conforme o caso. Se houver sugestões de serviços do contrato, revise antes de aplicá-las; confira senioridade e competências.
4. Defina Alocação (%), Status, Início e, se houver, Fim. Se alterar o período herdado, preencha a justificativa de período diferente do vínculo.
5. Quando necessário, informe horas contratadas por semana e ajuste "Pode apontar horas no projeto". Se o painel indicar excesso de capacidade, registre a justificativa correspondente.
6. Quando autorizado, preencha taxa faturada e custo por hora. Se usar o rateio por empresa, confira os percentuais antes de salvar.
7. Preencha observações e clique em "Salvar". Confira o cartão. Para excluir, use a lixeira e confirme somente se o registro permitir.

## Resultado esperado
A criação informa "Alocação criada"; a lista apresenta status, percentual e período.

## Regras e limites
- Rateio vazio é permitido; se preenchido, exige empresas únicas, percentuais maiores que zero e soma de 100%. Contratos de prestação e de compra devem corresponder ao papel do campo; aditivos não são aceitos.
- Percentual de 0 a 100 no schema; horas semanais, se informadas, devem ser positivas e no máximo 168.
- Observações: até 4.000 caracteres. Valores financeiros dependem de acesso privado específico; visualizar a alocação não libera automaticamente taxas ou margem.
- Alocações vinculadas à contratação têm exclusão desabilitada no painel. Use o fluxo do vínculo para encerramento.
- O resumo financeiro soma alocações ativas e só aparece quando todas as linhas permitem visualizar os dados financeiros.

## Erros comuns
- "Contrato indisponível.": confira disponibilidade e acesso ao contrato.
- "Rateio não salvo": revise as empresas e os percentuais e tente novamente.
- Botão ausente ou desabilitado: confira a capacidade da pessoa ou do registro; editar o perfil não substitui essa autorização.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/people/$id$hlp$, $hlp$techpeople.allocations.view.own$hlp$, $hlp$internal$hlp$, 120, 1, true),
($hlp$people$hlp$, $hlp$gerenciar-documentos-na-ficha$hlp$, $hlp$Adicionar e consultar documentos na ficha$hlp$, $hlp$Registrar documentos, anexar arquivos e consultar sua validade na pessoa.$hlp$, $hlp$# Adicionar e consultar documentos na ficha

**Para que serve:** Registrar documentos, anexar arquivos e consultar sua validade na pessoa.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. Criar depende da capacidade de criar registros para a pessoa; editar e excluir dependem da autorização do registro, não apenas da edição do perfil. Visualizar ou baixar um arquivo também passa pela autorização do documento.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Documentos (`/people/$id`).
**Antes de começar:** Separe o arquivo permitido e confira o tipo e a validade sem expor dados desnecessários.

## Passo a passo
1. Clique em "Novo documento". Escolha ou informe o Tipo e preencha Número e Emissão quando aplicável.
2. Informe Validade quando houver vencimento.
3. Use "Selecionar arquivo" e aguarde o upload terminar. Confira o arquivo anexado antes de continuar.
4. Preencha Notas e clique em "Salvar". Confira o documento na lista e seus indicadores de situação.
5. Use "Visualizar" para abrir o visualizador e "Baixar" para obter o arquivo. Documentos sem arquivo não oferecem essas ações.
6. Para atualizar metadados ou arquivo, use o lápis e salve; para excluir, use a lixeira e confirme quando autorizado.

## Resultado esperado
A tela informa "Documento adicionado" ou "Documento atualizado" e recarrega a lista.

## Regras e limites
- Arquivo de até 20 MB; o seletor aceita PDF, PNG, JPG/JPEG, WEBP, DOC e DOCX.
- Salvar requer Tipo preenchido e fica bloqueado durante upload. Um cadastro pode existir sem arquivo.
- O acesso ao arquivo é obtido por URL assinada após validação no servidor, não por endereço público permanente.
- Ao salvar, validade passada define Vencido; validade nos próximos 30 dias define A vencer. Não há comprovação aqui de notificação externa nem de recálculo diário automático.

## Erros comuns
- "Arquivo maior que 20 MB": reduza o tamanho e tente novamente.
- "Falha no upload": confira o arquivo e tente de novo; não considere o anexo concluído antes da confirmação.
- Visualizar ou Baixar indisponível: confira a existência do arquivo e a permissão do documento.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/people/$id$hlp$, $hlp$techpeople.documents.view.own$hlp$, $hlp$internal$hlp$, 127, 1, true),
($hlp$people$hlp$, $hlp$gerenciar-incidentes$hlp$, $hlp$Gerenciar incidentes$hlp$, $hlp$Acompanhar incidentes de segurança, assédio e discriminação em tabela ou kanban.$hlp$, $hlp$# Gerenciar incidentes
**Para que serve:** Acompanhar incidentes de segurança, assédio, discriminação e quase-acidentes.
**Quem pode fazer:** Quem tem `techpeople.incidents.view` ou `techpeople.wellbeing.incidents.view` (ou é gestor). Mudar status exige `.update`; excluir, `.delete`.
**Onde fica:** Menu > TechPeople > Saúde & segurança > Incidentes (`/people/incidents`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Em "Severidade", escolha "Todas as severidades", "Baixa", "Moderada", "Alta" ou "Crítica".
2. Alterne entre "Visualizar em tabela" e "Visualizar em kanban".
3. No kanban, arraste o cartão para outra coluna ou use "Mover para outra etapa".
4. Na tabela, marque linhas e clique em "Editar em massa" para mudar "Severidade" ou "Status". Clique em "Aplicar".
<!-- screenshot: incidentes kanban -->

## Resultado esperado
"Etapa atualizada" no kanban ou "{N} registro(s) atualizado(s)" na tabela.

## Regras e limites
- Status: "Aberto", "Investigando", "Resolvido", "Arquivado".
- Categorias: "Segurança", "Assédio", "Discriminação", "Psicossocial", "Quase-acidente", "Acidente", "Outro".
- Esta tela não registra incidente novo.

## Erros comuns
- "Você não tem permissão para esta ação": peça revisão do seu perfil ao administrador.

## Relacionados
- [Consultar riscos psicossociais](/ajuda/people/consultar-riscos-psicossociais)$hlp$, $hlp$howto$hlp$, $hlp$/people/incidents$hlp$, $hlp$techpeople.incidents.view.own$hlp$, $hlp$internal$hlp$, 70, 1, true),
($hlp$people$hlp$, $hlp$gerenciar-metas-na-ficha$hlp$, $hlp$Criar e acompanhar metas na ficha$hlp$, $hlp$Registrar metas KPI, OKR ou Entrega e atualizar seu progresso.$hlp$, $hlp$# Criar e acompanhar metas na ficha

**Para que serve:** Registrar metas KPI, OKR ou Entrega e atualizar seu progresso.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. Criar depende da capacidade de criar registros para a pessoa; editar e excluir dependem da autorização do registro, não apenas da edição do perfil.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Metas (`/people/$id`).
**Antes de começar:** Defina o objetivo e como acompanhar seus valores e progresso.

## Passo a passo
1. Clique em "Nova meta" e informe Título e Descrição.
2. Escolha Tipo (KPI, OKR ou Entrega) e Status (Rascunho, Ativa, Concluída ou Cancelada).
3. Informe Unidade, Peso, Valor atual, Valor alvo e Progresso (%), conforme o acompanhamento desejado.
4. Defina Início e Fim quando aplicável e clique em "Salvar".
5. Confira o cartão. Para atualizar valores ou concluir, use o lápis, ajuste os campos e salve. Para remover, use a lixeira e confirme.

## Resultado esperado
A tela informa "Meta criada" ou "Meta atualizada" e atualiza a listagem.

## Regras e limites
- Título entre 2 e 200 caracteres; descrição até 4.000; unidade até 20.
- Progresso entre 0 e 100; peso não negativo.
- Valor atual, alvo e progresso são campos enviados separadamente; confira o progresso informado, sem presumir cálculo automático.

## Erros comuns
- Salvar indisponível ou validação de título: preencha pelo menos 2 caracteres.
- Lápis ou lixeira indisponível: confira o acesso específico à meta.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/people/$id$hlp$, $hlp$techpeople.goals.view.own$hlp$, $hlp$internal$hlp$, 124, 1, true),
($hlp$people$hlp$, $hlp$gerenciar-pessoas$hlp$, $hlp$Cadastrar e gerenciar pessoas$hlp$, $hlp$Cadastrar prestadores e o time interno, filtrar, usar o kanban e ações em massa.$hlp$, $hlp$# Cadastrar e gerenciar pessoas
**Para que serve:** Manter o cadastro de prestadores, contratados e time interno.
**Quem pode fazer:** Ver: `techpeople.people.view`. Cadastrar: `techpeople.people.create`. Editar e excluir em massa são liberados por registro. Custos só para quem tem `techpeople.people_sensitive.update`.
**Onde fica:** Menu > TechPeople > Pessoas > Pessoas (`/people`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Clique em "Nova pessoa".
2. Em "Identificação", preencha "Nome completo *". E-mail, telefone e localização são opcionais.
3. Em "Trabalho", escolha "Cargo / posição", "Senioridade", "Vínculo" e "Status".
4. Se tiver, preencha "Dados legais", "Financeiro" e "Notas & tags".
5. Clique em "Cadastrar".
<!-- screenshot: nova pessoa -->

## Resultado esperado
"Pessoa cadastrada". A pessoa aparece na lista.

## Buscar, filtrar e kanban
- Busque por nome, e-mail ou cargo (mínimo 2 letras).
- Filtre por "Status", "Vínculo", "Cargo", "Contratação entre" e "Responsável".
- No kanban, cada coluna é um status. Arraste o cartão para mudar ("Etapa atualizada").
- Marque linhas para "Exportar selecionados", "Editar em massa", "Responsável" ou "Excluir".

## Regras e limites
- Status: "Ativo", "Bench", "Afastado", "Em desligamento", "Desligado".
- Vínculo: "PJ", "CLT", "Terceiro", "Estagiário", "Outro". Padrão: PJ e Ativo.
- Nome de 2 a 160 caracteres; até 20 tags separadas por vírgula.
- A lista mostra até 500 pessoas e esconde arquivadas.
- Excluir em massa apaga o cadastro; não é arquivar.

## Erros comuns
- "Cadastrar" desabilitado: o nome tem menos de 2 letras.
- Campos de custo não aparecem: você não tem acesso a dados financeiros.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Importar do Google Forms](/ajuda/people/importar-google-forms)$hlp$, $hlp$howto$hlp$, $hlp$/people$hlp$, $hlp$techpeople.people.view.own$hlp$, $hlp$internal$hlp$, 10, 1, true),
($hlp$people$hlp$, $hlp$importar-google-forms$hlp$, $hlp$Importar prestadores do Google Forms$hlp$, $hlp$Cadastrar pessoas e anexos a partir da planilha de respostas.$hlp$, $hlp$# Importar prestadores do Google Forms
**Para que serve:** Trazer respostas de um formulário para o cadastro de pessoas, com anexos.
**Quem pode fazer:** O servidor exige todas estas, no escopo workspace: `techpeople.people.view`, `.create` e `.update`; `techpeople.people_sensitive.view` e `.update`; `techpeople.documents.view` e `.create`.
**Onde fica:** Menu > TechPeople > Pessoas > Importar do Google Forms (`/people/import-forms`).
**Antes de começar:** Deixe a planilha e a pasta de anexos como "Qualquer pessoa com o link — Leitor".

## Passo a passo
1. Cole a "URL da planilha".
2. Clique em "Simular". Nada é gravado.
3. Confira "Pessoas únicas" e a prévia.
4. Clique em "Executar importação" e confirme.
5. Acompanhe "Progresso": criadas, atualizadas, sem alteração e anexos.
<!-- screenshot: importar forms -->

## Resultado esperado
"Importação concluída". As pessoas recebem a tag `form-import`.

## Regras e limites
- A chave é o CPF. Se a pessoa existe, só os campos vazios são completados. Reexecutar é seguro.
- Com CPF repetido na planilha, vale a primeira linha.
- Anexos quebrados (.bin): use "Reimportar anexos .bin" (exige `techpeople.documents.update`).
- Não há botão para cancelar no meio.

## Erros comuns
- "URL da planilha inválida": confira o link.
- "Falha ao baixar planilha": torne a planilha pública com link.
- "Sem permissão para importar dados privados de todas as pessoas selecionadas.": falta acesso a dados sensíveis.

## Relacionados
- [Cadastrar e gerenciar pessoas](/ajuda/people/gerenciar-pessoas)$hlp$, $hlp$howto$hlp$, $hlp$/people/import-forms$hlp$, $hlp$techpeople.people.create.own$hlp$, $hlp$internal$hlp$, 13, 1, true),
($hlp$people$hlp$, $hlp$lancar-horas-na-ficha$hlp$, $hlp$Lançar e corrigir horas na ficha$hlp$, $hlp$Registrar apontamentos por projeto, data e tarefa no timesheet da pessoa.$hlp$, $hlp$# Lançar e corrigir horas na ficha

**Para que serve:** Registrar apontamentos por projeto, data e tarefa no timesheet da pessoa.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. A gravação também depende das regras de acesso do apontamento no servidor e no banco.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Timesheet (`/people/$id`).
**Antes de começar:** Tenha um projeto disponível e confira a pessoa e o período.

## Passo a passo
1. Clique em "Lançar horas". Para corrigir, abra a edição pelo lápis do apontamento.
2. Selecione o projeto e, se aplicável, a tarefa. Informe a data e a quantidade de horas.
3. Confira se o apontamento é faturável e preencha a tarifa por hora apenas quando necessário; uma tarifa vazia não define uma nova tarifa manual.
4. Registre a descrição e salve. Confira a mensagem e a linha na lista.
5. Se a linha não aparecer, ajuste o período e os filtros de projeto, status e tipo. Para excluir, use a lixeira e confirme quando autorizado.

## Resultado esperado
A tela informa "Apontamento criado" ou "Apontamento atualizado" e recarrega o timesheet.

## Regras e limites
- A interface exige horas maiores que zero; o servidor aceita de 0 a 24. Para este fluxo da tela, use mais de zero e no máximo 24 por lançamento.
- Projeto é obrigatório. Tarefa é opcional. O lançamento não equivale a envio nem aprovação de um período.
- As permissões e restrições do banco continuam valendo mesmo quando a tela mostra os botões de edição ou exclusão.

## Erros comuns
- "Selecione um projeto": escolha o projeto antes de salvar.
- "Horas devem ser maior que zero": corrija a quantidade.
- "Pessoa não encontrada": confira a ficha e seu acesso.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/people/$id$hlp$, $hlp$techpeople.timesheet.view.own$hlp$, $hlp$internal$hlp$, 121, 1, true),
($hlp$people$hlp$, $hlp$perguntas-frequentes$hlp$, $hlp$Perguntas frequentes do TechPeople$hlp$, $hlp$Dúvidas comuns sobre o módulo.$hlp$, $hlp$# Perguntas frequentes do TechPeople

**Onde cadastro benefícios, documentos e incidentes?**
Na ficha da pessoa, na aba correspondente. As telas de lista só consolidam.

**Por que não vejo meus liderados em "Meu time"?**
Defina você como "Gestor" na alocação de cada pessoa. Seu usuário também precisa estar ligado a uma pessoa.

**Arquivar e excluir são a mesma coisa?**
Não. Excluir em massa apaga o cadastro.

**Reimportar o Google Forms duplica pessoas?**
Não. A chave é o CPF; só campos vazios são completados.

**A sincronização da folha duplica contas a pagar?**
Não. Ela atualiza a recorrência que já existe de cada pessoa.

**O convite de acesso é enviado por e-mail?**
Não. "Preparar convite de acesso" gera um link para você enviar.

## Relacionados
- [Erros comuns](/ajuda/people/erros-comuns)$hlp$, $hlp$faq$hlp$, NULL, NULL, $hlp$internal$hlp$, 6, 1, true),
($hlp$people$hlp$, $hlp$permissoes$hlp$, $hlp$Permissões do TechPeople$hlp$, $hlp$Quem vê, cria, edita e exclui em cada tela.$hlp$, $hlp$# Permissões do TechPeople

As chaves seguem o formato `techpeople.<recurso>.<ação>.<escopo>`.

| Tela ou aba | Ver | Outras ações |
|---|---|---|
| Pessoas | `techpeople.people.view` | Criar: `.create`; editar/excluir por registro |
| Dados financeiros da pessoa | `techpeople.people_sensitive.view` | Editar: `.update` |
| Alocações | `techpeople.allocations.view` | Valores: `techpeople.allocations_financial.view` |
| Timesheet | `techpeople.timesheet.view` | Aprovar: `techpeople.timesheet.approve.workspace` |
| Metas, 1:1s, Avaliações | `techpeople.goals` / `one_on_ones` / `reviews` `.view` | Notas privadas de 1:1: `techpeople.one_on_ones_private` |
| Onboarding / Offboarding | `techpeople.onboarding.view` / `offboarding.view` | Criar plano: `.create` |
| Modelos de onboarding | `techpeople.onboarding_templates.view` | Criar: `.create`; editar/excluir por registro |
| Documentos | `techpeople.documents.view` | `.update`, `.delete` |
| Benefícios | `techpeople.benefits.view` | `.update`, `.delete` |
| Incidentes | `techpeople.incidents.view` | `.update`, `.delete` |
| Riscos psicossociais | `techpeople.wellbeing.assessments.view` | — |
| Histórico | `techpeople.events.view` | — |
| Contratação integrada | `techpeople.employment.view` | Gerir: `.manage.workspace` |
| Faturamento de horas | faturas do TechFinance (`view` + `create`) | — |

Escopos: own (seus registros), team (do time) e workspace (todos). Deny sempre prevalece. Membros inativos não acessam.

Várias telas de lista também aparecem para gestores pelo perfil. Mesmo assim, o servidor confere a permissão de cada ação.

## Relacionados
- [Erros comuns](/ajuda/people/erros-comuns)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 4, 1, true),
($hlp$people$hlp$, $hlp$primeiros-15-minutos$hlp$, $hlp$Primeiros 15 minutos no TechPeople$hlp$, $hlp$Roteiro rápido para começar a usar o módulo.$hlp$, $hlp$# Primeiros 15 minutos no TechPeople

1. Abra **Dashboard** e veja o quadro atual.
2. Vá em **Pessoas** e clique em "Nova pessoa". Preencha nome, cargo, vínculo e status. Clique em "Cadastrar".
3. Abra a ficha da pessoa. Na aba "Alocações", clique em "Nova alocação" e defina contrato, gestor e percentual.
4. Na aba "Documentos", clique em "Novo documento" e informe a validade.
5. Na aba "Onboarding", crie um "Novo plano" a partir de um modelo.
6. Se você é gestor, abra **Meu time** para ver seus liderados.

## Dicas
- Abas que não aparecem dependem de permissão.
- Dados financeiros só aparecem para quem tem acesso a dados sensíveis.

## Relacionados
- [Cadastrar e gerenciar pessoas](/ajuda/people/gerenciar-pessoas)
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)$hlp$, $hlp$quickstart$hlp$, $hlp$/people$hlp$, NULL, $hlp$internal$hlp$, 2, 1, true),
($hlp$people$hlp$, $hlp$registrar-avaliacao-tomador-na-ficha$hlp$, $hlp$Registrar avaliações do tomador na ficha$hlp$, $hlp$Documentar avaliações por período, notas e feedback qualitativo.$hlp$, $hlp$# Registrar avaliações do tomador na ficha

**Para que serve:** Documentar avaliações por período, notas e feedback qualitativo.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. Criar depende da capacidade de criar registros para a pessoa; editar e excluir dependem da autorização do registro, não apenas da edição do perfil.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Avaliações (`/people/$id`).
**Antes de começar:** Tenha o período avaliado e o feedback autorizado para registro.

## Passo a passo
1. Clique em "Nova avaliação" para abrir "Nova avaliação do tomador". Preencha Avaliador (nome) e Cargo do avaliador quando necessário.
2. Escolha a Cadência e o Status. Informe Início do período e Fim do período.
3. Em Notas por dimensão, atribua as estrelas de Entrega, Qualidade técnica, Comunicação, Colaboração e Confiabilidade.
4. Preencha Pontos fortes, A desenvolver e Comentários adicionais. Revise a classificação antes de clicar em "Salvar".
5. Confira o cartão e a nota geral. Para revisar, use o lápis e salve as alterações; para excluir, use a lixeira e confirme quando autorizado.

## Resultado esperado
A tela informa "Avaliação criada" ou "Avaliação atualizada" e exibe o registro na lista.

## Regras e limites
- Cadências: Mensal, Trimestral, Semestral, Anual e Pontual. Status: Rascunho, Enviada e Reconhecida.
- As duas datas são necessárias para habilitar Salvar. Nome do avaliador até 160 caracteres; cargo até 120; cada texto de feedback até 4.000.
- Notas no servidor ficam entre 0 e 5. Na ausência de nota geral explícita, o servidor calcula a média das notas numéricas recebidas.
- O status Enviada grava a data de envio no registro; este fluxo não demonstra disparo de e-mail ao avaliador.

## Erros comuns
- Salvar desabilitado: preencha início e fim do período.
- Falha de autorização: confira o acesso à avaliação; editar a pessoa não concede edição das avaliações.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/people/$id$hlp$, $hlp$techpeople.reviews.view.own$hlp$, $hlp$internal$hlp$, 126, 1, true),
($hlp$people$hlp$, $hlp$registrar-um-a-um-na-ficha$hlp$, $hlp$Agendar e registrar reuniões 1:1 na ficha$hlp$, $hlp$Manter pauta, notas e itens de ação de reuniões individuais.$hlp$, $hlp$# Agendar e registrar reuniões 1:1 na ficha

**Para que serve:** Manter pauta, notas e itens de ação de reuniões individuais.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. Criar depende da capacidade de criar registros para a pessoa; editar e excluir dependem da autorização do registro, não apenas da edição do perfil. Notas privadas têm autorização adicional do recurso privado one_on_ones_private.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > 1:1s (`/people/$id`).
**Antes de começar:** Confirme a pessoa da ficha e o que deve constar nas notas visíveis.

## Passo a passo
1. Clique em "Nova 1:1". Preencha Data e hora, Duração (min) e Status.
2. Informe Mood (1-5), se desejado, e registre a Pauta.
3. Preencha "Notas (visível para a pessoa)" apenas com conteúdo adequado a essa visibilidade. Se o campo de notas privadas estiver disponível e editável, use-o para o conteúdo restrito.
4. Em Itens de ação, digite o texto e adicione o item; marque os itens concluídos ou remova os desnecessários.
5. Clique em "Salvar" e confira a reunião. Após o encontro, use o lápis, atualize status e notas e salve novamente. A lixeira permite remover com confirmação quando autorizado.

## Resultado esperado
A tela informa "1:1 criada" ou "1:1 atualizada" e atualiza a lista.

## Regras e limites
- Status disponíveis: Agendada, Realizada, Não realizada e Cancelada.
- Duração deve ser um inteiro não negativo; mood, quando preenchido, um inteiro de 1 a 5.
- Pauta até 4.000 caracteres, notas visíveis até 8.000 e notas privadas até 4.000. Cada item de ação tem texto de 1 a 500 caracteres.
- Poder editar a reunião não libera automaticamente notas privadas; a interface só envia esse campo quando há autorização privada de atualização.

## Erros comuns
- Notas privadas ausentes ou bloqueadas: confira a autorização privada, não copie o conteúdo para notas visíveis.
- Falha ao salvar: confira duração, mood e tamanho dos textos.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/people/$id$hlp$, $hlp$techpeople.one_on_ones.view.own$hlp$, $hlp$internal$hlp$, 125, 1, true),
($hlp$people$hlp$, $hlp$usar-analytics$hlp$, $hlp$Usar o Analytics e sincronizar a folha$hlp$, $hlp$Ver headcount, turnover, custos e margem; enviar a folha ao TechFinance.$hlp$, $hlp$# Usar o Analytics e sincronizar a folha
**Para que serve:** Ver headcount, movimentação, custos e margem das alocações.
**Quem pode fazer:** Quem tem `techpeople.allocations.view` (ou é gestor). Custos exigem `techpeople.people_sensitive.view`; margem exige `techpeople.allocations_financial.view`. "Sincronizar folha" exige, no workspace: `techpeople.people.view`, `techpeople.people_sensitive.view`, `techpeople.benefits.view` e `techfinance.recurrences.view`, `.create` e `.update`.
**Onde fica:** Menu > TechPeople > Benefícios & custos > Analytics (`/people/analytics`).
**Antes de começar:** Custos mensais e benefícios preenchidos nas fichas.

## Passo a passo
1. Confira "Headcount ativo", "Turnover 12m", "Custo mensal (base)", "Custo total mensal", "Receita projetada", "Custo projetado" e "Margem".
2. Veja "Admissões (12 meses)", "Desligamentos (12 meses)", "Por status" e "Por tipo de contrato".
3. Para enviar a folha ao financeiro, clique em "Sincronizar folha". Abre a prévia; nada é gravado.
4. Confira "Criadas", "Atualizadas", "Desativadas" e "Total mensal a materializar:".
5. Clique em "Aplicar".
<!-- screenshot: analytics -->

## Resultado esperado
"Folha sincronizada". Cada pessoa ativa ganha uma conta a pagar mensal no TechFinance.

## Regras e limites
- Turnover = desligamentos dos últimos 12 meses ÷ headcount atual.
- Receita e custo projetados usam 160 horas × percentual de alocação.
- Se você não puder ver o custo de alguma pessoa, o total aparece como "—".
- A sincronização usa custo mensal + benefícios vigentes. Pode rodar várias vezes sem duplicar. Vencimento padrão: dia 5.

## Erros comuns
- "Sem permissão para consultar toda a base de custos. Nenhuma recorrência foi alterada.": peça acesso a dados privados de todas as pessoas.

## Relacionados
- [Consultar margem por contrato](/ajuda/people/consultar-margem-contrato)$hlp$, $hlp$howto$hlp$, $hlp$/people/analytics$hlp$, $hlp$techpeople.allocations.view.own$hlp$, $hlp$internal$hlp$, 80, 1, true),
($hlp$people$hlp$, $hlp$usar-ficha-pessoa$hlp$, $hlp$Usar a ficha da pessoa$hlp$, $hlp$Editar o perfil e usar as abas de alocações, horas, metas, documentos e mais.$hlp$, $hlp$# Usar a ficha da pessoa
**Para que serve:** Ver e manter tudo sobre uma pessoa em um só lugar.
**Quem pode fazer:** Quem pode ver a pessoa. Cada aba exige a permissão de ver do seu recurso. Editar depende do registro.
**Onde fica:** TechPeople > Pessoas > clique no nome ou em "Abrir" (`/people/$id`).
**Antes de começar:** A pessoa precisa estar cadastrada.

## Passo a passo
1. Na aba "Perfil", altere "Dados básicos", "Dados pessoa jurídica" e "Notas internas".
2. "Financeiro (restrito)" só aparece para quem vê dados sensíveis.
3. Clique em "Salvar". 
## Resultado esperado
"Ficha atualizada". Cada aba confirma o que foi salvo, por exemplo "Alocação criada" ou "Documento adicionado".

## Abas
| Aba | Permissão para ver | O que faz |
|---|---|---|
| Alocações | `techpeople.allocations` | "Nova alocação": contrato, projeto, gestor, %, período e taxas |
| Timesheet | `techpeople.timesheet` | "Lançar horas", filtros, "Aprovar", "Remover aprovação", CSV |
| Metas | `techpeople.goals` | "Nova meta": KPI, OKR ou Entrega |
| 1:1s | `techpeople.one_on_ones` | "Nova 1:1" com pauta, notas e itens de ação |
| Avaliações | `techpeople.reviews` | "Nova avaliação do tomador" por período |
| Onboarding | `techpeople.onboarding` ou `.offboarding` | "Novo plano" de admissão ou desligamento e suas tarefas |
| Psicossocial | `techpeople.wellbeing.assessments` | "Nova avaliação psicossocial" |
| Incidentes | `techpeople.incidents` | "Novo incidente" |
| Benefícios | `techpeople.benefits` | "Novo benefício" |
| Documentos | `techpeople.documents` | "Novo documento", "Visualizar", "Baixar" |
| Histórico | `techpeople.events` | Últimos 50 eventos |

## Regras e limites
- Horas por lançamento: de 0 a 24.
- Documento: até 20 MB (PDF, imagem ou Word). Alerta 30 dias antes da validade.
- Na aba "Alocações", o painel "Contratação integrada e acessos" exige `techpeople.employment.view` (ver) e `.manage` (gerir). "Preparar convite de acesso" gera um link; o envio não é automático.
- Encerrar vínculo e revisar modelo de acesso pedem motivo com pelo menos 10 caracteres.

## Erros comuns
- "Pessoa indisponível ou sem acesso.": você não pode ver essa pessoa.
- "Arquivo maior que 20 MB": reduza o arquivo.
- Aba não aparece: falta a permissão daquele recurso.

## Relacionados
- [Cadastrar e gerenciar pessoas](/ajuda/people/gerenciar-pessoas)
- [Acompanhar onboarding](/ajuda/people/acompanhar-onboarding)$hlp$, $hlp$howto$hlp$, $hlp$/people/$id$hlp$, $hlp$techpeople.people.view.own$hlp$, $hlp$internal$hlp$, 11, 1, true),
($hlp$people$hlp$, $hlp$visao-geral$hlp$, $hlp$Visão geral do TechPeople$hlp$, $hlp$Para que serve o TechPeople, quem usa e o mapa das telas.$hlp$, $hlp$# Visão geral do TechPeople

O TechPeople é o módulo de pessoas do TechERP: cadastro de prestadores e time interno, alocações, horas, documentos, onboarding, saúde e segurança, benefícios e custos.

## Quem usa
- **RH:** cadastro, documentos, onboarding, offboarding e benefícios.
- **Gestores:** meu time, metas, 1:1s, avaliações e aprovação de horas.
- **Financeiro:** faturamento de horas, margem e sincronização da folha.

## Mapa das telas (menu lateral)
| Grupo | Telas |
|---|---|
| Visão geral | Dashboard |
| Pessoas | Pessoas, Meu time, Onboarding, Offboarding, Documentos a vencer, Modelos de onboarding, Importar do Google Forms |
| Saúde & segurança | Riscos psicossociais, Incidentes |
| Benefícios & custos | Benefícios, Faturamento de horas, Margem por contrato, Analytics |

Quase tudo de uma pessoa é feito na ficha dela. As telas de lista consolidam o workspace.

## Como se conecta aos outros módulos
- **TechHire:** contratar um candidato cria a pessoa.
- **TechContracts:** alocações ligam a pessoa a contratos de prestação e de compra.
- **TechProjects:** alocação em projeto e lançamento de horas.
- **TechFinance:** faturas de horas e recorrências da folha.

## Relacionados
- [Primeiros 15 minutos](/ajuda/people/primeiros-15-minutos)
- [Permissões](/ajuda/people/permissoes)$hlp$, $hlp$overview$hlp$, $hlp$/people/dashboard$hlp$, NULL, $hlp$internal$hlp$, 1, 1, true)
ON CONFLICT (module_key, slug) DO NOTHING;
INSERT INTO public.help_articles
  (module_key, slug, title, summary, body_md, article_type, route_pattern, min_permission, audience, sort_order, version, is_published)
VALUES
($hlp$contracts$hlp$, $hlp$acompanhar-dashboard$hlp$, $hlp$Consultar o Dashboard de contratos$hlp$, $hlp$Consultar o Dashboard de contratos no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar o Dashboard de contratos
**Para que serve:** Consultar o Dashboard de contratos.
**Quem pode fazer:** Membro com acesso ao módulo e aos contratos consultados.
**Onde fica:** TechContracts > Contratos (/contracts/dashboard).
**Antes de começar:** Ter contratos visíveis para o seu acesso.

## Passo a passo
1. Abra TechContracts > Visão geral > Dashboard.
2. Consulte "Contratos ativos", "Valor contratado ativo", "Em aprovação ou assinatura" e "Vencem em 30 dias".
3. Veja "Carteira por status", "Próximos vencimentos", "Precisam de atenção" e "Contratos recentes".
4. Clique em um contrato para abrir sua ficha. Use "Atualizar" para consultar novamente ou "Ir para Contratos" para abrir a lista.
<!-- screenshot: Consultar o Dashboard de contratos, sem dados pessoais reais -->

## Resultado esperado
Indicadores e listas dos contratos acessíveis.

## Regras e limites
- Ativos incluem os status active e renewing. Aprovação ou assinatura inclui in_review, in_negotiation e awaiting_signature.
- Vencimentos considera os próximos 30 dias. Atenção inclui contratos ativos vencidos e os que aguardam aprovação ou assinatura.
- A consulta considera até 2.000 contratos mais recentes; listas auxiliares mostram até 8.
- O valor soma os valores cadastrados. Não há conversão multimoeda demonstrada; não use o indicador como total convertido.

## Erros comuns
Se a consulta falhar, tente "Atualizar". Uma lista vazia não comprova ausência de contratos fora do seu acesso.

## Relacionados
- [Visão geral](/ajuda/contracts/visao-geral)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/dashboard$hlp$, NULL, $hlp$internal$hlp$, 10, 1, true),
($hlp$contracts$hlp$, $hlp$alterar-em-massa$hlp$, $hlp$Alterar status, responsável e campos em massa$hlp$, $hlp$Alterar status, responsável e campos em massa no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Alterar status, responsável e campos em massa
**Para que serve:** Alterar status, responsável e campos em massa.
**Quem pode fazer:** Atualização de cada contrato selecionado; status mantém regras de transição e ativação.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Conferir todos os contratos selecionados e o impacto da mudança.

## Passo a passo
1. Selecione os contratos na tabela.
2. Para status, escolha "Alterar status"; para atribuição, use "Definir responsável" ou "Sem responsável".
3. Para outros campos, clique em "Editar em massa" e use os campos disponibilizados pelo diálogo.
4. Confira o resumo de sucessos e falhas por contrato.
<!-- screenshot: Alterar status, responsável e campos em massa, sem dados pessoais reais -->

## Resultado esperado
Alterações feitas nos registros autorizados; pode haver resultado parcial.

## Regras e limites
- Seletores de status/responsável aplicam imediatamente, sem confirmação adicional.
- Cada contrato é processado em sequência; falha não interrompe os demais.
- Seleção só é limpa se o executor terminar sem falhas.
- A seleção não concede acesso a campos sensíveis ou a transições proibidas.

## Erros comuns
Resumo pode mostrar até três contratos com erro. Revise as falhas antes de repetir para evitar alterações desnecessárias.

## Relacionados
- [Consultar contratos](/ajuda/contracts/consultar-contratos)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 26, 1, true),
($hlp$contracts$hlp$, $hlp$alterar-status$hlp$, $hlp$Alterar o status de um contrato$hlp$, $hlp$Alterar o status de um contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Alterar o status de um contrato
**Para que serve:** Alterar o status de um contrato.
**Quem pode fazer:** Atualização do registro e techcontracts.contract_transition.manage.workspace; para Ativo também techcontracts.contract_activation.manage.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Conferir aprovações pendentes e evidências necessárias.

## Passo a passo
1. Abra a ficha.
2. Escolha um status permitido no campo "Status".
3. Clique em "Salvar".
4. Para "Em revisão" ou "Aguardando assinatura", use o fluxo de aprovações em vez da mudança manual.
<!-- screenshot: Alterar o status de um contrato, sem dados pessoais reais -->

## Resultado esperado
Status atualizado somente quando autorizado pelas regras de transição.

## Regras e limites
- Status: Rascunho, Em revisão, Em negociação, Aguardando assinatura, Ativo, Renovando, Encerrado, Rescindido.
- Aprovação pendente pode impedir transição.
- Ativo não comprova assinatura. Aprovação completa não ativa automaticamente o contrato.

## Erros comuns
"Use o fluxo de aprovações para esta situação." ou "Conclua ou reinicie o fluxo de aprovação antes de alterar a situação.": conclua o processo correto.
"Edição não autorizada.": revise seu acesso.

## Relacionados
- [Iniciar aprovações](/ajuda/contracts/iniciar-aprovacoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 31, 1, true),
($hlp$contracts$hlp$, $hlp$analisar-vinculos-ia$hlp$, $hlp$Revisar e aplicar sugestões de vínculo da IA$hlp$, $hlp$Revisar e aplicar sugestões de vínculo da IA no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Revisar e aplicar sugestões de vínculo da IA
**Para que serve:** Revisar e aplicar sugestões de vínculo da IA.
**Quem pode fazer:** Gerenciamento de links para análise; aplicar exige autorização dos vínculos de contratos.
**Onde fica:** TechContracts > Contratos (/contracts/links).
**Antes de começar:** Pendências disponíveis e revisão humana das sugestões.

## Passo a passo
1. Na fila, clique em "Analisar com IA".
2. Revise os pares sugeridos e a confiança.
3. Use "Selecionar alta confiança" se adequado, sem dispensar a revisão.
4. Clique em "Aplicar selecionadas" apenas para correspondências confirmadas.
5. Revise sucessos/falhas e o histórico. Ignore sugestões incorretas.
<!-- screenshot: Revisar e aplicar sugestões de vínculo da IA, sem dados pessoais reais -->

## Resultado esperado
Vínculos escolhidos aplicados com possível resultado parcial; decisões registradas.

## Regras e limites
- Análise consulta até 500 contratos.
- A análise pode gravar sugestões/histórico antes de aplicar. Não é necessariamente somente leitura.
- Confiança alta não comprova vínculo correto.
- Ignorar sugestão não exclui contrato.

## Erros comuns
Sem linhas filtradas, a análise fica desabilitada. Falhas parciais exigem revisão antes de nova aplicação.

## Relacionados
- [Históricos](/ajuda/contracts/consultar-historicos)
- [Vinculação manual](/ajuda/contracts/revisar-vinculacao)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/links$hlp$, NULL, $hlp$internal$hlp$, 44, 1, true),
($hlp$contracts$hlp$, $hlp$aninhar-contratos$hlp$, $hlp$Aninhar contratos de compra sob uma prestação$hlp$, $hlp$Aninhar contratos de compra sob uma prestação no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Aninhar contratos de compra sob uma prestação
**Para que serve:** Aninhar contratos de compra sob uma prestação.
**Quem pode fazer:** Atualização dos contratos e capacidade de alterar o vínculo.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Identificar a prestação principal e o contrato de compra correto.

## Passo a passo
1. Na prestação, abra "Contratos de compra aninhados" e clique em "Aninhar contrato de compra".
2. Selecione o contrato de compra e clique em "Aninhar".
3. Se ele já estiver vinculado a outro contrato, use "Mover" e confirme a troca de vínculo.
4. Pela compra, também é possível usar "Aninhar sob contrato de prestação" ou "Alterar contrato principal".
5. Para remover, use "Desaninhar" e confirme "Desaninhar este contrato de compra do contrato de prestação?".
<!-- screenshot: Aninhar contratos de compra sob uma prestação, sem dados pessoais reais -->

## Resultado esperado
Contrato de compra associado à prestação e apresentado sob ela na listagem.

## Regras e limites
- Compra representa a WK como contratante do profissional; prestação representa a WK prestadora.
- Compra não aninha outra compra ou prestação neste card. Aditivos têm painel próprio.
- Autovínculo é impedido. Mover exige confirmação.
- A apresentação de margem não equivale a faturamento ou recebimento.

## Erros comuns
"Você não tem permissão para alterar este vínculo": revise seu acesso. Não confunda o contrato principal de um aditivo com o pai de uma compra.

## Relacionados
- [Vincular aditivos](/ajuda/contracts/vincular-aditivo)
- [Vinculação de contratos](/ajuda/contracts/revisar-vinculacao)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 40, 1, true),
($hlp$contracts$hlp$, $hlp$aprovar-medicao$hlp$, $hlp$Aprovar e reverificar uma medição$hlp$, $hlp$Aprovar e reverificar uma medição no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Aprovar e reverificar uma medição
**Para que serve:** Aprovar e reverificar uma medição.
**Quem pode fazer:** techprojects.measurements.approve.workspace e acesso ao registro; pessoa diferente de quem preparou ou enviou.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Medição em revisão e sem pendências impeditivas.

## Passo a passo
1. Abra a medição em revisão.
2. Confira a prévia, linhas e pendências.
3. Clique em "Aprovar medição".
4. Se houver pendências financeiras após aprovação, resolva-as e clique em "Reverificar pendências".
<!-- screenshot: Aprovar e reverificar uma medição, sem dados pessoais reais -->

## Resultado esperado
Aprovada com pendências financeiras ou pronta para o Financeiro; nenhum título criado pela aprovação.

## Regras e limites
- Quem preparou ou enviou não pode aprovar (SELF_APPROVAL).
- Aprovação revalida contrato, competência, fontes e hash.
- Medição aprovada pode continuar bloqueada para geração.
- Devolver à situação Rascunho exige justificativa e autorização própria.

## Erros comuns
APPROVE_BLOCKED: confira pendências. SELF_APPROVAL: encaminhe a outro aprovador autorizado.

## Relacionados
- [Gerar no Financeiro](/ajuda/contracts/gerar-medicao-financeiro)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 73, 1, true),
($hlp$contracts$hlp$, $hlp$assinar-por-link$hlp$, $hlp$Assinar ou recusar um documento por link$hlp$, $hlp$Assinar ou recusar um documento por link no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Assinar ou recusar um documento por link
**Para que serve:** Assinar ou recusar um documento por link.
**Quem pode fazer:** Destinatário do link individual de assinatura. O acesso público usa o token do link.
**Onde fica:** TechContracts > Contratos (/sign/$token).
**Antes de começar:** Receber um link válido. Não compartilhe o link individual com terceiros.

## Passo a passo
1. Abra o link recebido e leia o documento.
2. Consulte a situação dos signatários e aguarde os anteriores se houver assinatura ordenada.
3. Digite seu nome completo e marque o aceite.
4. Clique em "Assinar agora".
5. Se não concordar, escolha a recusa e informe o motivo opcional.
<!-- screenshot: Assinar ou recusar um documento por link, sem dados pessoais reais -->

## Resultado esperado
A assinatura ou recusa fica registrada no documento.

## Regras e limites
- Nome com pelo menos dois caracteres e aceite são exigidos pelo botão.
- Links inválidos, expirados ou documentos cancelados/rascunho não permitem assinatura.
- A ordem é conferida novamente ao assinar.
- O link e o aceite não devem ser descritos como autenticação forte ou validação criptográfica de identidade.

## Erros comuns
"Link inválido ou expirado.": peça um link válido.
"Você já assinou este documento." e "Assinatura recusada anteriormente." indicam ação já registrada.
"Assinatura indisponível.": confira a situação do documento com o responsável.

## Relacionados
- [Preparar documentos](/ajuda/contracts/gerenciar-documentos-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/sign/$token$hlp$, NULL, $hlp$internal$hlp$, 96, 1, true),
($hlp$contracts$hlp$, $hlp$associar-servico$hlp$, $hlp$Associar serviço do catálogo ao contrato$hlp$, $hlp$Associar serviço do catálogo ao contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Associar serviço do catálogo ao contrato
**Para que serve:** Associar serviço do catálogo ao contrato.
**Quem pode fazer:** Criação de techservice.services; o servidor exige techservice.services.create.own neste caminho.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Contrato de Prestação, serviço do catálogo ativo e cargo ativo se selecionado.

## Passo a passo
1. Abra o contrato de prestação.
2. No card "Serviços", clique em "Associar serviço".
3. Em "Associar serviço ao contrato", escolha "Preset de contratação" se necessário e "Serviço do catálogo *".
4. Revise "Cargo / perfil contratado", "Senioridade" e "Stack / competências".
5. Preencha "Tipo de cobrança", "Cadência", "Quantidade", "Preço unitário", "Início" e "Fim".
6. Conclua a associação e confira "Serviço associado ao contrato.".
<!-- screenshot: Associar serviço do catálogo ao contrato, sem dados pessoais reais -->

## Resultado esperado
Serviço operacional associado ao contrato; seu nome abre a ficha do serviço.

## Regras e limites
- Serviços são associados à prestação. Compra é aninhada sob prestação, não recebe a mesma associação direta.
- O botão aparecer pelo tipo do contrato não comprova permissão de criação.
- Catálogo ativo é obrigatório. Valor do serviço = quantidade × preço unitário.

## Erros comuns
"Selecione um serviço do catálogo.", "Serviço do catálogo não encontrado ou inativo" ou "Cargo não encontrado ou inativo": revise os cadastros.

## Relacionados
- [Consultar serviços](/ajuda/contracts/consultar-servicos)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 35, 1, true),
($hlp$contracts$hlp$, $hlp$ativar-servico$hlp$, $hlp$Ativar um serviço$hlp$, $hlp$Ativar um serviço no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Ativar um serviço
**Para que serve:** Ativar um serviço.
**Quem pode fazer:** Atualização de techservice.services no escopo do registro.
**Onde fica:** TechContracts > Contratos (/services/$id).
**Antes de começar:** Conferir contrato, valores, direção e cobrança do serviço.

## Passo a passo
1. Abra a ficha do serviço.
2. Confira valores e datas.
3. Quando disponível, clique em "Ativar".
4. Aguarde "Serviço ativado." e confira os lançamentos gerados.
<!-- screenshot: Ativar um serviço, sem dados pessoais reais -->

## Resultado esperado
O procedimento de ativação do serviço é executado com as verificações de cobrança.

## Regras e limites
- "Ativar" e salvar o campo Status são ações diferentes.
- Não considere a ativação como envio automático de cobrança ao cliente.
- Bloqueios de cobrança e permissões são verificados no servidor.

## Erros comuns
Se a ativação falhar, leia a mensagem e revise a configuração antes de tentar novamente.

## Relacionados
- [Editar serviço](/ajuda/contracts/editar-servico)$hlp$, $hlp$howto$hlp$, $hlp$/services/$id$hlp$, NULL, $hlp$internal$hlp$, 82, 1, true),
($hlp$contracts$hlp$, $hlp$campos-e-status$hlp$, $hlp$Campos e status do TechContracts$hlp$, $hlp$Campos e status do TechContracts no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Campos e status do TechContracts
## Contratos
| Campo | Significado operacional |
|---|---|
| Tipo | Prestação ou Compra |
| Tipo de documento | Principal ou Aditivo |
| Contrato principal | Obrigatório no aditivo; não é o mesmo vínculo pai de uma compra |
| Valor total | Valor cadastrado do contrato |
| Início / Fim | Vigência cadastrada |
| Renovação automática | Sim ou Não |
| Aviso prévio (dias) | Prazo cadastrado de aviso |
| Cláusulas / corpo do contrato | Texto ou HTML em campo de texto |

| Status salvo | Label da ficha |
|---|---|
| draft | Rascunho |
| in_review | Em revisão |
| in_negotiation | Em negociação |
| awaiting_signature | Aguardando assinatura |
| active | Ativo |
| renewing | Renovando |
| ended | Encerrado |
| terminated | Rescindido |

Na lista, Aguardando assinatura aparece abreviado como "Aguard. assinatura". Em revisão e Aguardando assinatura passam pelo fluxo de aprovações. Ativo não comprova assinatura.

## Serviços em execução
Tipos: Recorrente, Único, Por marco, Por uso. Status: Pendente, Ativo, Pausado, Cancelado, Concluído. Cadência recorrente: Mensal, Trimestral, Anual. Valor por ciclo = quantidade × preço unitário.

## Documentos e medições
Modelo importado nasce em rascunho. Documento enviado para assinatura sela o conteúdo, sem comprovar entrega de e-mail. Medição tem etapas próprias de revisão, aprovação e geração no Financeiro; provisão não é título financeiro.

## Relacionados
- [Alterar status](/ajuda/contracts/alterar-status)
- [Editar serviço](/ajuda/contracts/editar-servico)
- [Evidência de assinatura](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 2, 1, true),
($hlp$contracts$hlp$, $hlp$configurar-cobranca$hlp$, $hlp$Configurar e versionar o modelo de cobrança$hlp$, $hlp$Configurar e versionar o modelo de cobrança no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Configurar e versionar o modelo de cobrança
**Para que serve:** Configurar e versionar o modelo de cobrança.
**Quem pode fazer:** techprojects.billing_config.manage.workspace e acesso ao contrato/serviço.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Conferir o escopo e os títulos legados já existentes.

## Passo a passo
1. Em "Modelo de cobrança", escolha "Escopo": "Contrato inteiro" ou um serviço.
2. Escolha "Modelo": por hora, mensalidade/preço fixo, pacote/franquia, marcos/entregáveis ou percentual/sucesso.
3. Informe "Vale a partir de" e "Arredondamento (2 casas)".
4. Revise as opções do modelo: horas fechadas, aceite do cliente, franquia, valores, saldo, pró-rata ou percentual, conforme disponibilizado.
5. Preencha "Motivo (mín. 10 caracteres)".
6. Clique em "Ativar modelo" e confirme "Ativar".
<!-- screenshot: Configurar e versionar o modelo de cobrança, sem dados pessoais reais -->

## Resultado esperado
Modelo versionado e ativo a partir da competência escolhida; sem criação de medição ou título.

## Regras e limites
- A interface não oferece competência anterior ao mês atual.
- No escopo de serviço, Medições assume a cobrança a partir da competência; o gerador antigo deixa de faturar esse serviço.
- Títulos legados permanecem e precisam de vínculo ou resolução; não desaparecem com a mudança.
- Configurar modelo não concede permissão de geração financeira.

## Erros comuns
Se houver títulos legados ou pendências, resolva-os no fluxo correto antes de gerar uma nova cobrança.

## Relacionados
- [Preparar medição](/ajuda/contracts/preparar-medicao)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 71, 1, true),
($hlp$contracts$hlp$, $hlp$configurar-padroes$hlp$, $hlp$Configurar padrões de contrato$hlp$, $hlp$Configurar padrões de contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Configurar padrões de contrato
**Para que serve:** Configurar padrões de contrato.
**Quem pode fazer:** Leitura de techcontracts.defaults; para salvar, manage de defaults e techcontracts.contracts.update.workspace.
**Onde fica:** TechContracts > Contratos (/settings/contract-defaults).
**Antes de começar:** Acesso à administração dos padrões.

## Passo a passo
1. Abra "Padrões de contrato".
2. Selecione "Todos os tipos" ou a aba do tipo desejado.
3. Preencha os campos disponibilizados.
4. Clique em "Salvar padrões".
<!-- screenshot: Configurar padrões de contrato, sem dados pessoais reais -->

## Resultado esperado
"Padrões salvos." confirma os valores de pré-preenchimento.

## Regras e limites
- Os padrões atuam na criação. Não alteram contratos existentes retroativamente.
- Valores vindos do negócio ou digitados pelo usuário têm prioridade.
- Somente campos marcados para aceitar padrão aparecem.
- Selecionar um provedor de assinatura não configura uma integração com esse provedor.

## Erros comuns
"Não foi possível carregar os padrões de contrato.": use "Tentar novamente". Se salvar for negado, confira as duas permissões necessárias.

## Relacionados
- [Visão geral](/ajuda/contracts/visao-geral)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/settings/contract-defaults$hlp$, NULL, $hlp$internal$hlp$, 90, 1, true),
($hlp$contracts$hlp$, $hlp$consultar-a-biblioteca-de-clausulas$hlp$, $hlp$Consultar a biblioteca de cláusulas$hlp$, $hlp$Consultar a biblioteca de cláusulas.$hlp$, $hlp$# Consultar a biblioteca de cláusulas

**Para que serve:** Consultar a biblioteca de cláusulas, no contexto da tela `/settings/clauses`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/clauses`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/clauses.
2. Consulte a biblioteca e abra a edição disponível.
3. Revise Slug, Título, Categoria e Corpo antes de gravar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Esta rota usa proposals.functions. Não confunda biblioteca de cláusulas com modelos de proposta: o documento de proposta usa modelos próprios, não cláusulas de contrato. 

## Erros comuns
Confira acesso, filtros e configuração antes de repetir.

## Relacionados
- [Visão geral do TechContracts](/ajuda/contracts/visao-geral)$hlp$, $hlp$howto$hlp$, $hlp$/settings/clauses$hlp$, NULL, $hlp$internal$hlp$, 118, 1, true),
($hlp$contracts$hlp$, $hlp$consultar-configuracoes-de-assinatura-eletronica$hlp$, $hlp$Consultar configurações de assinatura eletrônica$hlp$, $hlp$Consultar configurações de assinatura eletrônica.$hlp$, $hlp$# Consultar configurações de assinatura eletrônica

**Para que serve:** Consultar configurações de assinatura eletrônica, no contexto da tela `/settings/esign`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/esign`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/esign.
2. Consulte as configurações e os registros autorizados.
3. Execute criação ou remoção somente quando a ação estiver disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A rota utiliza techcontracts.esign e controles de acesso próprios; assinatura eletrônica pertence ao TechContracts.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `contracts`; consulte os artigos desse módulo em `/ajuda/contracts`.

<!-- screenshot: capturar /settings/esign com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/esign$hlp$, NULL, $hlp$internal$hlp$, 124, 1, true),
($hlp$contracts$hlp$, $hlp$consultar-contratos$hlp$, $hlp$Consultar, filtrar e agrupar contratos$hlp$, $hlp$Consultar, filtrar e agrupar contratos no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar, filtrar e agrupar contratos
**Para que serve:** Consultar, filtrar e agrupar contratos.
**Quem pode fazer:** Leitura de techcontracts.contracts no escopo dos registros.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Acesso ao módulo.

## Passo a passo
1. Abra TechContracts > Contratos > Contratos.
2. Escolha "Todos", "Ativos", "Em assinatura", "Vencendo em 30 dias" ou "Encerrados".
3. Use "Buscar por título ou número…" e combine "Tipo", "Status", "Empresa (contraparte)", "Contratante", "Vigência", "Período de início" e "Período de término".
4. Se desejar, agrupe por "Empresa", "Serviço", "Cargo" ou "Senioridade". "Nenhum" remove o agrupamento.
5. Abra o contrato desejado. Use "Limpar filtros" para remover os filtros.
<!-- screenshot: Consultar, filtrar e agrupar contratos, sem dados pessoais reais -->

## Resultado esperado
Lista de contratos conforme filtros e acesso.

## Regras e limites
- Tipo: Prestação ou Compra.
- Busca até 200 caracteres. A consulta paginada aceita de 1 a 200 registros por página; padrão de servidor: 50.
- Agrupamentos têm consultas próprias limitadas; não representam obrigatoriamente toda a base.
- Agrupar visualmente não cria vínculo contratual.
- A presença de uma ação no cabeçalho não comprova permissão para executá-la.

## Erros comuns
Sem registros: confira filtros e acesso. Não considere uma lista vazia como inexistência de contratos no workspace.

## Relacionados
- [Criar contrato](/ajuda/contracts/criar-contrato)
- [Editar contrato](/ajuda/contracts/editar-contrato)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 20, 1, true),
($hlp$contracts$hlp$, $hlp$consultar-fluxo$hlp$, $hlp$Consultar o fluxo do contrato$hlp$, $hlp$Consultar o fluxo do contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar o fluxo do contrato
**Para que serve:** Consultar o fluxo do contrato.
**Quem pode fazer:** Acesso ao contrato e aos registros relacionados.
**Onde fica:** TechContracts > Contratos (/contracts/$id/flow).
**Antes de começar:** Contrato existente.

## Passo a passo
1. Na ficha, clique em "Fluxo do contrato".
2. Consulte as etapas de negócio, proposta/cotação, aprovação, minuta, revisão/aditivos e assinatura disponíveis.
3. Leia a situação e os registros de cada etapa.
4. Abra os vínculos de negócio ou contrato quando disponíveis.
5. Use "Voltar ao contrato" para retornar.
<!-- screenshot: Consultar o fluxo do contrato, sem dados pessoais reais -->

## Resultado esperado
Visão das etapas e documentos relacionados ao contrato.

## Regras e limites
- Esta tela apresenta o fluxo; não executa automaticamente um workflow.
- Etapas sem dados não comprovam execução concluída.
- Cada vínculo aberto respeita o acesso ao registro correspondente.

## Erros comuns
"Não foi possível carregar o fluxo.": use "Tentar novamente".
"Contrato não encontrado": registro excluído ou sem acesso.

## Relacionados
- [Aprovações](/ajuda/contracts/iniciar-aprovacoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/flow$hlp$, NULL, $hlp$internal$hlp$, 41, 1, true),
($hlp$contracts$hlp$, $hlp$consultar-historicos$hlp$, $hlp$Consultar histórico de vínculos e sugestões de IA$hlp$, $hlp$Consultar histórico de vínculos e sugestões de IA no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar histórico de vínculos e sugestões de IA
**Para que serve:** Consultar histórico de vínculos e sugestões de IA.
**Quem pode fazer:** Acesso ao contrato e à leitura dos históricos correspondentes.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Contrato com histórico disponível.

## Passo a passo
1. Abra a ficha do contrato.
2. Consulte "Histórico de vínculos" para revisar aninhamentos e desvinculações.
3. Consulte "Histórico de sugestões da IA" para revisar propostas e decisões.
4. Quando a consulta falhar, use a tentativa novamente disponível no card.
<!-- screenshot: Consultar histórico de vínculos e sugestões de IA, sem dados pessoais reais -->

## Resultado esperado
Histórico apresentado para conferência, sem aplicar novo vínculo por simples leitura.

## Regras e limites
- Histórico de sugestão não significa vínculo aplicado.
- Histórico de vínculos e aprovações são registros distintos.

## Erros comuns
Sem eventos, não presuma que houve decisão. Falha na consulta: tente novamente e confira seu acesso.

## Relacionados
- [Vinculação](/ajuda/contracts/revisar-vinculacao)
- [Aprovações](/ajuda/contracts/iniciar-aprovacoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 46, 1, true),
($hlp$contracts$hlp$, $hlp$consultar-o-fluxo-publico-de-assinatura$hlp$, $hlp$Consultar o fluxo público de assinatura$hlp$, $hlp$Consultar o fluxo público de assinatura.$hlp$, $hlp$# Consultar o fluxo público de assinatura

**Para que serve:** Consultar o fluxo público de assinatura, no contexto da tela `/sign/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/sign/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link recebido.
2. Confira o documento e as instruções.
3. Execute somente as etapas de assinatura apresentadas para seu acesso.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Link de assinatura é sensível; não prometa que a tela é configurador global de assinatura eletrônica.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `contracts`; consulte os artigos desse módulo em `/ajuda/contracts`.

<!-- screenshot: capturar /sign/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/sign/$token$hlp$, NULL, $hlp$internal$hlp$, 213, 1, true),
($hlp$contracts$hlp$, $hlp$consultar-rentabilidade$hlp$, $hlp$Consultar e exportar rentabilidade do contrato$hlp$, $hlp$Consultar e exportar rentabilidade do contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar e exportar rentabilidade do contrato
**Para que serve:** Consultar e exportar rentabilidade do contrato.
**Quem pode fazer:** techprojects.profitability.view.workspace; exportação também profitability.export.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Contrato e intervalo disponíveis; acesso a tarifas/custos conforme restrições.

## Passo a passo
1. Em rentabilidade, ajuste "De", "Até" e "Moeda".
2. Compare "Receita aprovada (medida)", "Lançada no Financeiro", "Custo estimado" e "Margem estimada".
3. Confira a cobertura de custos e esforço.
4. Use "Exportar CSV" quando autorizado.
<!-- screenshot: Consultar e exportar rentabilidade do contrato, sem dados pessoais reais -->

## Resultado esperado
Consulta ou exportação de indicadores estimados; nenhuma geração ou cobrança executada.

## Regras e limites
- Intervalo de meses completos até 12 meses; moeda com três letras.
- Filtro de moeda não é conversão cambial.
- Custo parcial aparece como parcial; sem cobertura, desconhecido.
- Receita medida, título lançado e recebimento são diferentes.
- Margem estimada não equivale a lucro contábil realizado.

## Erros comuns
Custo desconhecido: revise cobertura e acesso, sem assumir custo zero.

## Relacionados
- [Fechar provisão mensal](/ajuda/contracts/fechar-provisao)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 77, 1, true),
($hlp$contracts$hlp$, $hlp$consultar-servicos$hlp$, $hlp$Consultar serviços em execução$hlp$, $hlp$Consultar serviços em execução no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar serviços em execução
**Para que serve:** Consultar serviços em execução.
**Quem pode fazer:** Quem tem leitura de techservice.services no escopo aplicável.
**Onde fica:** TechContracts > Contratos (/services).
**Antes de começar:** Serviços cadastrados dentro de contratos.

## Passo a passo
1. Abra "Serviços em execução".
2. Use "Buscar por nome…".
3. Filtre por "Tipo", "Status" e "Responsável".
4. Alterne entre tabela e kanban. Configure as colunas da tabela conforme necessário.
5. Clique no nome para abrir o serviço ou na coluna "Contrato" para abrir o contrato.
<!-- screenshot: Consultar serviços em execução, sem dados pessoais reais -->

## Resultado esperado
Lista de serviços vinculados aos contratos.

## Regras e limites
- Tipos: Recorrente, Único, Por marco, Por uso. Status: Pendente, Ativo, Pausado, Cancelado, Concluído.
- Valor = quantidade × preço unitário.
- A tela consulta até 200 registros. A seleção global usa uma busca de IDs separada e não corresponde apenas aos registros visíveis.
- "Limpar filtros" limpa tipo, status e responsável, mas não a busca por nome.
- Não há criação direta nessa lista. Catálogo de Serviços é um cadastro reutilizável; Serviços em execução são instâncias de um contrato.

## Erros comuns
Sem resultado: confira os filtros, a busca e seu acesso ao serviço.

## Relacionados
- [Editar serviço](/ajuda/contracts/editar-servico)
- [Visão geral](/ajuda/contracts/visao-geral)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/services$hlp$, NULL, $hlp$internal$hlp$, 80, 1, true),
($hlp$contracts$hlp$, $hlp$criar-contrato$hlp$, $hlp$Criar contrato em branco pelo assistente$hlp$, $hlp$Criar contrato em branco pelo assistente no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Criar contrato em branco pelo assistente
**Para que serve:** Criar contrato em branco pelo assistente.
**Quem pode fazer:** Criação de techcontracts.contracts e acesso às origens utilizadas.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Escolher contratante, contraparte e condições do contrato.

## Passo a passo
1. Clique em "Novo contrato".
2. Em "Origem", escolha "Em branco".
3. Em "Tipo", escolha o tipo do contrato.
4. Em "Dados", preencha o título e os campos disponibilizados.
5. Em "Serviços", com negócio vinculado, revise "Copiar serviços do negócio para o contrato" e os itens. Sem negócio, associe serviços pela ficha depois.
6. Em "Revisão", confira os dados e conclua a criação.
<!-- screenshot: Criar contrato em branco pelo assistente, sem dados pessoais reais -->

## Resultado esperado
"Contrato criado." e abertura da ficha.

## Regras e limites
- Etapas: Origem, Tipo, Dados, Serviços, Revisão. No assistente manual, a criação ocorre no último passo.
- Título é obrigatório.
- A cópia de serviços é desabilitada em contratos de compra.
- Padrões do workspace ajudam no preenchimento, mas não substituem revisão.

## Erros comuns
"Informe um título.": preencha o título.
"Não foi possível carregar todas as origens.": confira a disponibilidade das origens; não presuma que todos os modelos foram carregados.

## Relacionados
- [Converter origem comercial](/ajuda/contracts/criar-da-origem-comercial)
- [Associar serviço](/ajuda/contracts/associar-servico)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 21, 1, true),
($hlp$contracts$hlp$, $hlp$criar-da-origem-comercial$hlp$, $hlp$Criar contrato a partir de cotação, proposta ou modelo$hlp$, $hlp$Criar contrato a partir de cotação, proposta ou modelo no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Criar contrato a partir de cotação, proposta ou modelo
**Para que serve:** Criar contrato a partir de cotação, proposta ou modelo.
**Quem pode fazer:** Criação de contrato e acesso à cotação, proposta, negócio ou modelo escolhido.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Abrir o assistente no contexto comercial para usar cotação/proposta; modelo precisa estar publicado.

## Passo a passo
1. Abra o assistente de contrato no contexto do negócio ou da origem comercial.
2. Em "Origem", escolha a cotação, proposta ou modelo disponível.
3. Para cotação/proposta, escolha "Novo contrato independente" ou "Termo aditivo de: …".
4. Se for aditivo, selecione um contrato principal ativo disponível.
5. Confira "Dados", "Serviços" e "Revisão" antes de concluir.
<!-- screenshot: Criar contrato a partir de cotação, proposta ou modelo, sem dados pessoais reais -->

## Resultado esperado
Contrato criado com a origem comercial registrada; caso a origem já tenha gerado contrato, o existente é aberto.

## Regras e limites
- A listagem sem contexto de negócio não oferece busca universal de cotações/propostas.
- Cotação: itens viram serviços. Proposta: preserva proposta e cotação de origem.
- No modelo, tipo vem do modelo; empresa, valores e vigência vêm do negócio e modelo.
- Conversão já feita não deve ser repetida para criar duplicata.

## Erros comuns
"Selecione o contrato principal do aditivo.": escolha um principal válido.
"A empresa não tem contrato ativo, então não há aditivo para escolher.": use contrato independente quando adequado.
"Este documento já gerou um contrato — abrindo o existente." é prevenção de duplicidade.

## Relacionados
- [Criar contrato em branco](/ajuda/contracts/criar-contrato)
- [Organizar modelos](/ajuda/contracts/gerenciar-modelos)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 22, 1, true),
($hlp$contracts$hlp$, $hlp$decidir-aprovacao$hlp$, $hlp$Aprovar ou rejeitar uma etapa de contrato$hlp$, $hlp$Aprovar ou rejeitar uma etapa de contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Aprovar ou rejeitar uma etapa de contrato
**Para que serve:** Aprovar ou rejeitar uma etapa de contrato.
**Quem pode fazer:** Aprovação de techcontracts.approvals, com acesso à etapa e respeito ao responsável atribuído.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Etapa pendente; anteriores concluídas; contrato em revisão.

## Passo a passo
1. Abra o painel de aprovações.
2. Confira a etapa atual e sua atribuição.
3. Registre o comentário, obrigatório em rejeição.
4. Clique em "Aprovar" ou "Rejeitar".
5. Confira "Etapa aprovada" ou "Etapa rejeitada".
<!-- screenshot: Aprovar ou rejeitar uma etapa de contrato, sem dados pessoais reais -->

## Resultado esperado
Decisão registrada; rejeição leva a Em negociação e conclusão de todas as aprovações leva a Aguardando assinatura.

## Regras e limites
- Comentário até 2.000 caracteres.
- Não é permitido decidir etapa já decidida ou atribuída a outra pessoa.
- Aprovar não conclui assinatura nem ativa contrato.

## Erros comuns
"Informe o motivo da rejeição", "A etapa foi atribuída a outra pessoa." ou "Conclua a etapa anterior.": corrija a condição antes de decidir.

## Relacionados
- [Iniciar aprovações](/ajuda/contracts/iniciar-aprovacoes)
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 33, 1, true),
($hlp$contracts$hlp$, $hlp$editar-contrato$hlp$, $hlp$Editar a ficha de um contrato$hlp$, $hlp$Editar a ficha de um contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Editar a ficha de um contrato
**Para que serve:** Editar a ficha de um contrato.
**Quem pode fazer:** Leitura e capacidade de atualização de techcontracts.contracts para o registro.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Abrir o contrato correto e conferir a versão salva.

## Passo a passo
1. Abra o contrato pela lista.
2. Edite "Título", "Tipo", "Tipo de documento", "Contrato principal" quando for aditivo, e "Valor total".
3. Revise "Início", "Fim", "Renovação automática" e "Aviso prévio (dias)".
4. Em "Cláusulas / corpo do contrato", edite o texto quando necessário.
5. Clique em "Salvar" e aguarde "Contrato atualizado.".
6. Use "Visualizar" para abrir o arquivo original quando essa ação estiver disponível.
<!-- screenshot: Editar a ficha de um contrato, sem dados pessoais reais -->

## Resultado esperado
Alterações persistidas na ficha.

## Regras e limites
- Corpo é campo de texto/HTML, não editor rico.
- "Detalhes extraídos" exibe informações disponíveis em leitura; não torna todos os campos extraídos editáveis.
- Campos alterados localmente só são gravados após salvar.
- Conteúdo, partes e condições alterados podem exigir nova evidência de assinatura.
- Status e aprovação têm regras próprias.

## Erros comuns
"Contrato não encontrado.": use "Voltar". Salvar desabilitado: confira acesso, gravação em andamento ou principal ausente no aditivo.

## Relacionados
- [Alterar status](/ajuda/contracts/alterar-status)
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 30, 1, true),
($hlp$contracts$hlp$, $hlp$editar-publicar-modelo$hlp$, $hlp$Editar e publicar um modelo de contrato$hlp$, $hlp$Editar e publicar um modelo de contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Editar e publicar um modelo de contrato
**Para que serve:** Editar e publicar um modelo de contrato.
**Quem pode fazer:** Atualização de techcontracts.contract_templates no registro.
**Onde fica:** TechContracts > Contratos (/contracts/templates/$id).
**Antes de começar:** Ter um modelo criado ou importado.

## Passo a passo
1. Abra o modelo.
2. Preencha "Nome do modelo", "Tipo de contrato", "Tipo de serviço" e "Descrição".
3. Revise "Corpo do contrato" e suas variáveis.
4. Salve para manter a edição.
5. Após a revisão, clique em "Publicar".
<!-- screenshot: Editar e publicar um modelo de contrato, sem dados pessoais reais -->

## Resultado esperado
"Modelo salvo." ou "Modelo publicado.", conforme a ação escolhida.

## Regras e limites
- Tipos de contrato: Prestação e Compra.
- Revise as variáveis antes de publicar. Texto importado não é garantia de documento completo ou juridicamente adequado.

## Erros comuns
Se a gravação falhar, confira o nome e a mensagem recebida do servidor.

## Relacionados
- [Importar modelo](/ajuda/contracts/importar-modelo)
- [Organizar modelos](/ajuda/contracts/gerenciar-modelos)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/templates/$id$hlp$, NULL, $hlp$internal$hlp$, 61, 1, true),
($hlp$contracts$hlp$, $hlp$editar-servico$hlp$, $hlp$Editar a ficha de um serviço$hlp$, $hlp$Editar a ficha de um serviço no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Editar a ficha de um serviço
**Para que serve:** Editar a ficha de um serviço.
**Quem pode fazer:** Leitura e atualização de techservice.services no escopo do registro.
**Onde fica:** TechContracts > Contratos (/services/$id).
**Antes de começar:** Abrir um serviço existente.

## Passo a passo
1. Na lista, clique no nome do serviço.
2. Edite "Nome", "Descrição", "Status", "Quantidade", "Preço unitário", "Início" e "Fim".
3. Para serviço recorrente, escolha "Cadência": Mensal, Trimestral ou Anual.
4. Clique em "Salvar".
5. Consulte "Valor por ciclo", "Próxima cobrança", "Direção" e "Lançamentos gerados".
<!-- screenshot: Editar a ficha de um serviço, sem dados pessoais reais -->

## Resultado esperado
A mensagem "Alterações salvas." confirma a gravação.

## Regras e limites
- Nome obrigatório; quantidade e preço não podem ser negativos.
- Tipo, moeda, direção e próxima cobrança não são editáveis nesse formulário.
- Direção é A receber quando a WK presta o serviço; no caso contrário, A pagar.
- Lançamentos gerados mostram até 50 registros recentes por vencimento, com acesso financeiro próprio.
- Salvar o status Ativo não executa o mesmo procedimento da ação "Ativar".

## Erros comuns
"Serviço não encontrado.": volte à lista. "Nenhum lançamento ainda." não significa falha; pode não haver lançamento ou acesso financeiro.

## Relacionados
- [Ativar serviço](/ajuda/contracts/ativar-servico)
- [Consultar serviços](/ajuda/contracts/consultar-servicos)$hlp$, $hlp$howto$hlp$, $hlp$/services/$id$hlp$, NULL, $hlp$internal$hlp$, 81, 1, true),
($hlp$contracts$hlp$, $hlp$erros-comuns$hlp$, $hlp$Erros comuns no TechContracts$hlp$, $hlp$Erros comuns no TechContracts no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Erros comuns no TechContracts
| Situação | O que conferir |
|---|---|
| Contrato ou serviço não encontrado | Registro removido, acesso ao registro e filtros |
| Salvar desabilitado | Permissão de atualização, gravação em andamento e principal obrigatório do aditivo |
| Use o fluxo de aprovações para esta situação | Não mudar manualmente Em revisão ou Aguardando assinatura |
| Conclua a etapa anterior | Ordem da cadeia de aprovação |
| A etapa foi atribuída a outra pessoa | Responsável da aprovação |
| Informe o motivo da rejeição | Comentário obrigatório |
| Autorização comercial pendente | Origem comercial, versão/evidência e demais impedimentos mostrados no card |
| Sem permissão ou contrato alterado. Recarregue. | Versão salva atual e gerenciamento de evidência |
| Documento indisponível para envio | Estado, validade e signatários |
| Link inválido ou expirado | Solicitar link válido ao responsável |
| Configure o modelo primeiro | Modelo de cobrança ativo antes de preparar medição |
| Serviço do catálogo não encontrado ou inativo | Catálogo ativo e serviço escolhido |

## Importações
PDF aceita até 15 MB e DOCX até 10 MB nos fluxos de importação de contrato/modelo. Revise o texto extraído e os rascunhos. Um rascunho criado na importação pode permanecer salvo mesmo sem finalizar.

## Não resolva mudando o significado dos estados
Ativo não substitui assinatura, provisão não substitui título e medição aprovada não comprova recebimento. Corrija o impedimento no fluxo correto.

## Relacionados
- [Permissões](/ajuda/contracts/permissoes)
- [Evidência de assinatura](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$troubleshooting$hlp$, NULL, NULL, $hlp$internal$hlp$, 4, 1, true),
($hlp$contracts$hlp$, $hlp$estornar-medicao$hlp$, $hlp$Devolver, cancelar ou estornar uma medição$hlp$, $hlp$Devolver, cancelar ou estornar uma medição no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Devolver, cancelar ou estornar uma medição
**Para que serve:** Devolver, cancelar ou estornar uma medição.
**Quem pode fazer:** Devolver exige aprovação ou gerenciamento de medições conforme verificação do servidor; estornar exige techprojects.measurement_reverse.manage.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Identificar situação, vínculo financeiro e pagamentos antes de escolher a ação.

## Passo a passo
1. Abra o detalhe da medição.
2. Para voltar a revisar, use a ação de devolução e informe a justificativa.
3. Para cancelar uma medição ainda não gerada, use o cancelamento permitido para a situação.
4. Para medição gerada, use o estorno e informe motivo com pelo menos 10 caracteres.
5. Confira a situação e o vínculo financeiro após a operação.
<!-- screenshot: Devolver, cancelar ou estornar uma medição, sem dados pessoais reais -->

## Resultado esperado
Devolução retorna a Rascunho; estorno termina em Estornada, conforme a ação e suas regras.

## Regras e limites
- Cancelamento não substitui estorno de medição gerada.
- Título criado pela medição: estorno cancela-o somente quando permitido.
- Título legado: estorno apenas desfaz o vínculo e preserva o título.
- Pagamento, baixa ou registro bancário no título gerado bloqueia estorno.
- Estorno não é devolução bancária nem desfaz recebimento automaticamente.

## Erros comuns
REVERSE_BLOCKED: resolva pagamentos, baixas ou dependências no Financeiro antes de tentar.

## Relacionados
- [Gerar título ou vincular legado](/ajuda/contracts/gerar-medicao-financeiro)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 75, 1, true),
($hlp$contracts$hlp$, $hlp$excluir-contrato$hlp$, $hlp$Excluir um contrato$hlp$, $hlp$Excluir um contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Excluir um contrato
**Para que serve:** Excluir um contrato.
**Quem pode fazer:** Capacidade de exclusão de techcontracts.contracts para o registro.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Revisar dependências antes de remover. Não usar exclusão para encerrar uma vigência.

## Passo a passo
1. Abra o contrato correto.
2. Clique na ação "Excluir".
3. Confirme "Excluir este contrato?" somente após revisar o impacto.
<!-- screenshot: Excluir um contrato, sem dados pessoais reais -->

## Resultado esperado
"Contrato excluído." e retorno à lista.

## Regras e limites
- Excluir remove o cadastro; encerrar e rescindir são estados distintos.
- Não presuma remoção automática de todos os serviços, medições ou vínculos. Dependências podem bloquear a operação.

## Erros comuns
"Você não tem permissão para excluir este registro.": solicite revisão do seu acesso.

## Relacionados
- [Alterar status](/ajuda/contracts/alterar-status)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 39, 1, true),
($hlp$contracts$hlp$, $hlp$excluir-em-massa$hlp$, $hlp$Excluir contratos em massa$hlp$, $hlp$Excluir contratos em massa no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Excluir contratos em massa
**Para que serve:** Excluir contratos em massa.
**Quem pode fazer:** Exclusão autorizada em cada contrato selecionado.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Revisar vínculos e confirmar que não se pretende apenas encerrar ou rescindir.

## Passo a passo
1. Selecione os contratos.
2. Clique em "Excluir" na barra de seleção.
3. Confira a quantidade e confirme "Excluir N contrato(s)? Esta ação não pode ser desfeita.".
4. Revise o resumo de sucessos e falhas.
<!-- screenshot: Excluir contratos em massa, sem dados pessoais reais -->

## Resultado esperado
Registros autorizados removidos; falhas podem permanecer sem impedir os demais.

## Regras e limites
- Botão desabilitado se autorização carregar ou algum selecionado não puder ser excluído.
- Não presuma exclusão em cascata de serviços, medições e dependências.
- Exclusão não é encerrar vigência.

## Erros comuns
Falhas por contrato: revise mensagem e dependências antes de repetir.

## Relacionados
- [Excluir pela ficha](/ajuda/contracts/excluir-contrato)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 28, 1, true),
($hlp$contracts$hlp$, $hlp$excluir-servico$hlp$, $hlp$Excluir um serviço$hlp$, $hlp$Excluir um serviço no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Excluir um serviço
**Para que serve:** Excluir um serviço.
**Quem pode fazer:** Exclusão de techservice.services para o registro, sem bloqueio adicional de exclusão.
**Onde fica:** TechContracts > Contratos (/services/$id).
**Antes de começar:** Confirmar que o serviço pode ser removido sem comprometer seus vínculos.

## Passo a passo
1. Abra o serviço.
2. Acione "Excluir serviço".
3. Confirme "Excluir este serviço?" somente se a remoção estiver correta.
<!-- screenshot: Excluir um serviço, sem dados pessoais reais -->

## Resultado esperado
"Serviço excluído." e retorno à listagem.

## Regras e limites
- Excluir não é pausar ou cancelar. A operação remove o cadastro.
- O acesso e os vínculos do registro podem impedir a exclusão.

## Erros comuns
"Você não tem permissão para excluir este registro.": solicite revisão do seu acesso; não tente contornar pela URL.

## Relacionados
- [Editar serviço](/ajuda/contracts/editar-servico)$hlp$, $hlp$howto$hlp$, $hlp$/services/$id$hlp$, NULL, $hlp$internal$hlp$, 83, 1, true),
($hlp$contracts$hlp$, $hlp$exportar-contratos$hlp$, $hlp$Exportar contratos selecionados$hlp$, $hlp$Exportar contratos selecionados no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Exportar contratos selecionados
**Para que serve:** Exportar contratos selecionados.
**Quem pode fazer:** Acesso aos registros e à ação de exportação conforme o controle efetivo.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Selecionar somente registros e dados que possam ser compartilhados.

## Passo a passo
1. Selecione os contratos na tabela.
2. Clique em "Exportar" na barra de seleção.
3. Confira o arquivo recebido antes de compartilhar.
<!-- screenshot: Exportar contratos selecionados, sem dados pessoais reais -->

## Resultado esperado
Arquivo com número, título, tipo comercial, status, valor, início, término e criação dos selecionados.

## Regras e limites
- Exportar não altera os contratos.
- Não representa automaticamente toda a carteira: depende da seleção.
- Dados comerciais devem ser compartilhados somente com destinatários autorizados.

## Erros comuns
Se não houver registros no arquivo, confira a seleção e seu acesso.

## Relacionados
- [Consultar contratos](/ajuda/contracts/consultar-contratos)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 27, 1, true),
($hlp$contracts$hlp$, $hlp$fechar-provisao$hlp$, $hlp$Calcular, fechar e revisar provisão mensal$hlp$, $hlp$Calcular, fechar e revisar provisão mensal no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Calcular, fechar e revisar provisão mensal
**Para que serve:** Calcular, fechar e revisar provisão mensal.
**Quem pode fazer:** Leitura de techfinance.provisions e techprojects.rates; calcular exige provisions.manage.workspace; fechar/revisar também provisions.approve.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Mês encerrado, acesso ao contrato e fechamento integrado habilitado no workspace.

## Passo a passo
1. Em "Provisão mensal", informe "Competência (AAAA-MM)", "Origem / modelo" e "Fuso da competência".
2. Clique em "Calcular prévia".
3. Confira receita sem cobrança, horas pendentes, custo conhecido, custos sem cobertura e composição.
4. Preencha "Justificativa do fechamento ou da revisão".
5. Clique em "Fechar provisão mensal" ou, se já houver fechamento, "Registrar revisão".
6. Consulte "Histórico da competência".
<!-- screenshot: Calcular, fechar e revisar provisão mensal, sem dados pessoais reais -->

## Resultado esperado
Snapshot gerencial registrado; nenhum título, obrigação, cobrança ou pagamento criado.

## Regras e limites
- Justificativa de 10–2.000 caracteres. Competência padrão: mês anterior.
- Fechamento só para mês encerrado; revisão cria nova versão sem sobrescrever histórico.
- Composição pagina até 50 receitas e 50 custos por página.
- Custo ausente/ambíguo é desconhecido, nunca zero. Estimativas pendentes não autorizam faturamento.
- Campos financeiros ocultos/mascarados podem negar acesso; custo de profissional exige também acesso à pessoa e employment.view.workspace.
- Não somar novamente custo de origem e seus rateios de clientes.

## Erros comuns
"Fechamento integrado ainda não ativado neste workspace.": solicite configuração. PREVIEW_STALE: recalcule. REVISION_STALE: confira a última revisão.

## Relacionados
- [Consultar rentabilidade](/ajuda/contracts/consultar-rentabilidade)
- [Preparar medição](/ajuda/contracts/preparar-medicao)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 76, 1, true),
($hlp$contracts$hlp$, $hlp$gerar-de-modelo$hlp$, $hlp$Gerar contrato pelo diálogo de modelo publicado$hlp$, $hlp$Gerar contrato pelo diálogo de modelo publicado no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Gerar contrato pelo diálogo de modelo publicado
**Para que serve:** Gerar contrato pelo diálogo de modelo publicado.
**Quem pode fazer:** Usuário autenticado com acesso ao módulo e aos dados de origem; o caminho auditado depende também dos controles do banco, sem middleware granular explícito de modelos.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Modelo publicado disponível.

## Passo a passo
1. Clique em "Gerar de modelo".
2. Em "Gerar contrato a partir de modelo", escolha "Modelo publicado".
3. Preencha "Serviço (opcional)" e "Título do contrato (opcional)" se necessário.
4. Use "Pré-visualizar" para revisar o texto mesclado.
5. Clique em "Gerar contrato".
<!-- screenshot: Gerar contrato pelo diálogo de modelo publicado, sem dados pessoais reais -->

## Resultado esperado
"Contrato gerado em rascunho." e abertura da ficha.

## Regras e limites
- Prévia não é requisito obrigatório de geração, mas permite revisão.
- Empresa e negócio vêm do contexto; não são seletores desse diálogo.
- Trocar modelo, serviço ou título limpa a prévia.
- Título até 200 caracteres. Opções de serviços limitadas a 500.
- Geração não envia para assinatura nem aplica sobre contrato existente.

## Erros comuns
"Nenhum modelo publicado. Publique um modelo em Contratos → Modelos." ou "Modelo não encontrado": confira o modelo.

## Relacionados
- [Editar e publicar modelo](/ajuda/contracts/editar-publicar-modelo)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 25, 1, true),
($hlp$contracts$hlp$, $hlp$gerar-medicao-financeiro$hlp$, $hlp$Gerar título financeiro ou vincular título legado da medição$hlp$, $hlp$Gerar título financeiro ou vincular título legado da medição no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Gerar título financeiro ou vincular título legado da medição
**Para que serve:** Gerar título financeiro ou vincular título legado da medição.
**Quem pode fazer:** techprojects.measurement_finance.create.workspace e techfinance.entries.create.own, com acesso ao registro.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Medição pronta para o Financeiro, pendências resolvidas e vencimento definido.

## Passo a passo
1. Abra a medição e confira "Pendências para o Financeiro".
2. Se pronta, preencha "Vencimento" e clique em "Gerar no Financeiro".
3. Quando o fluxo oferecer vínculo legado, selecione o título existente correspondente em vez de criar outro.
4. Confira o vínculo financeiro e o resultado da operação.
<!-- screenshot: Gerar título financeiro ou vincular título legado da medição, sem dados pessoais reais -->

## Resultado esperado
Título interno a receber criado ou título legado vinculado, sem emissão de nota fiscal, boleto ou envio de cobrança.

## Regras e limites
- Geração exige estado pronto; na interface também pode ser retomada em falha. Apenas aprovada ainda fica desabilitada.
- Geração concluída é idempotente: repetição retorna o vínculo existente.
- Legado exige mesmo workspace, serviço, competência, moeda e valor; título não cancelado e sem outro vínculo ativo.
- Vínculo legado não cria um novo título. Outros legados não resolvidos podem bloquear.
- Título lançado não comprova recebimento.

## Erros comuns
GENERATE_BLOCKED: resolva os impedimentos. LEGACY_AMOUNT_MISMATCH: ajuste medição ou resolva no Financeiro.
"A aprovação foi mantida; tente de novo": falha capturada não comprova título criado.

## Relacionados
- [Estornar ou cancelar medição](/ajuda/contracts/estornar-medicao)
- [Aprovar medição](/ajuda/contracts/aprovar-medicao)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 74, 1, true),
($hlp$contracts$hlp$, $hlp$gerenciar-documentos-assinatura$hlp$, $hlp$Preparar documentos para assinatura eletrônica$hlp$, $hlp$Preparar documentos para assinatura eletrônica no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Preparar documentos para assinatura eletrônica
**Para que serve:** Preparar documentos para assinatura eletrônica.
**Quem pode fazer:** Permissões de techcontracts.esign conforme a ação: ler, criar, alterar, enviar, cancelar, excluir e gerenciar signatários.
**Onde fica:** TechContracts > Contratos (/settings/esign).
**Antes de começar:** Texto revisado e nomes/e-mails dos signatários; compartilhar links apenas com seus destinatários.

## Passo a passo
1. Abra a área de assinatura eletrônica em Configurações (/settings/esign).
2. Crie um documento com "Título", "Descrição" e "Conteúdo do documento".
3. Informe os signatários, nome, e-mail e ordem. Configure assinatura ordenada quando necessário.
4. Revise o documento e os signatários antes de enviar para assinatura.
5. Use o compartilhamento/cópia do link individual para encaminhá-lo ao signatário.
<!-- screenshot: Preparar documentos para assinatura eletrônica, sem dados pessoais reais -->

## Resultado esperado
Documento preparado e, após envio, disponibilizado para assinatura conforme sua validade e ordem.

## Regras e limites
- Título: até 255 caracteres; descrição: até 2.000; corpo: até 50.000.
- De 1 a 20 signatários. Ordem é um inteiro a partir de 1.
- "Documento enviado." indica disponibilização para assinatura e selagem do conteúdo. Não comprova entrega de e-mail.
- Após envio, não é permitido alterar conteúdo/signatários ou excluir. Documento finalizado não pode ser cancelado.
- Provedores selecionáveis em campos de contrato não comprovam integração ativa com DocuSign ou Clicksign.

## Erros comuns
"Documento indisponível para envio.": confira estado, validade e signatários.
"Signatário inválido.": revise nome, e-mail e ordem.

## Relacionados
- [Assinar por link](/ajuda/contracts/assinar-por-link)
- [Registrar evidência no contrato](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/settings/esign$hlp$, NULL, $hlp$internal$hlp$, 95, 1, true),
($hlp$contracts$hlp$, $hlp$gerenciar-modelos$hlp$, $hlp$Criar e organizar modelos de contrato$hlp$, $hlp$Criar e organizar modelos de contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Criar e organizar modelos de contrato
**Para que serve:** Criar e organizar modelos de contrato.
**Quem pode fazer:** Leitura de techcontracts.contract_templates; criação para novo/duplicar e exclusão para remover, no escopo aplicável.
**Onde fica:** TechContracts > Contratos (/contracts/templates).
**Antes de começar:** Escolher o tipo de contrato que o modelo atenderá.

## Passo a passo
1. Abra "Modelos de contrato".
2. Clique em "Novo modelo" para criar um modelo em branco.
3. Abra o modelo para editar seu conteúdo.
4. Na lista, use a ação de duplicação quando quiser reutilizar um modelo. Aguarde "Modelo duplicado.".
5. Para remover um modelo, use a ação de exclusão e confirme apenas após conferir o item.
<!-- screenshot: Criar e organizar modelos de contrato, sem dados pessoais reais -->

## Resultado esperado
Modelo disponível na lista; a criação não substitui a revisão do texto.

## Regras e limites
- Criar, atualizar e excluir têm permissões distintas.
- Modelos de contrato não são os modelos de proposta do TechSales.

## Erros comuns
Falha em criar, duplicar ou excluir: confira a mensagem e seu acesso ao modelo.

## Relacionados
- [Editar e publicar modelo](/ajuda/contracts/editar-publicar-modelo)
- [Importar modelo](/ajuda/contracts/importar-modelo)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/templates$hlp$, NULL, $hlp$internal$hlp$, 60, 1, true),
($hlp$contracts$hlp$, $hlp$importar-contrato$hlp$, $hlp$Importar e revisar um contrato PDF ou DOCX$hlp$, $hlp$Importar e revisar um contrato PDF ou DOCX no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Importar e revisar um contrato PDF ou DOCX
**Para que serve:** Importar e revisar um contrato PDF ou DOCX.
**Quem pode fazer:** Gerenciamento de techcontracts.imports; finalizar exige atualização do contrato criado.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** PDF até 15 MB ou DOCX até 10 MB com texto legível.

## Passo a passo
1. Clique em "Importar contrato" e selecione o arquivo.
2. Revise a opção de guardar o original; use "Visualizar contrato" se desejar.
3. Clique em "Extrair com IA".
4. Revise os campos extraídos no rascunho.
5. Clique em "Finalizar" para atualizar o rascunho e abrir a ficha.
<!-- screenshot: Importar e revisar um contrato PDF ou DOCX, sem dados pessoais reais -->

## Resultado esperado
Rascunho criado na extração e atualizado após a finalização.

## Regras e limites
- O rascunho é criado antes da revisão. Cancelar ou fechar não o apaga.
- "Voltar" retorna ao upload; não é desfazer a criação.
- DOCX precisa ter pelo menos 20 caracteres de texto extraído.
- Falha ao guardar o original pode permitir continuar com aviso; não é transação única.
- Extração por IA exige revisão e pode falhar por créditos, limites ou conteúdo inválido.
- Conseguir importar não garante permissão para finalizar a atualização.

## Erros comuns
"Formato não suportado. Use .pdf ou .docx.": converta o arquivo.
"Rascunho salvo em Contratos. Você pode retomar quando quiser.": confira o rascunho antes de repetir a importação.

## Relacionados
- [Importar em lote](/ajuda/contracts/importar-em-lote)
- [Consultar contratos](/ajuda/contracts/consultar-contratos)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 23, 1, true),
($hlp$contracts$hlp$, $hlp$importar-em-lote$hlp$, $hlp$Importar contratos em lote e revisar resultados$hlp$, $hlp$Importar contratos em lote e revisar resultados no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Importar contratos em lote e revisar resultados
**Para que serve:** Importar contratos em lote e revisar resultados.
**Quem pode fazer:** Gerenciamento de imports; pareamento exige links.manage e aditivos exigem atualização de contratos.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Arquivos válidos e principais identificados para os aditivos.

## Passo a passo
1. Clique em "Importar em lote" e adicione os arquivos.
2. Por arquivo, escolha "Detectar com IA", "Prestação (cliente final)" ou "Compra (prestador)".
3. Escolha "Principal" ou "Aditivo". Para aditivo, indique principal existente ou principal do lote, número e vigência quando aplicável.
4. Clique em "Processar".
5. Confira o resultado de cada item e seus vínculos. Use "Abrir" para revisar rascunhos criados.
<!-- screenshot: Importar contratos em lote e revisar resultados, sem dados pessoais reais -->

## Resultado esperado
Arquivos processados sequencialmente, com principais antes dos aditivos; resultados podem ser parciais.

## Regras e limites
- PDF até 15 MB e DOCX até 10 MB por arquivo.
- Nome/tamanho iguais evitam inclusão repetida na fila, não duplicação contra a base.
- A fila não tem teto explícito, mas o pareamento final aceita até 50 IDs. Lotes maiores podem criar rascunhos e falhar no pareamento.
- Papel manual prevalece sobre a IA. Sem papel extraído, o automático assume Prestação.
- Falha de vínculo de aditivo não apaga o rascunho nem garante repetição automática desse vínculo.
- "Processamento concluído." não significa sucesso de todos os arquivos e vínculos.

## Erros comuns
Aditivo sem principal impede iniciar. Revise itens com erro antes de tentar novamente; não reimporte cegamente um rascunho já criado.

## Relacionados
- [Revisar vinculação](/ajuda/contracts/revisar-vinculacao)
- [Importar individualmente](/ajuda/contracts/importar-contrato)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 24, 1, true),
($hlp$contracts$hlp$, $hlp$importar-modelo$hlp$, $hlp$Importar um modelo de contrato$hlp$, $hlp$Importar um modelo de contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Importar um modelo de contrato
**Para que serve:** Importar um modelo de contrato.
**Quem pode fazer:** Criação de techcontracts.contract_templates.
**Onde fica:** TechContracts > Contratos (/contracts/templates).
**Antes de começar:** Arquivo PDF ou DOCX com texto legível.

## Passo a passo
1. Clique em "Importar modelo".
2. Informe um nome se desejar.
3. Selecione o arquivo PDF ou DOCX.
4. Aguarde a extração e a sugestão de variáveis.
5. Abra o rascunho criado e revise seu conteúdo antes de publicar.
<!-- screenshot: Importar um modelo de contrato, sem dados pessoais reais -->

## Resultado esperado
"Modelo criado como rascunho. Revise as variáveis sugeridas."

## Regras e limites
- PDF: até 15 MB. DOCX: até 10 MB.
- A importação não publica o modelo. Sugestões de variáveis exigem revisão humana.

## Erros comuns
"Formato não suportado. Envie .pdf ou .docx.": converta o arquivo.
"Não foi possível extrair o texto do .docx.": revise o documento de origem.

## Relacionados
- [Editar e publicar modelo](/ajuda/contracts/editar-publicar-modelo)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/templates$hlp$, NULL, $hlp$internal$hlp$, 62, 1, true),
($hlp$contracts$hlp$, $hlp$iniciar-aprovacoes$hlp$, $hlp$Iniciar e reiniciar aprovações de contrato$hlp$, $hlp$Iniciar e reiniciar aprovações de contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Iniciar e reiniciar aprovações de contrato
**Para que serve:** Iniciar e reiniciar aprovações de contrato.
**Quem pode fazer:** Gerenciamento de techcontracts.approvals e atualização do contrato.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Contrato não vigente nem encerrado; condições revisadas.

## Passo a passo
1. Abra o painel de aprovações na ficha.
2. Clique em "Iniciar fluxo".
3. Acompanhe as etapas pendentes.
4. Quando precisar abrir uma nova cadeia, clique em "Reiniciar" e confirme a preservação das decisões anteriores no histórico.
<!-- screenshot: Iniciar e reiniciar aprovações de contrato, sem dados pessoais reais -->

## Resultado esperado
"Fluxo de aprovação iniciado" ou "Fluxo reiniciado"; contrato em revisão.

## Regras e limites
- Prestação: Jurídico → Financeiro. Compra: Compras → Financeiro → Jurídico.
- Cadeia não pode ser omitida ou reduzida.
- Iniciar sem reiniciar reutiliza o fluxo existente.
- Reiniciar preserva decisões antigas no histórico e abre nova geração.
- Ativos, encerrados e rescindidos não iniciam esse processo.

## Erros comuns
"Contrato encerrado ou vigente: use aditivo para novo processo." ou "A cadeia de aprovação não pode ser omitida ou reduzida.": respeite o processo indicado.

## Relacionados
- [Aprovar ou rejeitar](/ajuda/contracts/decidir-aprovacao)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 32, 1, true),
($hlp$contracts$hlp$, $hlp$padronizar-titulos$hlp$, $hlp$Revisar e padronizar títulos de contratos$hlp$, $hlp$Revisar e padronizar títulos de contratos no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Revisar e padronizar títulos de contratos
**Para que serve:** Revisar e padronizar títulos de contratos.
**Quem pode fazer:** Permissão de atualização de contratos, inclusive na prévia.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Conferir os registros e as sugestões antes de aplicar.

## Passo a passo
1. Clique em "Padronizar títulos" no cabeçalho ou na barra de seleção.
2. Confira a prévia dos títulos antes/depois.
3. Selecione os registros desejados; no diálogo geral, use "Selecionar todos" quando adequado.
4. Confirme a aplicação. A barra de seleção mostra exemplos antes de aplicar.
5. Revise o resultado e as falhas.
<!-- screenshot: Revisar e padronizar títulos de contratos, sem dados pessoais reais -->

## Resultado esperado
Títulos atualizados nos contratos selecionados, sem modificar seu papel por esse procedimento.

## Regras e limites
- Executor aceita de 1 a 500 IDs.
- "Nenhum título precisa de ajuste." indica que não há mudanças na prévia.
- Sugestão de título não substitui leitura do documento.

## Erros comuns
Contratos não atualizados devem ser revisados no resumo; não considere a padronização sucesso integral sem conferir.

## Relacionados
- [Consultar contratos](/ajuda/contracts/consultar-contratos)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 29, 1, true),
($hlp$contracts$hlp$, $hlp$perguntas-frequentes$hlp$, $hlp$Perguntas frequentes do TechContracts$hlp$, $hlp$Perguntas frequentes do TechContracts no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Perguntas frequentes do TechContracts
## TechServices é outro módulo?
Não. Serviços em execução pertence ao TechContracts. O identificador services permanece legado.

## Aprovar torna o contrato ativo?
Não. A cadeia concluída leva a Aguardando assinatura. Ativação tem autorização e regras próprias.

## Ativo comprova assinatura?
Não. A evidência precisa corresponder à versão salva, partes e condições.

## Preparar assinatura envia o documento?
Não. Preparação, envio para assinatura e conclusão são etapas separadas.

## Documento enviado significa e-mail entregue?
Não há comprovação de envio de e-mail no ramo auditado. Compartilhe o link pelo meio adequado e confira o destinatário.

## Escolher DocuSign ou Clicksign conecta o provedor?
Não. Um valor selecionável não configura credenciais ou integração operacional.

## Compra aninhada é aditivo?
Não. Compra sob prestação e aditivo de principal são relações diferentes.

## Posso cadastrar serviço pela lista de serviços?
A lista não oferece criação direta. Associe o serviço na ficha do contrato de prestação.

## Medição ou provisão gera cobrança automaticamente?
Não. Preparação, aprovação e geração financeira são operações distintas. Provisão registra previsão; não gera título por si só.

## Todos os campos extraídos são editáveis?
Não. A ficha tem campos editáveis e um card separado de detalhes extraídos em leitura.

## Relacionados
- [Primeiros 15 minutos](/ajuda/contracts/primeiros-15-minutos)
- [Campos e status](/ajuda/contracts/campos-e-status)$hlp$, $hlp$faq$hlp$, NULL, NULL, $hlp$internal$hlp$, 5, 1, true),
($hlp$contracts$hlp$, $hlp$permissoes$hlp$, $hlp$Permissões do TechContracts$hlp$, $hlp$Permissões do TechContracts no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Permissões do TechContracts
## Acesso à Ajuda
Artigos internos usam o acesso ao módulo e às permissões efetivas do workspace. O menu TechContracts não declara uma chave mínima individual por item; estes artigos deixam a chave mínima vazia, sem inventar uma permissão. Isso não libera ações no contrato.

## Recursos e ações
| Área | Recurso / exigência |
|---|---|
| Contratos | techcontracts.contracts: leitura, criação, atualização, exclusão e exportação conforme escopo |
| Mudança de status | Atualização do registro + techcontracts.contract_transition.manage.workspace |
| Ativação manual | Também techcontracts.contract_activation.manage.workspace |
| Aprovações | techcontracts.approvals: view, manage, approve conforme ação |
| Histórico de aprovação | techcontracts.audit: view |
| Modelos | techcontracts.contract_templates: view, create, update, delete |
| Padrões | techcontracts.defaults: view; salvar exige manage e techcontracts.contracts.update.workspace |
| Serviços | techservice.services: view, create, update, delete no escopo aplicável |
| Associação ao catálogo | Caminho da ficha exige techservice.services.create.own |
| Evidência de assinatura | techcontracts.signature_evidence.view.workspace; gerenciar exige manage.workspace e capacidade do servidor |
| Preparação de assinatura | Também criação em techcontracts.esign no escopo aceito |
| Medições | Leitura do contrato + techprojects.billing_config / measurements / profitability, conforme seção |
| Provisões | techfinance.provisions e acesso a tarifas de TechProjects, conforme ação |

Escopos own, team e workspace não são intercambiáveis. Um botão visível não comprova autorização. Responsável pelo cadastro é informação operacional, não substitui controle de acesso.

## Ações especiais
Enviar, cancelar e compartilhar assinatura, aprovar ou gerar medição e revisar provisões possuem verificações próprias. Acesso ao módulo não concede essas ações. Para mudar acesso, procure o responsável pelas permissões; não use outra conta nem tente contornar pela URL.

## Divergências
O material preserva o comportamento existente. Diferenças entre menu, tela e controle do servidor estão em docs/help/divergencias.md; nenhuma permissão foi ampliada nesta entrega.

## Relacionados
- [Aprovações](/ajuda/contracts/iniciar-aprovacoes)
- [Medições](/ajuda/contracts/preparar-medicao)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 3, 1, true),
($hlp$contracts$hlp$, $hlp$preparar-medicao$hlp$, $hlp$Preparar e consultar medições do contrato$hlp$, $hlp$Preparar e consultar medições do contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Preparar e consultar medições do contrato
**Para que serve:** Preparar e consultar medições do contrato.
**Quem pode fazer:** Leitura do contrato e das seções TechProjects; preparar exige techprojects.measurements.manage.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Modelo de cobrança ativo e competência definida.

## Passo a passo
1. Na ficha, clique em "Medições".
2. Em "Modelo de cobrança", escolha um modelo ativo.
3. Preencha "Competência" e escolha "Tipo": "Regular" ou "Complemento".
4. Clique em "Preparar medição".
5. Revise o detalhamento aberto após "Rascunho da medição pronto para revisão.".
<!-- screenshot: Preparar e consultar medições do contrato, sem dados pessoais reais -->

## Resultado esperado
Rascunho de medição preparado para revisão, sem emissão ou envio automático ao cliente.

## Regras e limites
- Competência inicial é o mês anterior e o fuso é o do navegador.
- Lista paginada de 20 medições. Abrir a lista não cria medição.
- Etapas são separadas: rascunho, revisão, aprovação, pronta e geração no Financeiro.
- Fechar horas ou obter aceite do cliente não é gerar fatura nem receber pagamento.
- Acesso a contratos não libera automaticamente cobrança, medições, provisões ou rentabilidade.

## Erros comuns
"Configure o modelo primeiro": cadastre um modelo ativo.
"Nenhuma medição": configure cobrança e prepare a competência.

## Relacionados
- [Configurar cobrança](/ajuda/contracts/configurar-cobranca)
- [Revisar medição](/ajuda/contracts/revisar-medicao)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 70, 1, true),
($hlp$contracts$hlp$, $hlp$primeiros-15-minutos$hlp$, $hlp$Primeiros 15 minutos no TechContracts$hlp$, $hlp$Primeiros 15 minutos no TechContracts no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Primeiros 15 minutos no TechContracts
## 1. Reconheça a carteira
Abra Dashboard e depois Contratos. Veja as abas e filtros. Os indicadores respeitam limites de consulta; não são uma prova de toda a base.

## 2. Abra uma ficha
Confira título, tipo, valor e vigência. Diferencie prestação, compra e aditivo. Não altere um registro real apenas para treinar.

## 3. Entenda os vínculos
Prestação pode reunir serviços e contratos de compra aninhados. Aditivo tem principal do mesmo papel e é uma relação distinta.

## 4. Confira o processo
Aprovação leva a Aguardando assinatura, não a Ativo. Preparar assinatura não conclui assinatura. Evidência deve corresponder à versão salva.

## 5. Consulte a cobrança
Medições reúne configuração de cobrança e etapas de revisão/aprovação/geração financeira. Provisão não é título a pagar ou receber. Não gere lançamentos para treinar.

## Próxima leitura
- [Criar contrato](/ajuda/contracts/criar-contrato)
- [Editar contrato](/ajuda/contracts/editar-contrato)
- [Medições](/ajuda/contracts/preparar-medicao)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$quickstart$hlp$, NULL, NULL, $hlp$internal$hlp$, 1, 1, true),
($hlp$contracts$hlp$, $hlp$recalcular-papeis$hlp$, $hlp$Revisar e recalcular Prestação ou Compra$hlp$, $hlp$Revisar e recalcular Prestação ou Compra no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Revisar e recalcular Prestação ou Compra
**Para que serve:** Revisar e recalcular Prestação ou Compra.
**Quem pode fazer:** Gerenciamento de techcontracts.links e acesso aos contratos.
**Onde fica:** TechContracts > Contratos (/contracts/links).
**Antes de começar:** Conferir a WK como prestadora ou contratante nos documentos.

## Passo a passo
1. Na vinculação, clique em "Recalcular papéis".
2. Revise o diagnóstico de Prestação/Compra.
3. Selecione somente correções confirmadas e aplique.
4. Confira o resultado.
<!-- screenshot: Revisar e recalcular Prestação ou Compra, sem dados pessoais reais -->

## Resultado esperado
Papel comercial corrigido nos registros selecionados.

## Regras e limites
- Aplicação aceita de 1 a 500 IDs.
- Prestação/Compra não é Principal/Aditivo.
- Diagnóstico não substitui conferência do documento.

## Erros comuns
Sugestão incorreta: deixe sem seleção. Falha de acesso ou gravação: revise a mensagem.

## Relacionados
- [Revisar tipo de documento](/ajuda/contracts/revisar-tipo-documento)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/links$hlp$, NULL, $hlp$internal$hlp$, 45, 1, true),
($hlp$contracts$hlp$, $hlp$registrar-assinatura$hlp$, $hlp$Preparar e registrar evidência de assinatura no contrato$hlp$, $hlp$Preparar e registrar evidência de assinatura no contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Preparar e registrar evidência de assinatura no contrato
**Para que serve:** Preparar e registrar evidência de assinatura no contrato.
**Quem pode fazer:** techcontracts.signature_evidence.view.workspace para ler; manage.workspace e capacidade do servidor para gerenciar; preparação exige também criação de esign.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Salvar a versão final do contrato e revisar suas partes e condições.

## Passo a passo
1. Abra "Assinatura e origem do recrutamento".
2. Para assinatura interna, clique em "Preparar assinatura no TechERP" e preencha representantes/e-mails do cliente e da entidade WK.
3. Conclua a preparação; siga depois o envio e assinatura do documento preparado.
4. Para assinatura externa, clique em "Registrar assinatura externa".
5. Informe "PDF assinado (até 5 MB)", "Data da assinatura", "Referência do provedor ou certificado" e "Como foi conferido". Faça a confirmação explícita antes de concluir.
<!-- screenshot: Preparar e registrar evidência de assinatura no contrato, sem dados pessoais reais -->

## Resultado esperado
Documento preparado aguardando envio/conclusão, ou evidência externa registrada para a versão conferida.

## Regras e limites
- As ações usam a versão salva do contrato.
- Preparar não é enviar nem concluir assinatura.
- Ativar ou preencher uma data não comprova assinatura.
- Registro externo depende de conferência humana; não valida criptograficamente as assinaturas.
- Alterar conteúdo, partes ou condições exige nova evidência.

## Erros comuns
"Selecione um PDF de até 5 MB.": revise formato/tamanho.
"Sem permissão ou contrato alterado. Recarregue.": recarregue e confira a versão.
"Não foi possível guardar o PDF assinado.": tente novamente após conferir o arquivo.

## Relacionados
- [Consultar e revogar evidências](/ajuda/contracts/revogar-evidencia)
- [Documentos de assinatura](/ajuda/contracts/gerenciar-documentos-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 37, 1, true),
($hlp$contracts$hlp$, $hlp$registrar-origem-comercial$hlp$, $hlp$Salvar origem comercial e definir origem do recrutamento$hlp$, $hlp$Salvar origem comercial e definir origem do recrutamento no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Salvar origem comercial e definir origem do recrutamento
**Para que serve:** Salvar origem comercial e definir origem do recrutamento.
**Quem pode fazer:** Leitura e gerenciamento de techcontracts.signature_evidence, com capacidade de gerenciamento devolvida pelo servidor.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Negócio correto e CNPJ WK disponíveis.

## Passo a passo
1. Abra "Assinatura e origem do recrutamento".
2. Escolha "Negócio" e "Entidade WK prestadora" em "Selecione o CNPJ".
3. Clique em "Salvar origem".
4. Quando adequado, clique em "Definir como origem do recrutamento".
<!-- screenshot: Salvar origem comercial e definir origem do recrutamento, sem dados pessoais reais -->

## Resultado esperado
Origem comercial salva; definição da origem do recrutamento é uma ação separada.

## Regras e limites
- Cliente vem do negócio selecionado.
- Mudar origem ou entidade invalida correspondência com assinaturas anteriores.
- Definir origem não registra assinatura, não aprova a demanda nem libera recrutamento sozinho.
- Ainda são necessárias aprovação da área, CEO e demais regras aplicáveis.

## Erros comuns
"Autorização comercial pendente": leia os impedimentos. Sem negócio ou CNPJ, não é possível salvar origem.

## Relacionados
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 36, 1, true),
($hlp$contracts$hlp$, $hlp$revisar-medicao$hlp$, $hlp$Revisar, ajustar e enviar uma medição para revisão$hlp$, $hlp$Revisar, ajustar e enviar uma medição para revisão no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Revisar, ajustar e enviar uma medição para revisão
**Para que serve:** Revisar, ajustar e enviar uma medição para revisão.
**Quem pode fazer:** techprojects.measurements.view.workspace para consultar e manage.workspace para atualizar, ajustar e enviar.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Medição em rascunho e fontes disponíveis.

## Passo a passo
1. Abra o detalhe da medição.
2. Clique em "Atualizar prévia" e confira linhas, itens excluídos e pendências.
3. Quando necessário, use "Adicionar ajuste", informando descrição, valor e motivo. Valor negativo representa desconto.
4. Para sucesso/Hunting, use "Adicionar evento" e escolha proposta ou candidatura do TechHire com identificador/base exigidos.
5. Resolva "Pendências (impedem envio e aprovação)".
6. Clique em "Enviar para revisão".
<!-- screenshot: Revisar, ajustar e enviar uma medição para revisão, sem dados pessoais reais -->

## Resultado esperado
Medição em revisão; nenhum documento ou cobrança enviado ao cliente.

## Regras e limites
- Ajuste: descrição de 3–200 caracteres, valor finito diferente de zero e motivo de 10–2.000 caracteres.
- Evento exige UUID válido; o sistema não presume um evento de sucesso automaticamente.
- Fontes alteradas exigem atualizar a prévia. Envio valida o hash.
- Ajuste não é alteração silenciosa da tarifa.

## Erros comuns
SUBMIT_BLOCKED: resolva as pendências impeditivas. Prévia desatualizada: atualize antes de enviar.

## Relacionados
- [Aprovar medição](/ajuda/contracts/aprovar-medicao)
- [Preparar medição](/ajuda/contracts/preparar-medicao)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 72, 1, true),
($hlp$contracts$hlp$, $hlp$revisar-tipo-documento$hlp$, $hlp$Revisar contratos principais que parecem aditivos$hlp$, $hlp$Revisar contratos principais que parecem aditivos no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Revisar contratos principais que parecem aditivos
**Para que serve:** Revisar contratos principais que parecem aditivos.
**Quem pode fazer:** links.view para diagnóstico; links.manage e atualização de contratos para aplicar.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Confirmar principal e papel comercial de cada suspeito.

## Passo a passo
1. Clique em "Revisar tipo de documento".
2. Revise suspeitos e motivos do diagnóstico.
3. Selecione os registros e confira principal e número de aditivo.
4. Aplique as correções selecionadas.
5. Confira itens corrigidos, ignorados e eventuais falhas.
<!-- screenshot: Revisar contratos principais que parecem aditivos, sem dados pessoais reais -->

## Resultado esperado
Contratos selecionados classificados como aditivo e vinculados ao principal indicado.

## Regras e limites
- Diagnóstico usa até 2.000 contratos mais recentes, com sinais de título, avisos, número e arquivo.
- Não é extração de todos os documentos por IA.
- Até 10 candidatos por suspeito; primeira sugestão não prova correspondência.
- Aplicação grava tipo, principal, número, vigência a partir do início e título padronizado quando disponível.
- Revisão Principal/Aditivo não é recálculo Prestação/Compra.

## Erros comuns
Suspeita incorreta: não selecione. Falha no diagnóstico: use nova tentativa. Itens já aditivos, ausentes ou autovinculados podem ser ignorados.

## Relacionados
- [Recalcular papéis](/ajuda/contracts/recalcular-papeis)
- [Vincular aditivos](/ajuda/contracts/vincular-aditivo)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 42, 1, true),
($hlp$contracts$hlp$, $hlp$revisar-vinculacao$hlp$, $hlp$Vincular contratos e remover pendências da fila$hlp$, $hlp$Vincular contratos e remover pendências da fila no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Vincular contratos e remover pendências da fila
**Para que serve:** Vincular contratos e remover pendências da fila.
**Quem pode fazer:** Leitura de techcontracts.links; dispensar exige gerenciamento; aplicar vínculo exige atualização de contratos e acesso aos registros.
**Onde fica:** TechContracts > Contratos (/contracts/links).
**Antes de começar:** Identificar compra, prestação ou aditivo e destino correto.

## Passo a passo
1. Clique em "Vincular contratos" na lista.
2. Na tela "Vinculação de contratos", use "Buscar" e "Tipo": Todos, Prestação, Compra ou Aditivos.
3. Clique em "Vincular" no registro, escolha o destino e confirme.
4. Compra deve apontar para prestação; aditivo deve apontar para principal do mesmo papel.
5. Se a pendência não exigir vínculo, use "Remover da fila".
<!-- screenshot: Vincular contratos e remover pendências da fila, sem dados pessoais reais -->

## Resultado esperado
"Contratos vinculados.", "Aditivo vinculado." ou "Contrato removido da fila de vinculação.", conforme ação.

## Regras e limites
- Busca filtra localmente os registros carregados; fila limitada a 500.
- Remover da fila não exclui contrato, não cria vínculo e não pede confirmação nesse componente.
- Candidatos da tela ainda podem ser recusados pelas regras do servidor.
- Compra/prestação e principal/aditivo são relações distintas.

## Erros comuns
Destino recusado: confira papel, tipo de documento, autovínculo e nível permitido.

## Relacionados
- [Aninhar contratos](/ajuda/contracts/aninhar-contratos)
- [Sugestões de IA](/ajuda/contracts/analisar-vinculos-ia)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/links$hlp$, NULL, $hlp$internal$hlp$, 43, 1, true),
($hlp$contracts$hlp$, $hlp$revogar-evidencia$hlp$, $hlp$Consultar comprovante e revogar evidência de assinatura$hlp$, $hlp$Consultar comprovante e revogar evidência de assinatura no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar comprovante e revogar evidência de assinatura
**Para que serve:** Consultar comprovante e revogar evidência de assinatura.
**Quem pode fazer:** Leitura de signature_evidence; para revogar, gerenciamento e capacidade do servidor.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Identificar a evidência correta e justificar a revogação.

## Passo a passo
1. Abra o card de assinatura na ficha.
2. Consulte a evidência e abra o comprovante quando disponível.
3. Quando necessário, clique em "Revogar evidência".
4. Informe "Motivo" com pelo menos 10 caracteres.
5. Clique em "Revogar" e confira o resultado.
<!-- screenshot: Consultar comprovante e revogar evidência de assinatura, sem dados pessoais reais -->

## Resultado esperado
Evidência revogada com motivo registrado; a revogação não deve ser confundida com exclusão do contrato.

## Regras e limites
- Comprovante respeita o acesso ao contrato/evidência.
- Revogar é ação distinta de editar status ou cancelar documento de assinatura.

## Erros comuns
"Comprovante indisponível no seu acesso." ou "Não foi possível abrir o PDF.": confira sua autorização e a disponibilidade do arquivo.

## Relacionados
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 38, 1, true),
($hlp$contracts$hlp$, $hlp$verificar-um-documento-pelo-hash$hlp$, $hlp$Verificar um documento pelo hash$hlp$, $hlp$Verificar um documento pelo hash.$hlp$, $hlp$# Verificar um documento pelo hash

**Para que serve:** Verificar um documento pelo hash, no contexto da tela `/verify/$hash`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/verify/$hash`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link de verificação do documento.
2. Confira o resultado e os dados de verificação apresentados.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Verificação não assina o documento nem permite alterar seu conteúdo.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `contracts`; consulte os artigos desse módulo em `/ajuda/contracts`.

<!-- screenshot: capturar /verify/$hash com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/verify/$hash$hlp$, NULL, $hlp$internal$hlp$, 219, 1, true),
($hlp$contracts$hlp$, $hlp$vincular-aditivo$hlp$, $hlp$Vincular e desvincular aditivos$hlp$, $hlp$Vincular e desvincular aditivos no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Vincular e desvincular aditivos
**Para que serve:** Vincular e desvincular aditivos.
**Quem pode fazer:** Atualização do contrato e das relações no escopo autorizado.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Ter contrato principal e aditivo do mesmo papel.

## Passo a passo
1. Para classificar pela ficha, escolha "Tipo de documento" = "Aditivo", selecione "Contrato principal" e salve.
2. No painel de aditivos, use "Vincular aditivo" ou "Alterar contrato principal".
3. Selecione o contrato correspondente e informe "Número do aditivo" e "Vigência do aditivo" quando aplicável.
4. Clique em "Vincular".
5. Para desvincular, use a ação de remover vínculo e confirme "Remover o vínculo de aditivo deste contrato?".
<!-- screenshot: Vincular e desvincular aditivos, sem dados pessoais reais -->

## Resultado esperado
"Aditivo vinculado." ou "Vínculo de aditivo removido.".

## Regras e limites
- Um contrato não pode ser aditivo de si mesmo.
- Aditivo não pode ser principal de outro aditivo.
- Principal e aditivo devem ter o mesmo papel.
- Alterar para Principal remove vínculo, número e vigência do aditivo após confirmação.
- Essa relação não é o aninhamento de compra sob prestação.

## Erros comuns
"Contrato principal não encontrado." ou "O aditivo deve ter o mesmo papel do contrato principal.": revise o destino.

## Relacionados
- [Aninhar compra e prestação](/ajuda/contracts/aninhar-contratos)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 34, 1, true),
($hlp$contracts$hlp$, $hlp$visao-geral$hlp$, $hlp$Visão geral do TechContracts$hlp$, $hlp$Visão geral do TechContracts no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Visão geral do TechContracts
## O que o módulo reúne
O TechContracts reúne contratos de prestação e compra, modelos, aprovações, evidências de assinatura e serviços em execução. Não existe módulo vertical TechServices: a tela de Serviços em execução pertence ao TechContracts.

## Navegação
- Visão geral > Dashboard.
- Contratos > Contratos, Modelos de contrato, Serviços em execução e Padrões de contrato.
- Na ficha: Fluxo do contrato, Medições, aditivos, compras aninhadas e assinatura, conforme acesso.

## Operações separadas
Criar contrato, aprovar, registrar assinatura, ativar serviço, preparar medição e gerar título financeiro são operações distintas. Nenhuma dessas situações, sozinha, comprova as demais.

## Comece por aqui
- [Primeiros 15 minutos](/ajuda/contracts/primeiros-15-minutos)
- [Consultar contratos](/ajuda/contracts/consultar-contratos)
- [Criar contrato](/ajuda/contracts/criar-contrato)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$overview$hlp$, NULL, NULL, $hlp$internal$hlp$, 0, 1, true)
ON CONFLICT (module_key, slug) DO NOTHING;
INSERT INTO public.help_articles
  (module_key, slug, title, summary, body_md, article_type, route_pattern, min_permission, audience, sort_order, version, is_published)
VALUES
($hlp$projects$hlp$, $hlp$abrir-configuracoes$hlp$, $hlp$Abrir configurações do TechProjects$hlp$, $hlp$Abrir configurações do TechProjects no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Abrir configurações do TechProjects

**Para que serve:** A rota de configurações abre o hub de importações.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Configurações / ficha vinculada (`/projects/settings`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Acesse /projects/settings.
2. Aguarde o redirecionamento para /projects/settings/imports.
3. Escolha a fonte desejada no hub ou uma configuração específica pelo menu lateral.

## Resultado esperado
A rota de configurações abre o hub de importações.

## Regras e limites
É uma rota de redirecionamento, não uma tela de edição. A tela de destino aplica seu controle de acesso.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Abrir configurações do TechProjects; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/settings$hlp$, NULL, $hlp$internal$hlp$, 130, 1, true),
($hlp$projects$hlp$, $hlp$campos-e-status$hlp$, $hlp$Campos e status do TechProjects$hlp$, $hlp$Campos e status do TechProjects no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Campos e status do TechProjects
## Projeto
- Nome: obrigatório na criação rápida; descrição contextualiza a entrega.
- Prazo: data prevista; não comprova conclusão. Horas planejadas: estimativa, não apontamento aprovado.
- Situação: planning (Planejamento), active (Execução), on_hold (Em espera), done (Concluído), cancelled (Cancelado).
## Organização e tarefa
Espaço agrupa pastas e listas; a lista oferece quadro, lista, calendário, linha do tempo e carga de trabalho. Tarefa tem título, prazo, responsável e os campos expostos na ficha; checklist, tags, dependências e campos personalizados são complementos. Status de lista são gerenciáveis: não há catálogo universal a presumir para todas as listas.
## Apontamento
- Projeto e atividade identificam onde o trabalho ocorreu. Atividade pode ser criada por título de 2 a 200 caracteres quando autorizada.
- Data, início e término representam intervalo; término deve ser posterior ao início no mesmo dia. Duração isolada não inventa horário.
- Duração manual: inteiro entre 60 e 86.400 segundos. Entrada aceita formas como 1h30, 1:30, 90m, 1.5 e 1,5 no parser de duração.
- Descrição: até 2.000 caracteres. Faturável é uma marca de elegibilidade, não uma cobrança.
- Status: draft (Rascunho), submitted (Enviado), approved (Aprovado), rejected (Devolvido), locked (Travado).
- Origens: Manual, Cronômetro, API, Integração e Importação. Travado com origem Importação é histórico e não equivale a aprovado.
- Alertas: sem horário/sobreposição não verificável, limite diário excedido, sobreposição e horário local ambíguo na troca de horário de verão. Alerta requer revisão, não correção silenciosa.
## Entrega
Farol green/Verde, yellow/Atenção, red/Crítico; evolução percentual; previsão; título e resumo macro. Visibilidade internal/Interno ou commercial/Visível ao comercial. Checkpoint manual difere de evento automático.
## Aprovação, aceite e fechamento
Aprovador é nomeado. Aceite registra resultado, pessoa que aceitou, e-mail opcional, referência opcional e evidência. Competência fechada impede gravação até reabertura autorizada. Meta vem de jornada do People; sem jornada, a meta é desconhecida.
## Tarifas e finanças
Tarifa tem tipo, escopo/alvo, unidade, moeda, valor e vigência com início inclusivo e fim exclusivo. Motivo tem mínimo de cinco caracteres. Custos sem tarifa válida são desconhecidos. No financeiro, medido, aprovado, lançado e recebido não são sinônimos.
## Relacionados
[Registrar horas](/ajuda/projects/operar-my-hours) · [Permissões](/ajuda/projects/permissoes)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 310, 1, true),
($hlp$projects$hlp$, $hlp$consultar-projetos$hlp$, $hlp$Consultar e criar projetos$hlp$, $hlp$Consultar e criar projetos no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Consultar e criar projetos

**Para que serve:** O projeto criado aparece na listagem disponível ao seu usuário e pode ser aberto pela ficha.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.projects.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Projetos (`/projects`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Projetos > Projetos e busque pelo nome ou filtre o status. Confira os resultados antes de selecionar registros.
2. Abra a criação de projeto, informe Nome e, quando necessário, Descrição, Prazo e Horas planejadas. Salve e aguarde a confirmação.
3. Abra o projeto para consultar tarefas, marcos, timesheet e membros. Use a seleção da grade apenas depois de revisar os filtros e o escopo da ação.

## Resultado esperado
O projeto criado aparece na listagem disponível ao seu usuário e pode ser aberto pela ficha.

## Regras e limites
O nome é obrigatório. Criar projeto exige capacidade de criação; consultar não autoriza editar nem excluir. A grade usa filtros e seleção; a seleção não altera as permissões de cada registro.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Consultar e criar projetos; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects$hlp$, $hlp$techprojects.projects.view.own$hlp$, $hlp$internal$hlp$, 30, 1, true),
($hlp$projects$hlp$, $hlp$copiar-semana$hlp$, $hlp$Copiar apontamentos de uma semana$hlp$, $hlp$Copiar apontamentos de uma semana no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Copiar apontamentos de uma semana

**Para que serve:** As cópias bem-sucedidas são criadas como rascunho para revisão.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Minhas Horas (`/projects/my-hours`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra a ação de cópia de semana na visão de horas em que estiver disponível.
2. Confira os registros de origem e a semana de destino; selecione o que deseja copiar.
3. Confirme a cópia e revise separadamente quantos apontamentos foram criados e quantos falharam.

## Resultado esperado
As cópias bem-sucedidas são criadas como rascunho para revisão.

## Regras e limites
Falhas podem ser parciais. Não repita toda a cópia sem conferir o que já entrou; cada gravação é validada.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Copiar apontamentos de uma semana; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, NULL, NULL, $hlp$internal$hlp$, 240, 1, true),
($hlp$projects$hlp$, $hlp$editar-detalhes-tarefa$hlp$, $hlp$Editar checklist, tags e dependências de uma tarefa$hlp$, $hlp$Editar checklist, tags e dependências de uma tarefa no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Editar checklist, tags e dependências de uma tarefa

**Para que serve:** A ficha da tarefa reflete as alterações autorizadas e confirmadas.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Espaços > Lista > Tarefa (`/projects/lists/$id`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra a tarefa na lista ou na grade de tarefas.
2. Confira as capacidades de alteração antes de editar os campos principais.
3. Na seção correspondente, adicione tags, inclua ou marque itens de checklist e selecione tarefas para dependências.
4. Atualize campos personalizados existentes e aguarde a confirmação de cada alteração.

## Resultado esperado
A ficha da tarefa reflete as alterações autorizadas e confirmadas.

## Regras e limites
Referências de campos e dependências dependem dos registros disponíveis. Gerenciar a definição do campo não é o mesmo que atualizar seu valor.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Editar checklist, tags e dependências de uma tarefa; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, NULL, NULL, $hlp$internal$hlp$, 260, 1, true),
($hlp$projects$hlp$, $hlp$enviar-periodo$hlp$, $hlp$Enviar um período para aprovação$hlp$, $hlp$Enviar um período para aprovação no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Enviar um período para aprovação

**Para que serve:** O período elegível é encaminhado para os aprovadores definidos, sem aprovação automática.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Minhas Horas (`/projects/my-hours`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Na visão de horas, abra o envio de período e confira o intervalo.
2. Leia a prévia: registros, total, avisos e bloqueios. Resolva os bloqueios antes de continuar.
3. Confirme o envio e confira a situação dos apontamentos. Se os dados mudarem, gere nova prévia antes de confirmar.

## Resultado esperado
O período elegível é encaminhado para os aprovadores definidos, sem aprovação automática.

## Regras e limites
Prévia contém hash, revisão, versão da política, bloqueios e avisos. Envio depende da revalidação no banco. Editar registro enviado o retorna a rascunho.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Enviar um período para aprovação; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, NULL, NULL, $hlp$internal$hlp$, 230, 1, true),
($hlp$projects$hlp$, $hlp$erros-comuns$hlp$, $hlp$Erros comuns do TechProjects$hlp$, $hlp$Erros comuns do TechProjects no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Erros comuns do TechProjects
## Registro indisponível ou sem permissão de consulta
Confirme workspace, vínculo ativo e recurso/escopo. A mensagem não permite concluir se o registro foi removido ou está fora da carteira. Solicite revisão de acesso; não tente outra URL para contornar a decisão.
## O horário final deve ser maior que o horário inicial
Corrija início e término. O formulário de intervalo valida o mesmo dia; não use término menor para representar trabalho que atravessa a meia-noite. Revise registros separados por dia quando apropriado.
## Já existe um apontamento neste intervalo
Confira seus registros do dia e elimine a sobreposição real antes de salvar. Não use duração isolada para ocultar o conflito. Sem horário, a verificabilidade da sobreposição é limitada e há sinalização de revisão.
## Informe a atividade realizada
Selecione a atividade existente ou, quando autorizado, informe título válido para criação. Sem atividade elegível o apontamento não é salvo.
## Duração ou descrição inválida
Use duração manual entre 1 minuto e 24 horas e descrição de até 2.000 caracteres. Revise também data, projeto e formato de entrada.
## Envio bloqueado ou prévia desatualizada
Leia os bloqueios da prévia, confira aprovador e política. Mudança de registros pode exigir nova prévia; não repita confirmação antiga.
## Competência fechada
Solicite revisão do fechamento por usuário autorizado. Reabertura exige justificativa; criar por outro caminho, API ou fila local não contorna a competência.
## Importação não produziu registros
Confira se executou apenas prévia, se confirmou a origem e os mapeamentos e se a execução terminou. Resolva pendências e duplicidades antes de repetir; prévia não é gravação definitiva.
## Custo ou capacidade sem cobertura
Confira vigência da tarifa, escopo e jornada. Ausência de dado não deve ser convertida em zero; solicite cadastro ao responsável autorizado.
## Falha de conexão ou pendente local
Revise a fila e a confirmação do servidor antes de reenviar. Armazenado no aparelho não é salvo no ERP; sair apaga a fila local. Nunca envie chaves em capturas ou chamados.
## Relacionados
[Campos e status](/ajuda/projects/campos-e-status) · [Permissões](/ajuda/projects/permissoes)$hlp$, $hlp$troubleshooting$hlp$, NULL, NULL, $hlp$internal$hlp$, 330, 1, true),
($hlp$projects$hlp$, $hlp$gerenciar-campos-lista$hlp$, $hlp$Gerenciar campos personalizados da lista$hlp$, $hlp$Gerenciar campos personalizados da lista no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Gerenciar campos personalizados da lista

**Para que serve:** A definição de campo fica disponível na lista para preenchimento nas tarefas.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Espaços > Lista > Tarefa (`/projects/lists/$id`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra uma lista e acione o gerenciador de campos personalizados.
2. Confira os campos existentes antes de cadastrar outro.
3. Preencha a definição no formulário exibido e confirme a criação.
4. Para remover, confira o campo selecionado e a confirmação; depois revise a ficha das tarefas.

## Resultado esperado
A definição de campo fica disponível na lista para preenchimento nas tarefas.

## Regras e limites
Exige capacidade manage em techprojects.custom_fields. Não confunda remover a definição com limpar um único valor de tarefa.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Gerenciar campos personalizados da lista; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, NULL, NULL, $hlp$internal$hlp$, 270, 1, true),
($hlp$projects$hlp$, $hlp$operar-dashboard$hlp$, $hlp$Consultar o Dashboard de projetos$hlp$, $hlp$Consultar o Dashboard de projetos no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Consultar o Dashboard de projetos

**Para que serve:** Indicadores e detalhes refletem o período e o conjunto de dados permitido ao usuário.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.projects.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Dashboard (`/projects/dashboard`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Visão geral > Dashboard. Ajuste o período e os filtros disponíveis.
2. Comece pela Visão geral e selecione somente as visões por perfil que estiverem disponíveis para sua conta.
3. Abra o detalhamento de um indicador para conferir sua composição; compare listas usando o mesmo período.
4. Consulte a cobertura antes de interpretar capacidade, custo ou margem. Abra alertas e, quando autorizado, registre a decisão com justificativa.
5. Use o assistente para consultar os indicadores disponíveis; confirme a interpretação no detalhamento.

## Resultado esperado
Indicadores e detalhes refletem o período e o conjunto de dados permitido ao usuário.

## Regras e limites
As visões dependem de escopo, não do nome do cargo. Leitura não reavalia alertas automaticamente. O assistente é somente leitura. Sem jornada não há capacidade presumida; custo sem cobertura não deve ser tratado como zero.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Consultar o Dashboard de projetos; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/dashboard$hlp$, $hlp$techprojects.projects.view.own$hlp$, $hlp$internal$hlp$, 10, 1, true),
($hlp$projects$hlp$, $hlp$operar-delivery$hlp$, $hlp$Configurar a entrega de negócios ganhos$hlp$, $hlp$Configurar a entrega de negócios ganhos no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Configurar a entrega de negócios ganhos

**Para que serve:** Novas transições elegíveis passam pelo fluxo de criação ou vínculo de projeto de entrega.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Entrega de negócios (`/projects/settings/delivery`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Entrega de negócios e confira a política atual.
2. Defina o criador dos projetos automáticos e, se necessário, o responsável operacional padrão.
3. Revise a política antes de ativar e confirme a ativação pelo comando exibido.
4. Ao ocorrer uma nova transição de negócio para etapa de ganho, acompanhe o vínculo de entrega e o projeto em planejamento.

## Resultado esperado
Novas transições elegíveis passam pelo fluxo de criação ou vínculo de projeto de entrega.

## Regras e limites
Não reprocessa automaticamente o histórico anterior à ativação. Ganho é definido pelo tipo da etapa do funil. Criação e vínculo usam controle de duplicidade por negócio e grupo de entrega; não crie projeto paralelo para compensar uma falha sem investigar.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Configurar a entrega de negócios ganhos; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/settings/delivery$hlp$, NULL, $hlp$internal$hlp$, 70, 1, true),
($hlp$projects$hlp$, $hlp$operar-ficha-projeto$hlp$, $hlp$Operar a ficha do projeto$hlp$, $hlp$Operar a ficha do projeto no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Operar a ficha do projeto

**Para que serve:** A ficha reúne as operações do projeto sem misturar aprovação de horas com situação da entrega.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.projects.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Projetos (`/projects/$id`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra um projeto na listagem e confira sua origem e os indicadores.
2. Na aba Tarefas, consulte as colunas e abra uma tarefa; para criar, informe título e prazo quando aplicável.
3. Na aba Marcos, consulte ou cadastre nome e prazo; valores dependem da permissão correspondente.
4. Use Timesheet para consultar ou registrar data, horas e descrição conforme acesso. Em Membros, selecione usuário e papel; tarifas só aparecem quando autorizadas.
5. Abra as telas de acompanhamento de entrega, horas e aprovação ou financeiro quando precisar dessas operações específicas.

## Resultado esperado
A ficha reúne as operações do projeto sem misturar aprovação de horas com situação da entrega.

## Regras e limites
Tarefas, marcos e membros têm controles próprios. Custo/h e Bill/h são dados sensíveis. Indicadores de rentabilidade não substituem medição nem recebimento.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Operar a ficha do projeto; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/$id$hlp$, $hlp$techprojects.projects.view.own$hlp$, $hlp$internal$hlp$, 10, 1, true),
($hlp$projects$hlp$, $hlp$operar-hours-review$hlp$, $hlp$Revisar e decidir horas$hlp$, $hlp$Revisar e decidir horas no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Revisar e decidir horas

**Para que serve:** A decisão é registrada apenas nos itens cuja autorização e revisão continuem válidas no banco.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.time_entries.approve.workspace`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Revisão de Horas (`/projects/hours-review`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Horas > Revisão de Horas e escolha o período.
2. Confira a fila de itens aguardando sua decisão e a visão de acompanhamento.
3. Selecione os itens que deseja decidir e confira o total selecionado.
4. Aprove ou devolva pelo comando disponível; informe a justificativa solicitada e aguarde o resultado.
5. Recarregue a fila para conferir o que deixou de aguardar sua decisão.

## Resultado esperado
A decisão é registrada apenas nos itens cuja autorização e revisão continuem válidas no banco.

## Regras e limites
A fila é limitada ao que o usuário pode decidir. Ser gestor ou enxergar o menu não substitui a nomeação como aprovador. Não presuma autoaprovação; decisões são revalidadas no servidor.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Revisar e decidir horas; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/hours-review$hlp$, $hlp$techprojects.time_entries.approve.workspace$hlp$, $hlp$internal$hlp$, 20, 1, true),
($hlp$projects$hlp$, $hlp$operar-imports-clickup$hlp$, $hlp$Importar organização e tarefas do ClickUp$hlp$, $hlp$Importar organização e tarefas do ClickUp no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Importar organização e tarefas do ClickUp

**Para que serve:** As listas e tarefas lidas são importadas conforme as decisões de organização e responsáveis.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Importar do ClickUp (`/projects/settings/imports/clickup`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Importar do ClickUp e use a leitura da origem disponível.
2. Espere a leitura concluir. Em Organização, revise onde cada lista será criada ou vinculada no TechProjects.
3. Em Responsáveis, confira os vínculos com membros existentes. Quando usar criação de identidade, confira que será um membro inativo e sem acesso.
4. Execute a etapa de importação disponível após revisar organização e responsáveis. Confira o resultado de cada etapa.

## Resultado esperado
As listas e tarefas lidas são importadas conforme as decisões de organização e responsáveis.

## Regras e limites
Leitura e importação são etapas separadas. Identidade inativa preserva atribuição sem liberar login. Não prometa mapeamento por similaridade de nome nem sincronização contínua.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Importar organização e tarefas do ClickUp; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/settings/imports/clickup$hlp$, NULL, $hlp$internal$hlp$, 80, 1, true),
($hlp$projects$hlp$, $hlp$operar-imports-clockify$hlp$, $hlp$Importar do Clockify$hlp$, $hlp$Importar do Clockify no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Importar do Clockify

**Para que serve:** Os dados aprovados na prévia são processados pelo importador e o resultado da execução fica disponível para conferência.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Importar do Clockify (`/projects/settings/imports/clockify`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Importar do Clockify. Salve a conexão e teste a chave no controle próprio, sem compartilhá-la.
2. Selecione o workspace de origem. Inicie a prévia e configure o tratamento de apontamentos sem projeto e a situação das horas no ERP.
3. Após a simulação, confira Resumo, Pessoas, Clientes, Projetos e Staging. Revise os mapeamentos e os vínculos antes de continuar.
4. Marque a confirmação da prévia e confirme Importar agora somente após revisar os totais.
5. Acompanhe a execução e o resultado. Use controles de estado e revisão apenas para a execução indicada.

## Resultado esperado
Os dados aprovados na prévia são processados pelo importador e o resultado da execução fica disponível para conferência.

## Regras e limites
Prévia não equivale a importação. Identidades criadas sem acesso não recebem login. Histórico importado travado não é aprovado nem faturado; reabertura de entradas é ação separada.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Importar do Clockify; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/settings/imports/clockify$hlp$, NULL, $hlp$internal$hlp$, 90, 1, true),
($hlp$projects$hlp$, $hlp$operar-imports-jibble$hlp$, $hlp$Importar do Jibble$hlp$, $hlp$Importar do Jibble no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Importar do Jibble

**Para que serve:** A execução registra o processamento do histórico de ponto e os vínculos revisados.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Importar do Jibble (`/projects/settings/imports/jibble`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Importar do Jibble. Salve as credenciais e teste a conexão.
2. Confirme a organização de origem e inicie a prévia.
3. Confira Resumo, Mapeamentos, Duplicidades e Staging. Resolva as decisões de duplicidade antes de confirmar o que deve entrar.
4. Confirme a importação da prévia revisada e acompanhe o histórico da execução.
5. Se precisar desfazer, confira a execução escolhida e a confirmação Desfazer; depois revise o resultado.

## Resultado esperado
A execução registra o processamento do histórico de ponto e os vínculos revisados.

## Regras e limites
Ponto do Jibble não deve ser somado automaticamente a horas produtivas do Clockify. Não resolva duplicidade apenas pelo nome. Desfazer depende das regras e do estado da execução, não é uma restauração geral do workspace.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Importar do Jibble; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/settings/imports/jibble$hlp$, NULL, $hlp$internal$hlp$, 110, 1, true),
($hlp$projects$hlp$, $hlp$operar-imports-reconciliation$hlp$, $hlp$Conciliar horas e vínculos importados$hlp$, $hlp$Conciliar horas e vínculos importados no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Conciliar horas e vínculos importados

**Para que serve:** Decisões e vínculos ficam rastreáveis sem reescrever os dados brutos importados.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Conciliação de horas (`/projects/settings/imports/reconciliation`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Conciliação de horas e escolha o intervalo.
2. Consulte Visão geral e a conferência por agrupamento para entender a cobertura antes de decidir pendências.
3. Na fila de pendências, selecione os casos, confira evidências e registre a decisão com justificativa. Reavaliar a fila é uma ação explícita.
4. Em Vínculos, confira evidências exatas ou sugestões. Aplique vínculos exatos ou confirme sugestões; para reverter, confira as alterações registradas.
5. Use as seções de negócios, horas Jibble e revisão para investigar o tipo de ocorrência correspondente. Exporte pendências somente quando autorizado.

## Resultado esperado
Decisões e vínculos ficam rastreáveis sem reescrever os dados brutos importados.

## Regras e limites
Somente administrador ativo do workspace ativo; Ver Como não pode gravar. Vínculo canônico nunca é inferido apenas por nome. Reversão só desfaz valor ainda igual ao que foi aplicado; edição posterior é preservada. Parâmetros de aba e datas são validados na rota.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Conciliar horas e vínculos importados; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/settings/imports/reconciliation$hlp$, NULL, $hlp$internal$hlp$, 120, 1, true),
($hlp$projects$hlp$, $hlp$operar-imports$hlp$, $hlp$Escolher uma fonte de importação$hlp$, $hlp$Escolher uma fonte de importação no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Escolher uma fonte de importação

**Para que serve:** O hub encaminha para os fluxos específicos, sem executar importação apenas ao abrir a página.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Configurações / ficha vinculada (`/projects/settings/imports`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra /projects/settings/imports.
2. Identifique se deseja importar do Clockify, Jibble ou ClickUp.
3. Abra o importador correspondente e leia sua prévia antes de executar a importação.
4. Para conferir vínculos e pendências de horas importadas, use Conciliação de horas.

## Resultado esperado
O hub encaminha para os fluxos específicos, sem executar importação apenas ao abrir a página.

## Regras e limites
Cada fonte tem conexão, recursos e regras próprios. Não copie credenciais para artigos, capturas ou chamados.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Escolher uma fonte de importação; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/settings/imports$hlp$, NULL, $hlp$internal$hlp$, 100, 1, true),
($hlp$projects$hlp$, $hlp$operar-my-hours$hlp$, $hlp$Registrar e acompanhar minhas horas$hlp$, $hlp$Registrar e acompanhar minhas horas no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Registrar e acompanhar minhas horas

**Para que serve:** Horas confirmadas pelo servidor aparecem como apontamento; envio e aprovação são etapas posteriores.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.time_entries.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Minhas Horas (`/projects/my-hours`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Horas > Minhas Horas e selecione o dia ou semana que deseja conferir.
2. Abra o apontamento rápido e selecione Projeto e Atividade. Escolha início e término ou somente duração.
3. Informe data, descrição e se o trabalho é faturável; revise e salve. A atividade pode ser criada por texto quando a ação estiver disponível e autorizada.
4. Confira o apontamento na visão de horas; use as ações disponíveis para corrigir, duplicar ou remover somente registros permitidos.
5. Antes de enviar um período, revise os registros e a prévia de envio. Se habilitar a fila local, confira separadamente o que ainda aguarda sincronização.

## Resultado esperado
Horas confirmadas pelo servidor aparecem como apontamento; envio e aprovação são etapas posteriores.

## Regras e limites
Duração manual: mínimo de 1 minuto e máximo de 24 horas. No intervalo, término deve ser maior que início; sobreposição é recusada. Descrição tem até 2.000 caracteres. Edição de enviado/devolvido volta a rascunho. Competência fechada impede gravação.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Registrar e acompanhar minhas horas; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/my-hours$hlp$, $hlp$techprojects.time_entries.view.own$hlp$, $hlp$internal$hlp$, 50, 1, true),
($hlp$projects$hlp$, $hlp$operar-my-work$hlp$, $hlp$Organizar o My Work$hlp$, $hlp$Organizar o My Work no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Organizar o My Work

**Para que serve:** O usuário identifica trabalho pendente e acompanha sua atividade sem consultar toda a carteira.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.my_work.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > My Work (`/projects/my-work`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Projetos > My Work.
2. Revise Hoje, Atrasadas e Próximos 7 dias. Abra uma tarefa para conferir seus dados.
3. Consulte o cronômetro em andamento e os apontamentos disponíveis antes de registrar novo trabalho.

## Resultado esperado
O usuário identifica trabalho pendente e acompanha sua atividade sem consultar toda a carteira.

## Regras e limites
A visão pessoal não concede acesso a projetos de outros usuários. Prazo e responsável afetam a organização das tarefas.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Organizar o My Work; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/my-work$hlp$, $hlp$techprojects.my_work.view.own$hlp$, $hlp$internal$hlp$, 60, 1, true),
($hlp$projects$hlp$, $hlp$operar-operations$hlp$, $hlp$Consultar operação e saúde do TechProjects$hlp$, $hlp$Consultar operação e saúde do TechProjects no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Consultar operação e saúde do TechProjects

**Para que serve:** O administrador obtém uma visão de diagnóstico das operações do workspace.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Operação e saúde (`/projects/settings/operations`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Operação e saúde.
2. Confira os agendamentos esperados, as últimas execuções e as filas apresentadas.
3. Compare a situação da execução com a fila antes de relatar uma falha.
4. Em caso de erro, reúna apenas tipo de operação e mensagem sanitizada; solicite investigação administrativa sem compartilhar segredos.

## Resultado esperado
O administrador obtém uma visão de diagnóstico das operações do workspace.

## Regras e limites
Tela somente leitura para administrador ativo. Não fornece comando nem segredo de agendamento e não permite executar tarefas apenas ao consultar. Agendadores dependem de configuração externa e opt-in quando previsto.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Consultar operação e saúde do TechProjects; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/settings/operations$hlp$, NULL, $hlp$internal$hlp$, 140, 1, true),
($hlp$projects$hlp$, $hlp$operar-projeto-entrega$hlp$, $hlp$Publicar acompanhamento de entrega$hlp$, $hlp$Publicar acompanhamento de entrega no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Publicar acompanhamento de entrega

**Para que serve:** O acompanhamento macro é registrado na linha do tempo do projeto.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.projects.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Projetos (`/projects/$id/entrega`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Na ficha do projeto, abra Acompanhamento de entrega.
2. Confira o farol, previsão, evolução e linha do tempo atuais.
3. Com permissão de criação, abra o novo acompanhamento e informe Título, Resumo macro, Farol, Evolução (%), Previsão e Visibilidade.
4. Publique e confira o checkpoint na linha do tempo. Para corrigir ou remover, use as ações de edição ou exclusão quando liberadas.

## Resultado esperado
O acompanhamento macro é registrado na linha do tempo do projeto.

## Regras e limites
Farol: Verde, Atenção ou Crítico. Visibilidade: Interno ou Visível ao comercial. Acompanhamento não cria tarefa, marco nem apontamento e não comprova aprovação financeira.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Publicar acompanhamento de entrega; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/$id/entrega$hlp$, $hlp$techprojects.projects.view.own$hlp$, $hlp$internal$hlp$, 200, 1, true),
($hlp$projects$hlp$, $hlp$operar-projeto-financeiro$hlp$, $hlp$Consultar medições e rentabilidade do projeto$hlp$, $hlp$Consultar medições e rentabilidade do projeto no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Consultar medições e rentabilidade do projeto

**Para que serve:** O projeto permite acompanhar o que foi medido, aprovado, lançado e recebido, com os dados sensíveis permitidos.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.projects.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Projetos (`/projects/$id/financeiro`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Medições e rentabilidade na ficha do projeto.
2. Confira receitas por situação e cobertura de custos no painel de rentabilidade.
3. Consulte as medições relacionadas ao projeto ou ao serviço e abra os detalhes permitidos.
4. Para preparar medição, siga o fluxo do contrato de origem; não crie uma cobrança paralela para o mesmo serviço.

## Resultado esperado
O projeto permite acompanhar o que foi medido, aprovado, lançado e recebido, com os dados sensíveis permitidos.

## Regras e limites
As medições são preparadas no contrato. Medido, aprovado, lançado e recebido são situações diferentes. Sem tarifa válida, custo/receita é desconhecido, não zero. Painéis têm permissões separadas de profitability e measurements.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Consultar medições e rentabilidade do projeto; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/$id/financeiro$hlp$, $hlp$techprojects.projects.view.own$hlp$, $hlp$internal$hlp$, 210, 1, true),
($hlp$projects$hlp$, $hlp$operar-projeto-horas$hlp$, $hlp$Administrar horas e aprovação do projeto$hlp$, $hlp$Administrar horas e aprovação do projeto no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Administrar horas e aprovação do projeto

**Para que serve:** Aprovadores, aceites, fechamentos e modelo ficam registrados em operações separadas.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.projects.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Projetos (`/projects/$id/horas`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Horas e aprovação na ficha do projeto.
2. Confira os aprovadores nomeados e a delegação; altere somente com autorização.
3. No período exibido, registre aceite do cliente com resultado, identificação e evidência quando necessário.
4. Consulte a prévia do fechamento de competência. Resolva bloqueios antes de confirmar o fechamento.
5. Para reabrir competência, registre a justificativa solicitada. Consulte ou aplique o modelo de entrega pela seção correspondente.

## Resultado esperado
Aprovadores, aceites, fechamentos e modelo ficam registrados em operações separadas.

## Regras e limites
Aceite é registro interno com evidência; não implica portal ou assinatura do cliente. Fechamento e reabertura usam regras próprias. Aplicar modelo não é aprovar apontamentos.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Administrar horas e aprovação do projeto; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/$id/horas$hlp$, $hlp$techprojects.projects.view.own$hlp$, $hlp$internal$hlp$, 220, 1, true),
($hlp$projects$hlp$, $hlp$operar-rates$hlp$, $hlp$Cadastrar e encerrar tarifas com vigência$hlp$, $hlp$Cadastrar e encerrar tarifas com vigência no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Cadastrar e encerrar tarifas com vigência

**Para que serve:** A tarifa passa a ser aplicada conforme data, escopo e vigência, preservando o histórico.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.rates.view.workspace`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Tarifas e custos (`/projects/settings/rates`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Tarifas e custos. Confira as tarifas existentes antes de criar outra.
2. Com gestão de tarifas, informe tipo, escopo, alvo, unidade, moeda, valor e início inclusive; use fim exclusivo quando houver.
3. Se a mudança for retroativa, examine a prévia de impacto e confirme explicitamente. Informe motivo de pelo menos cinco caracteres.
4. Para alterar valor ao longo do tempo, use divisão da vigência; para encerrar, informe o término no comando próprio.
5. Revise as vigências após salvar e confira se não há sobreposição.

## Resultado esperado
A tarifa passa a ser aplicada conforme data, escopo e vigência, preservando o histórico.

## Regras e limites
Leitura: techprojects.rates.view.workspace; gestão: techprojects.rates.manage.workspace. O banco recusa sobreposição e edição direta de valor. Sem tarifa válida, o cálculo fica sem cobertura. Não publique valores reais em capturas.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Cadastrar e encerrar tarifas com vigência; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/settings/rates$hlp$, $hlp$techprojects.rates.view.workspace$hlp$, $hlp$internal$hlp$, 150, 1, true),
($hlp$projects$hlp$, $hlp$operar-spaces$hlp$, $hlp$Organizar espaços, pastas e listas$hlp$, $hlp$Organizar espaços, pastas e listas no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Organizar espaços, pastas e listas

**Para que serve:** A organização criada aparece na árvore e a lista abre seu ambiente de tarefas.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.spaces.view.team`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Espaços (`/projects/spaces`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Projetos > Espaços e consulte a árvore de organização.
2. Com capacidade de criação, crie um espaço e informe seu nome. Adicione pasta quando precisar agrupar listas.
3. Crie a lista no espaço ou pasta desejado, informe o nome e abra a lista. Também é possível iniciar a lista por template quando disponível.
4. Antes de excluir espaço, pasta ou lista, revise o item selecionado e a confirmação exibida.

## Resultado esperado
A organização criada aparece na árvore e a lista abre seu ambiente de tarefas.

## Regras e limites
Espaço, pasta e lista são recursos distintos com permissões próprias. A posição da lista não equivale a permissão de editar todas as tarefas.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Organizar espaços, pastas e listas; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/spaces$hlp$, $hlp$techprojects.spaces.view.team$hlp$, $hlp$internal$hlp$, 170, 1, true),
($hlp$projects$hlp$, $hlp$operar-tasks$hlp$, $hlp$Consultar tarefas de projetos$hlp$, $hlp$Consultar tarefas de projetos no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Consultar tarefas de projetos

**Para que serve:** As tarefas localizadas podem ser consultadas e alteradas conforme suas capacidades efetivas.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.tasks.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Tarefas (`/projects/tasks`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Projetos > Tarefas.
2. Busque por título e filtre o responsável. Revise a grade e abra a tarefa desejada.
3. Na ficha lateral, confira campos principais, tags, checklist, dependências e campos personalizados da lista, quando existentes.
4. Faça a alteração permitida e aguarde a confirmação antes de fechar.

## Resultado esperado
As tarefas localizadas podem ser consultadas e alteradas conforme suas capacidades efetivas.

## Regras e limites
Busca e seleção respeitam o escopo disponível. Ter acesso à listagem não garante acesso a toda tarefa nem às ações em massa.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Consultar tarefas de projetos; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/tasks$hlp$, $hlp$techprojects.tasks.view.own$hlp$, $hlp$internal$hlp$, 180, 1, true),
($hlp$projects$hlp$, $hlp$operar-time$hlp$, $hlp$Configurar política de horas e modelos$hlp$, $hlp$Configurar política de horas e modelos no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Configurar política de horas e modelos

**Para que serve:** A política salva e os modelos ficam disponíveis conforme o escopo autorizado.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.time_policy.view.workspace`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Política de horas e modelos (`/projects/settings/time`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Política de horas e modelos.
2. Confira a política atual, os controles de envio, jornada e aprovação apresentados. Ajuste o limite diário para alerta e a alocação máxima sem justificativa quando necessário.
3. Informe o motivo da mudança e salve a política.
4. Na seção de modelos de entrega, consulte ou salve o modelo e confira sua versão. A aplicação ocorre no projeto e deve ser revisada separadamente.

## Resultado esperado
A política salva e os modelos ficam disponíveis conforme o escopo autorizado.

## Regras e limites
Consultar política e gerenciar política são capacidades diferentes. Não assuma valores padrão universais: a política é do workspace. Limite para alerta não equivale automaticamente a descarte de horas. Modelo salvo tem versão.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Configurar política de horas e modelos; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/settings/time$hlp$, $hlp$techprojects.time_policy.view.workspace$hlp$, $hlp$internal$hlp$, 160, 1, true),
($hlp$projects$hlp$, $hlp$operar-timesheet$hlp$, $hlp$Consultar o timesheet da equipe$hlp$, $hlp$Consultar o timesheet da equipe no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Consultar o timesheet da equipe

**Para que serve:** O timesheet apresenta os apontamentos que seu escopo permite consultar na semana.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.timesheet.view.team`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Timesheet (`/projects/timesheet`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Horas > Timesheet.
2. Navegue para a semana desejada e confira os totais e os registros apresentados.
3. Revise descrição e situação antes de comparar pessoas ou projetos.
4. Quando precisar decidir horas, abra Revisão de Horas: consulta de timesheet não é aprovação.

## Resultado esperado
O timesheet apresenta os apontamentos que seu escopo permite consultar na semana.

## Regras e limites
Meta depende da jornada configurada no People. Ausência de jornada não significa falta nem meta zero. Horas importadas travadas não são aprovadas.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Consultar o timesheet da equipe; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/timesheet$hlp$, $hlp$techprojects.timesheet.view.team$hlp$, $hlp$internal$hlp$, 190, 1, true),
($hlp$projects$hlp$, $hlp$perguntas-frequentes$hlp$, $hlp$Perguntas frequentes do TechProjects$hlp$, $hlp$Perguntas frequentes do TechProjects no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Perguntas frequentes do TechProjects
## Dashboard é a listagem de projetos?
Não. Dashboard está em `/projects/dashboard`; a listagem em `/projects`.
## My Work mostra toda a carteira?
É uma visão pessoal organizada em Hoje, Atrasadas e Próximos 7 dias; não concede acesso a todos os projetos.
## Posso ter listas sem pasta?
A árvore oferece criação de lista no espaço ou dentro de pasta. A organização não substitui permissões.
## Mudar a visualização da lista cria outra tarefa?
Não é uma ação de criação. Quadro, lista, calendário, linha do tempo e carga de trabalho são visualizações da lista.
## Apontamento faturável já foi cobrado?
Não. Faturável é uma marca; medição, aprovação, lançamento e recebimento são etapas separadas.
## Horas importadas travadas contam como aprovadas?
Não. Histórico travado importado não é aprovado nem deve ser faturado como tal.
## Editar hora enviada mantém o envio?
Não. A gravação manual de enviado/devolvido volta a rascunho. Registros aprovados ou com competência fechada não são livremente editáveis.
## Sem jornada a meta é zero?
Não. A meta é desconhecida sem jornada configurada no People.
## Sem tarifa o custo é zero?
Não. É falta de cobertura de custo. Revise vigência e escopo.
## Aceite do cliente é assinatura eletrônica automática?
Não. A tela registra aceite e evidência; não comprova um portal ou envio de assinatura.
## Ativar entrega cria projetos para todo histórico ganho?
Não. A fila considera transições posteriores à ativação, com controles de duplicidade.
## Importar um responsável libera login?
Criação de identidade sem acesso ou membro inativo preserva o nome sem conceder login.
## Posso fechar a aba após guardar uma hora offline?
A pendência permanece local conforme a fila do aparelho, mas não está salva no servidor. Revise e sincronize; sair apaga a fila. Não trate armazenamento local como confirmação do ERP.
## O assistente do Dashboard altera projetos?
Não. As ferramentas catalogadas consultam indicadores autorizados, sem executar SQL arbitrário nem gravar alterações.
## A tela de operação permite disparar um agendamento?
Não. É diagnóstico somente leitura; agendamentos dependem de configuração externa.
## Por que consigo ver o menu e não executar uma ação?
Navegação e autorização são camadas diferentes. Solicite revisão de recurso, ação e escopo; consulte [Permissões](/ajuda/projects/permissoes).$hlp$, $hlp$faq$hlp$, NULL, NULL, $hlp$internal$hlp$, 340, 1, true),
($hlp$projects$hlp$, $hlp$permissoes$hlp$, $hlp$Permissões do TechProjects$hlp$, $hlp$Permissões do TechProjects no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Permissões do TechProjects
## Requisitos comuns
Acesso pretendido: membro ativo, workspace ativo, módulo licenciado e permissão efetiva. Negação prevalece. Escopos own, team e workspace não são intercambiáveis. Menu é navegação; a tela, o registro, as funções e o banco podem negar uma ação mesmo quando o item aparece.
## Menu e suas chaves declaradas
A tabela reproduz o contrato estático do menu, não certifica autorização de URL nem concede acesso.

| Item | Rota | need declarado | permissionAny (alternativas) |
|---|---|---|---|
| Dashboard | `/projects/dashboard` | sem need | `techprojects.projects.view.own`, `techprojects.projects.view.team`, `techprojects.projects.view.workspace`, `techprojects.tasks.view.own`, `techprojects.tasks.view.team`, `techprojects.tasks.view.workspace` |
| My Work | `/projects/my-work` | sem need | `techprojects.my_work.view.own`, `techprojects.my_work.view.team`, `techprojects.my_work.view.workspace` |
| Espaços | `/projects/spaces` | manager | `techprojects.spaces.view.team`, `techprojects.spaces.view.workspace` |
| Projetos | `/projects` | manager | `techprojects.projects.view.own`, `techprojects.projects.view.team`, `techprojects.projects.view.workspace` |
| Tarefas | `/projects/tasks` | sem need | `techprojects.tasks.view.own`, `techprojects.tasks.view.team`, `techprojects.tasks.view.workspace` |
| Minhas Horas | `/projects/my-hours` | sem need | `techprojects.time_entries.view.own`, `techprojects.time_entries.view.workspace` |
| Revisão de Horas | `/projects/hours-review` | manager | `techprojects.time_entries.approve.workspace`, `techprojects.timesheet.approve.workspace`, `techprojects.time_entries.view.own` |
| Timesheet | `/projects/timesheet` | manager | `techprojects.timesheet.view.team`, `techprojects.timesheet.view.workspace` |
| Importar do Clockify | `/projects/settings/imports/clockify` | admin | sem chave; min_permission vazio |
| Importar do Jibble | `/projects/settings/imports/jibble` | admin | sem chave; min_permission vazio |
| Importar do ClickUp | `/projects/settings/imports/clickup` | admin | sem chave; min_permission vazio |
| Conciliação de horas | `/projects/settings/imports/reconciliation` | admin | sem chave; min_permission vazio |
| Entrega de negócios | `/projects/settings/delivery` | admin | sem chave; min_permission vazio |
| Política de horas e modelos | `/projects/settings/time` | admin | `techprojects.time_policy.view.workspace`, `techprojects.delivery_templates.view.workspace` |
| Tarifas e custos | `/projects/settings/rates` | admin | `techprojects.rates.view.workspace` |
| Operação e saúde | `/projects/settings/operations` | admin | sem chave; min_permission vazio |

## Ações e dados sensíveis
- Projetos, tarefas, espaços, pastas, listas, marcos e membros têm capacidades por recurso e registro. Criar, atualizar e excluir não decorrem de view.
- Status, campos personalizados e templates de lista exigem gestão dos recursos correspondentes.
- Horas: consultar, apontar, enviar, aprovar, registrar aceite e fechar/reabrir competência são operações distintas. A fila exige elegibilidade de decisão; não presuma autoaprovação.
- Acompanhamento macro usa project_updates para criar, atualizar e excluir.
- Tarifas: leitura por `techprojects.rates.view.workspace`, gestão por `techprojects.rates.manage.workspace`.
- Rentabilidade e medições têm recursos próprios; custos e receitas são projetados conforme acesso, não liberados por visualizar projeto.
- Conciliação e operação exigem administrador ativo do workspace ativo. Conciliação não permite gravação em Ver Como.
- Importação exige autorização do recurso da fonte e suas verificações administrativas; configurar conexão não concede acesso a outros workspaces.
## Quando o menu aparece mas a operação é negada
Solicite ao administrador revisão do recurso, ação e escopo; informe apenas a rota e a mensagem sanitizada. Não compartilhe credenciais nem exporte dados para contornar bloqueios. A divergência entre fallback de menu e política de negação está registrada no relatório de auditoria, fora dos artigos operacionais.
## Leitura da Ajuda
Artigos são internos e filtrados no servidor por módulo e min_permission. Uma única chave de referência não representa toda a lista permissionAny; a compatibilidade dos leitores com escopos alternativos precisa ser tratada antes de publicar.$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 320, 1, true),
($hlp$projects$hlp$, $hlp$primeiros-15-minutos$hlp$, $hlp$Primeiros 15 minutos no TechProjects$hlp$, $hlp$Primeiros 15 minutos no TechProjects no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Primeiros 15 minutos no TechProjects

**Para que serve:** O usuário localiza sua carteira, seu trabalho e suas horas, distinguindo consulta, gravação e aprovação.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects (`/projects/dashboard`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Confira o workspace e abra Dashboard. Escolha um período e observe cobertura e filtros.
2. Abra Projetos e consulte um projeto acessível; confira tarefas e origem. Não crie registros só para testar em ambiente real.
3. Abra My Work para revisar Hoje, Atrasadas e Próximos 7 dias.
4. Em Minhas Horas, examine a semana e as situações. Se for registrar trabalho real, use projeto e atividade corretos e confira a confirmação.
5. Identifique com o administrador quem aprova suas horas; consulte a prévia de envio antes de enviar. Leia as permissões e erros comuns.

## Resultado esperado
O usuário localiza sua carteira, seu trabalho e suas horas, distinguindo consulta, gravação e aprovação.

## Regras e limites
O roteiro é orientativo, não promete duração exata nem acesso a todas as telas. Não altere tarifas, política ou integrações durante a exploração inicial. Sem acesso, solicite o escopo necessário.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Primeiros 15 minutos no TechProjects; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, NULL, NULL, $hlp$internal$hlp$, 300, 1, true),
($hlp$projects$hlp$, $hlp$reutilizar-template-lista$hlp$, $hlp$Salvar e reutilizar template de lista$hlp$, $hlp$Salvar e reutilizar template de lista no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Salvar e reutilizar template de lista

**Para que serve:** Uma nova lista é criada a partir do template escolhido.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Espaços > Lista > Tarefa (`/projects/lists/$id`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Na lista, abra Salvar como template e informe um nome.
2. Na árvore de espaços, abra a criação de lista a partir de template e selecione o modelo disponível.
3. Confirme a criação e revise a lista resultante.
4. Remova um template apenas quando tiver capacidade de gestão e tiver conferido a seleção.

## Resultado esperado
Uma nova lista é criada a partir do template escolhido.

## Regras e limites
Gestão usa techprojects.list_templates. Não prometa cópia de histórico de horas, permissões ou vínculos comerciais sem validação específica.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Salvar e reutilizar template de lista; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, NULL, NULL, $hlp$internal$hlp$, 280, 1, true),
($hlp$projects$hlp$, $hlp$sincronizar-fila-local$hlp$, $hlp$Guardar e sincronizar novos apontamentos sem conexão$hlp$, $hlp$Guardar e sincronizar novos apontamentos sem conexão no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Guardar e sincronizar novos apontamentos sem conexão

**Para que serve:** Somente a confirmação do servidor transforma um pendente local em apontamento salvo no ERP.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Minhas Horas (`/projects/my-hours`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. No apontamento rápido, habilite Guardar neste aparelho se a conexão cair.
2. Para novo apontamento, selecione uma atividade existente e revise os dados.
3. Se a conexão cair, confira o aviso de armazenamento local; abra a fila na tela Minhas Horas.
4. Ao recuperar a conexão, envie os pendentes pelo painel e confira os resultados.

## Resultado esperado
Somente a confirmação do servidor transforma um pendente local em apontamento salvo no ERP.

## Regras e limites
Opt-in por usuário e workspace. Apenas apontamento novo com atividade existente; sem tokens ou custos na fila. Sair apaga a fila. Sincronização revalida permissão, competência e idempotência.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Guardar e sincronizar novos apontamentos sem conexão; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, NULL, NULL, $hlp$internal$hlp$, 250, 1, true),
($hlp$projects$hlp$, $hlp$trabalhar-lista$hlp$, $hlp$Trabalhar em uma lista$hlp$, $hlp$Trabalhar em uma lista no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Trabalhar em uma lista

**Para que serve:** As visualizações representam as tarefas da mesma lista; alterações confirmadas aparecem nas consultas seguintes.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.spaces.view.team`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Espaços (`/projects/lists/$id`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra uma lista pela árvore de Espaços.
2. Alterne entre quadro, lista, calendário, linha do tempo e carga de trabalho conforme a informação que precisa consultar.
3. Crie uma tarefa quando autorizado; abra sua ficha para atualizar campos, tags, checklist e dependências.
4. No quadro, mova o status somente quando tiver capacidade de alteração. Confira o resultado após salvar.
5. Use os controles de status, campos personalizados e templates somente com a permissão de gestão correspondente.

## Resultado esperado
As visualizações representam as tarefas da mesma lista; alterações confirmadas aparecem nas consultas seguintes.

## Regras e limites
Gerenciar status, campos personalizados e templates não é a mesma permissão de criar tarefas. Excluir tarefa exige capacidade no registro; não presuma exclusão em cascata.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Trabalhar em uma lista; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->$hlp$, $hlp$howto$hlp$, $hlp$/projects/lists/$id$hlp$, $hlp$techprojects.spaces.view.team$hlp$, $hlp$internal$hlp$, 40, 1, true),
($hlp$projects$hlp$, $hlp$visao-geral$hlp$, $hlp$Visão geral do TechProjects$hlp$, $hlp$Visão geral do TechProjects no TechProjects: operação, acesso e limites comprovados no código.$hlp$, $hlp$# Visão geral do TechProjects
## O que o módulo reúne
O TechProjects reúne projetos, tarefas organizadas em espaços/pastas/listas, trabalho pessoal, horas, revisão, entrega e acompanhamento financeiro. O Dashboard fica em Visão geral; a listagem de projetos tem rota própria.
## Navegação
- Visão geral > Dashboard.
- Projetos > My Work, Espaços, Projetos e Tarefas.
- Horas > Minhas Horas, Revisão de Horas e Timesheet.
- Configurações > importadores Clockify, Jibble e ClickUp, Conciliação de horas, Entrega de negócios, Política de horas e modelos, Tarifas e custos, Operação e saúde.
- Na ficha do projeto: tarefas, marcos, timesheet, membros; telas específicas de entrega, horas/aprovação e financeiro.
## Operações que não se confundem
Criar projeto não aprova horas. Enviar horas não aprova o período. Aprovação não é aceite do cliente nem fechamento. Histórico importado travado não é aprovação. Medição, lançamento financeiro e recebimento são estados distintos. Prévia de importação não grava o resultado definitivo.
## Comece por aqui
- [Primeiros 15 minutos](/ajuda/projects/primeiros-15-minutos)
- [Projetos](/ajuda/projects/consultar-projetos)
- [Permissões](/ajuda/projects/permissoes)$hlp$, $hlp$overview$hlp$, NULL, NULL, $hlp$internal$hlp$, 290, 1, true)
ON CONFLICT (module_key, slug) DO NOTHING;
INSERT INTO public.help_articles
  (module_key, slug, title, summary, body_md, article_type, route_pattern, min_permission, audience, sort_order, version, is_published)
VALUES
($hlp$finance$hlp$, $hlp$cadastrar-conta-bancaria$hlp$, $hlp$Cadastrar e consultar contas bancárias$hlp$, $hlp$Cadastrar e consultar contas bancárias no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Cadastrar e consultar contas bancárias

**Para que serve:** Cadastrar e consultar contas bancárias, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.bank_accounts`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Cadastrar e consultar contas bancárias (`/finance/bank-accounts`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Consulte as contas existentes.
2. Use a criação e informe nome, empresa opcional, tipo e saldo inicial.
3. Salve e confira a linha criada.
4. Exporte pela barra da listagem quando autorizado.

## Resultado esperado
Conta interna disponível como referência nas operações financeiras.

## Regras e limites
- Tipos: Conta corrente, Poupança, Caixa e Outro.
- Cadastro de conta interna não cria conexão com Banco Inter.
- Criação exige `techfinance.bank_accounts.create.workspace`; exportação exige `.export.workspace`.
- Não foi confirmado editor completo de dados bancários nesta tela.

### Campos e controles
Nome; empresa; tipo; saldo inicial.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Cadastrar e consultar contas bancárias; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.bank-accounts.tsx -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/bank-accounts$hlp$, $hlp$techfinance.bank_accounts.view.workspace$hlp$, $hlp$internal$hlp$, 180, 1, true),
($hlp$finance$hlp$, $hlp$campos-e-status$hlp$, $hlp$Referência de campos e status$hlp$, $hlp$Referência de campos e status no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Referência de campos e status

## Lançamentos
| Campo | Significado |
|---|---|
| Tipo | A receber ou A pagar |
| Descrição | Identificação do título; obrigatória |
| Valor | Total positivo; cadastro rápido em BRL |
| Em aberto | Valor menos baixas registradas |
| Competência | Data usada no regime de competência |
| Vencimento | Data prevista para o título |
| Categoria | Receita ou despesa conforme direção |
| Contraparte | Empresa relacionada exibida na listagem |
| Empresa contraparte intercompany | Pessoa jurídica interna contraparte; usada na consolidação quando aplicável |
| Responsável | Atribuição exibida/filtrável; não concede acesso |
| Notas | Observações do título |

## Status de título
`open`: Em aberto; `partial`: Parcial; `paid`: Pago; `overdue`: Vencido; `cancelled`: Cancelado. O status financeiro deriva de pagamentos e regras do banco: não arraste o Kanban para forçar quitação.

## Baixas
Valor, data, método e conta opcional. Métodos expostos: Pix, Boleto, Cartão, Transferência, Dinheiro e Outro. Método é classificação e não prova de execução externa.

## Faturas
Status expostos: draft, open, paid, overdue, cancelled e refunded. Número, descrição, gateway, empresa, vencimento e valor são usados na consulta/filtros. Não aplicar automaticamente o vocabulário de fatura ao título.

## Cadastros
Empresa: código, razão social, nome fantasia, CNPJ, IE, IM, ativa e indicação de padrão. Grupo: código, nome, descrição, ativo e membros. Conta: nome, empresa, tipo e saldo inicial. Categoria: nome, código, tipo e pai. Centros de custo: consulta hierárquica e vínculos apresentados.

## Relatórios
DRE: competência/caixa, 3/6/12 meses, empresa/grupo, receitas, despesas e resultado. Fluxo: vencido, 0–30/31–60/61–90 dias, fatores de recebimento/despesa. Consolidado pode eliminar intercompany. Valores refletem o escopo acessível.

## Referências
[Permissões](/ajuda/finance/permissoes) · [Integrações](/ajuda/finance/integracoes)$hlp$, $hlp$reference$hlp$, $hlp$/finance/entries/$id$hlp$, $hlp$techfinance.entries.view.own$hlp$, $hlp$internal$hlp$, 320, 1, true),
($hlp$finance$hlp$, $hlp$conciliar-transacoes$hlp$, $hlp$Conciliar transações bancárias$hlp$, $hlp$Conciliar transações bancárias no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Conciliar transações bancárias

**Para que serve:** Conciliar transações bancárias, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.banking`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Conciliar transações bancárias (`/finance/banking/reconciliation`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Confira pendências e ajuste a janela de busca de candidatos entre 0 e 30 dias.
2. Revise os candidatos e aceite o match correto, ou ignore a transação justificadamente.
3. Em lote, selecione transações e use vincular, criar ou ignorar conforme sua autorização.
4. Confira vinculadas, sem candidato, criadas e ignoradas retornadas.
5. No histórico, filtre Conciliados ou Ignorados e reative quando necessário.

## Resultado esperado
Transações conciliadas ou classificadas conforme a decisão autorizada.

## Regras e limites
- Leitura usa banking.view.workspace; conciliar exige `techfinance.banking.update.workspace`.
- Criação de lançamentos exige também permissão de criação de entries.
- Candidato é sugestão; revise valor e contexto antes de aceitar.
- Reativar não é estorno de transferência externa.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Conciliar transações bancárias; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.banking.reconciliation.tsx -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/banking/reconciliation$hlp$, $hlp$techfinance.banking.view.workspace$hlp$, $hlp$internal$hlp$, 220, 1, true),
($hlp$finance$hlp$, $hlp$configurar-emissao-de-nfs-e$hlp$, $hlp$Configurar emissão de NFS-e$hlp$, $hlp$Configurar emissão de NFS-e.$hlp$, $hlp$# Configurar emissão de NFS-e

**Para que serve:** Configurar emissão de NFS-e, no contexto da tela `/settings/nfse`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/nfse`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/nfse.
2. Revise NFE.io, Company ID, inscrição municipal e código de serviço municipal.
3. Confira Emissão automática após pagamento e salve apenas se autorizado.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Consulta exige techfinance.nfse_settings.view.workspace; mudança exige manage.workspace. Campo de emissão automática não garante que o provedor tenha emitido a nota.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `finance`; consulte os artigos desse módulo em `/ajuda/finance`.

<!-- screenshot: capturar /settings/nfse com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/nfse$hlp$, NULL, $hlp$internal$hlp$, 147, 1, true),
($hlp$finance$hlp$, $hlp$configurar-o-gateway-de-pagamentos$hlp$, $hlp$Configurar o gateway de pagamentos$hlp$, $hlp$Configurar o gateway de pagamentos.$hlp$, $hlp$# Configurar o gateway de pagamentos

**Para que serve:** Configurar o gateway de pagamentos, no contexto da tela `/settings/payments`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/payments`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/payments.
2. Revise Provedor, Ambiente e Método padrão.
3. Confira a seção Webhook e salve se autorizado.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Consulta exige techfinance.payments_settings.view.workspace e alteração manage.workspace. Separe ambiente de testes de produção; não copie segredos de gateway.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `finance`; consulte os artigos desse módulo em `/ajuda/finance`.

<!-- screenshot: capturar /settings/payments com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/payments$hlp$, NULL, $hlp$internal$hlp$, 151, 1, true),
($hlp$finance$hlp$, $hlp$configurar-regua-cobranca$hlp$, $hlp$Configurar régua de cobrança$hlp$, $hlp$Configurar régua de cobrança no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Configurar régua de cobrança

**Para que serve:** Configurar régua de cobrança, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.dunning`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Configurar régua de cobrança (`/settings/dunning`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Crie uma régua ou selecione uma existente.
2. Defina nome, ativa e padrão do workspace quando necessário.
3. Adicione passos com deslocamento de dias e canal: E-mail, WhatsApp, Tarefa ou Escalada.
4. Escolha template compatível ou mensagem inline; revise assunto e mensagem.
5. Salve e confira os passos; exclua somente com capacidade válida.

## Resultado esperado
Configuração da régua salva; isso não comprova envio de mensagem.

## Regras e limites
- Passos e canais disponíveis no editor não comprovam entrega operacional de cada adaptador.
- Consulte permissões separadas para ler templates.
- Não confunda mensagem WhatsApp de cobrança com template aprovado pela Meta.

### Campos e controles
Nome; ativa; padrão; passos; dias; canal; template; assunto; mensagem com variáveis exibidas, como {invoice_number}, {amount}, {days_overdue}.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Configurar régua de cobrança; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/settings.dunning.tsx; src/lib/dunning.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/dunning$hlp$, $hlp$techfinance.dunning.view.workspace$hlp$, $hlp$internal$hlp$, 290, 1, true),
($hlp$finance$hlp$, $hlp$consultar-assinaturas-recorrentes$hlp$, $hlp$Consultar assinaturas recorrentes$hlp$, $hlp$Consultar assinaturas recorrentes.$hlp$, $hlp$# Consultar assinaturas recorrentes

**Para que serve:** Consultar assinaturas recorrentes, no contexto da tela `/settings/recurring`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techfinance.recurrences`, `techfinance.invoices`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/recurring`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/recurring.
2. Consulte as assinaturas e o formulário disponível.
3. Revise datas e conteúdo antes de gravar uma alteração.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O mapa de rota usa techfinance.recurrences ou techfinance.invoices. Não confunda recorrência financeira com tipos de assinatura de comunicações.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `finance`; consulte os artigos desse módulo em `/ajuda/finance`.

<!-- screenshot: capturar /settings/recurring com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/recurring$hlp$, NULL, $hlp$internal$hlp$, 162, 1, true),
($hlp$finance$hlp$, $hlp$consultar-auditoria$hlp$, $hlp$Consultar auditoria financeira$hlp$, $hlp$Consultar auditoria financeira no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Consultar auditoria financeira

**Para que serve:** Consultar auditoria financeira, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.audit`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar auditoria financeira (`/finance/audit`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Auditoria.
2. Confira os indicadores de consistência e os avisos apresentados.
3. Investigue os registros de origem nas telas correspondentes.

## Resultado esperado
Diagnóstico financeiro consultado sem reparo automático.

## Regras e limites
- É tela de consulta, não ferramenta para corrigir saldo diretamente.
- Visibilidade do menu por admin não dispensa os controles de acesso financeiros.
- Não exporte evidências com dados privados para a Ajuda.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar auditoria financeira; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.audit.tsx; src/lib/finance-audit.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/audit$hlp$, $hlp$techfinance.audit.view.workspace$hlp$, $hlp$internal$hlp$, 250, 1, true),
($hlp$finance$hlp$, $hlp$consultar-centros-custo$hlp$, $hlp$Consultar centros de custo$hlp$, $hlp$Consultar centros de custo no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Consultar centros de custo

**Para que serve:** Consultar centros de custo, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.cost_centers`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar centros de custo (`/finance/cost-centers`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Centros de custo.
2. Consulte a hierarquia e os CNPJs associados apresentados.
3. Compare a estrutura para entender a distribuição por empresa.

## Resultado esperado
Estrutura consultada, sem cadastro ou edição nesta tela.

## Regras e limites
- Não há botões de criar, editar ou excluir confirmados nesta rota.
- Permissões de escrita existentes no catálogo não provam que haja ação de escrita na interface.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar centros de custo; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.cost-centers.tsx -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/cost-centers$hlp$, $hlp$techfinance.cost_centers.view.workspace$hlp$, $hlp$internal$hlp$, 150, 1, true),
($hlp$finance$hlp$, $hlp$consultar-contas-a-pagar$hlp$, $hlp$Consultar contas a pagar$hlp$, $hlp$Consultar contas a pagar no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Consultar contas a pagar

**Para que serve:** Consultar contas a pagar, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar contas a pagar (`/finance/payable`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Busque pela descrição e selecione status, empresa ou grupo e responsável.
2. Alterne lista e Kanban e ajuste as colunas quando necessário.
3. Abra a descrição para consultar a ficha ou use o botão de baixa se autorizado.
4. Selecione registros para editar vencimento/competência ou excluir em lote, somente quando todos os registros permitirem a ação.
5. Use Exportar se autorizado; o servidor confere novamente o acesso.

## Resultado esperado
Títulos da direção selecionada, com saldo em aberto e ações condicionadas por registro.

## Regras e limites
- Kanban é somente leitura para mudança de status: status deriva das baixas.
- Exportação exige `techfinance.entries.export.workspace`.
- Seleção global corresponde aos registros filtrados carregados, não é garantia de consulta ilimitada.
- Edição em lote não dá autorização adicional.

### Campos e controles
Descrição, contraparte, categoria, status, valor, em aberto, vencimento e responsável. Status: Em aberto, Parcial, Pago, Vencido e Cancelado.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar contas a pagar; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/components/finance/entries-list-page.tsx; src/lib/finance.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/payable$hlp$, $hlp$techfinance.entries.view.own$hlp$, $hlp$internal$hlp$, 50, 1, true),
($hlp$finance$hlp$, $hlp$consultar-contas-a-receber$hlp$, $hlp$Consultar contas a receber$hlp$, $hlp$Consultar contas a receber no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Consultar contas a receber

**Para que serve:** Consultar contas a receber, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar contas a receber (`/finance/receivable`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Busque pela descrição e selecione status, empresa ou grupo e responsável.
2. Alterne lista e Kanban e ajuste as colunas quando necessário.
3. Abra a descrição para consultar a ficha ou use o botão de baixa se autorizado.
4. Selecione registros para editar vencimento/competência ou excluir em lote, somente quando todos os registros permitirem a ação.
5. Use Exportar se autorizado; o servidor confere novamente o acesso.

## Resultado esperado
Títulos da direção selecionada, com saldo em aberto e ações condicionadas por registro.

## Regras e limites
- Kanban é somente leitura para mudança de status: status deriva das baixas.
- Exportação exige `techfinance.entries.export.workspace`.
- Seleção global corresponde aos registros filtrados carregados, não é garantia de consulta ilimitada.
- Edição em lote não dá autorização adicional.

### Campos e controles
Descrição, contraparte, categoria, status, valor, em aberto, vencimento e responsável. Status: Em aberto, Parcial, Pago, Vencido e Cancelado.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar contas a receber; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/components/finance/entries-list-page.tsx; src/lib/finance.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/receivable$hlp$, $hlp$techfinance.entries.view.own$hlp$, $hlp$internal$hlp$, 40, 1, true),
($hlp$finance$hlp$, $hlp$consultar-dashboard$hlp$, $hlp$Consultar o Dashboard$hlp$, $hlp$Consultar o Dashboard no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Consultar o Dashboard

**Para que serve:** Consultar o Dashboard, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar o Dashboard (`/finance`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Visão geral > Dashboard.
2. Confira os indicadores e os alertas operacionais disponíveis.
3. Use os atalhos A receber e A pagar para investigar os títulos.
4. Se autorizado, use Novo lançamento para abrir o cadastro rápido.

## Resultado esperado
Visão resumida da carteira financeira acessível ao usuário.

## Regras e limites
- Indicadores são limitados ao escopo consultável, não necessariamente ao workspace inteiro.
- Criar exige `techfinance.entries.create.own` ou `.create.workspace`.
- Alertas não comprovam execução de cobrança ou pagamento.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar o Dashboard; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.index.tsx; src/components/finance/finance-alerts-panel.tsx -->$hlp$, $hlp$howto$hlp$, $hlp$/finance$hlp$, $hlp$techfinance.entries.view.own$hlp$, $hlp$internal$hlp$, 30, 1, true),
($hlp$finance$hlp$, $hlp$consultar-dre$hlp$, $hlp$Consultar e exportar a DRE gerencial$hlp$, $hlp$Consultar e exportar a DRE gerencial no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Consultar e exportar a DRE gerencial

**Para que serve:** Consultar e exportar a DRE gerencial, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.reports`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar e exportar a DRE gerencial (`/finance/dre`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Escolha Competência ou Caixa.
2. Selecione empresa/grupo e últimos 3, 6 ou 12 meses.
3. Confira receitas, despesas, categorias e resultado mensal.
4. Quando disponível para seu acesso, exporte CSV.

## Resultado esperado
Demonstrativo gerencial no regime, período e escopo selecionados.

## Regras e limites
- Competência soma o valor integral dos títulos não cancelados pela data de competência; Caixa soma as baixas pela data de pagamento, desconsiderando títulos cancelados. Baixas parciais entram pelo valor pago. Ao selecionar dois ou mais CNPJs, elimina registros cuja contraparte pertence ao conjunto selecionado; no regime Caixa o contador de eliminações conta baixas, não necessariamente títulos distintos.
- Exportação exige `techfinance.reports.export.workspace` e autorização do servidor.
- Não há importação de DRE confirmada nesta tela.
- Consolidação por grupo pode eliminar intercompany; confira a indicação da tela.
- Não substitui demonstração contábil formal.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar e exportar a DRE gerencial; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.dre.tsx; src/lib/finance.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/dre$hlp$, $hlp$techfinance.reports.view.workspace$hlp$, $hlp$internal$hlp$, 120, 1, true),
($hlp$finance$hlp$, $hlp$consultar-faturamento-servicos$hlp$, $hlp$Consultar faturamento de serviços$hlp$, $hlp$Consultar faturamento de serviços no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Consultar faturamento de serviços

**Para que serve:** Consultar faturamento de serviços, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro autorizado a consultar `techservice.services` (view.own, view.team ou view.workspace), sujeito ao módulo e às políticas próprias de serviços. A permissão `techfinance.entries.view` controla o atalho financeiro, mas não autoriza esta consulta. Ações exigem capacidade específica; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar faturamento de serviços (`/services`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Faturamento de Serviços no menu financeiro.
2. Consulte a listagem e abra um serviço.
3. Confira situação, quantidade, preço unitário e datas antes de operar o faturamento.

## Resultado esperado
Acesso à listagem compartilhada de serviços e sua ficha.

## Regras e limites
- A rota pertence a uma funcionalidade compartilhada e possui controles de acesso próprios.
- Menu usa acesso de leitura de entries; isso não garante autorização para faturar.
- Não confundir /services com catálogo em /catalog/services.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar faturamento de serviços; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/services.index.tsx; src/lib/menu-config-finance.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/services$hlp$, $hlp$techfinance.entries.view.own$hlp$, $hlp$internal$hlp$, 270, 1, true),
($hlp$finance$hlp$, $hlp$consultar-lancamento$hlp$, $hlp$Consultar lançamento e suas parcelas$hlp$, $hlp$Consultar lançamento e suas parcelas no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Consultar lançamento e suas parcelas

**Para que serve:** Consultar lançamento e suas parcelas, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar lançamento e suas parcelas (`/finance/entries/$id`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra a descrição do título em A receber ou A pagar.
2. Confira Valor total, Em aberto, Status e a seção Dados.
3. Consulte parcelas e histórico de pagamentos.
4. Use Cancelar somente se a capacidade do registro permitir.
5. Para remover parcelas em aberto, confira a confirmação e os totais excluídos e mantidos retornados.

## Resultado esperado
Ficha consultada com vínculos, pagamentos e situação atual.

## Regras e limites
- A ficha não é um editor genérico de todos os campos.
- Cancelamento, exclusão, baixa e estorno são operações diferentes e possuem autorização própria.
- Registros indisponíveis não devem ser tratados como inexistentes em todo o sistema.

### Campos e controles
Contraparte; categoria; competência; vencimento; valores; status; notas quando presentes; informações de parcelamento e pagamentos.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar lançamento e suas parcelas; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.entries.$id.tsx -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/entries/$id$hlp$, $hlp$techfinance.entries.view.own$hlp$, $hlp$internal$hlp$, 80, 1, true),
($hlp$finance$hlp$, $hlp$consultar-notas-fiscais$hlp$, $hlp$Consultar NFS-e e arquivos disponíveis$hlp$, $hlp$Consultar NFS-e e arquivos disponíveis no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Consultar NFS-e e arquivos disponíveis

**Para que serve:** Consultar NFS-e e arquivos disponíveis, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.nfse`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar NFS-e e arquivos disponíveis (`/finance/nfse`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Filtre por status e empresa/grupo.
2. Alterne lista e Kanban para consultar a situação dos registros.
3. Confira número RPS/nota, valor, erro e emissão quando presentes.
4. Abra PDF ou XML somente se o registro fornecer o link.
5. Use exportação quando autorizado.

## Resultado esperado
Registros fiscais existentes consultados; nenhum documento é emitido por esta consulta.

## Regras e limites
- Kanban não permite atualizar/excluir registros.
- A consulta do servidor limita a 200 registros recentes.
- Exportação exige `techfinance.nfse.export.workspace`.
- O adaptador atual de emissão retorna erro explícito; comentário sobre sandbox no arquivo não significa emissão habilitada.

### Campos e controles
Status; RPS; número da nota; valor; código de serviço; erro; emissão; links PDF/XML quando presentes.

## Erros comuns
“Emissão fiscal indisponível: o adaptador NFS-e não está habilitado. Nenhuma nota foi emitida.”: não há nota emitida; solicite orientação administrativa.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar NFS-e e arquivos disponíveis; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.nfse.tsx; src/lib/nfse.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/nfse$hlp$, $hlp$techfinance.nfse.view.workspace$hlp$, $hlp$internal$hlp$, 240, 1, true),
($hlp$finance$hlp$, $hlp$consultar-vendas-importadas$hlp$, $hlp$Consultar vendas importadas$hlp$, $hlp$Consultar vendas importadas no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Consultar vendas importadas

**Para que serve:** Consultar vendas importadas, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.sales`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar vendas importadas (`/finance/sales`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Busque vendas usando os filtros de texto, status e período disponíveis.
2. Confira as linhas e os indicadores apresentados.
3. Use a navegação/paginação quando disponível e mantenha os filtros ao comparar valores.

## Resultado esperado
Consulta de vendas importadas do Conta Azul.

## Regras e limites
- Tela somente leitura: não há criação/edição de venda confirmada.
- Chave do menu: `techfinance.sales.view.workspace`.
- Existência de venda importada não comprova baixa do título.
- Conexão e importação são operações da integração Conta Azul, não desta listagem.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar vendas importadas; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.sales.tsx; src/lib/finance-sales.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/sales$hlp$, $hlp$techfinance.sales.view.workspace$hlp$, $hlp$internal$hlp$, 230, 1, true),
($hlp$finance$hlp$, $hlp$criar-lancamento$hlp$, $hlp$Criar lançamento financeiro$hlp$, $hlp$Criar lançamento financeiro no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Criar lançamento financeiro

**Para que serve:** Criar lançamento financeiro, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Criar lançamento financeiro (`/finance/receivable`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Clique em Novo lançamento no Dashboard, A receber ou A pagar.
2. Escolha o tipo; informe descrição, valor total, competência e vencimento.
3. Selecione categoria compatível com receita/despesa, empresa contraparte e notas, se necessário.
4. Mantenha Parcelar desligado para um único título e salve.
5. Abra o título na listagem e confira saldo e datas.

## Resultado esperado
Um lançamento manual em BRL, sem baixa automática.

## Regras e limites
- Exige criação de entries no escopo autorizado.
- Descrição não vazia e valor positivo são obrigatórios.
- O cadastro rápido não emite nota, boleto ou transferência.
- Categoria é filtrada por receita ou despesa conforme o tipo.

### Campos e controles
Tipo; descrição; valor total (R$); categoria; competência; vencimento; empresa contraparte (intercompany); notas.

## Erros comuns
“Preencha descrição e valor.”: informe descrição e valor maior que zero. Falhas de referência ou permissão devem ser corrigidas antes de reenviar.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Criar lançamento financeiro; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/components/finance/quick-create-entry-dialog.tsx -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/receivable$hlp$, $hlp$techfinance.entries.view.own$hlp$, $hlp$internal$hlp$, 60, 1, true),
($hlp$finance$hlp$, $hlp$erros-comuns$hlp$, $hlp$Erros comuns do TechFinance$hlp$, $hlp$Erros comuns do TechFinance no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Erros comuns do TechFinance

## Não vejo o menu ou a tela
Confira workspace, membership ativo, licença e permissões. Menu oculto e URL negada devem ser respeitados. Falha de consulta não prova ausência de registros.

## Lançamento indisponível ou sem permissão para esta ação.
Mensagem de finance_entry_access: peça revisão do acesso ao registro e da ação. Não tente outro identificador de registro.

## Sem permissão para esta operação de baixa.
A autorização de pagamento/estorno é específica. Acesso à ficha não basta.

## Preencha descrição e valor.
Informe descrição não vazia e valor positivo; use o formato decimal aceito pelo campo.

## Informe um valor válido. / Valor maior que o saldo em aberto.
Revise valor e saldo atualizado. Pode haver outra baixa registrada desde que a tela foi aberta. Reconsulte antes de repetir.

## Parcelas ou intervalo rejeitados
São 2–120 parcelas. Intervalo personalizado validado no servidor: 1–365 dias. Confira soma e centavos; não confirme uma prévia incorreta.

## Recorrência não gerou título
Confira ativa, próxima execução, início/fim, limite e capacidade de geração. Não presuma que cron esteja operacional. Consulte contagens e falhas devolvidas.

## Não foi possível autorizar a ação financeira.
Autorização de negócio falhou. Confira acesso; não reenvie tentando outro workspace.

## Emissão fiscal indisponível: o adaptador NFS-e não está habilitado. Nenhuma nota foi emitida.
É o comportamento atual do servidor: não houve emissão. Não prometer nota sandbox a partir do comentário no código.

## Aprovação bancária não liquidou
Aprovação, execução e liquidação são etapas distintas. Consulte o status e o modo; mock não prova movimentação real.

## DRE e carteira não coincidem
Confira competência/caixa, período, filtros, pagamentos, escopo e eliminação intercompany. Não ajuste títulos apenas para igualar indicadores.

## Cobrança não chegou
Template ou régua salva não prova envio.

## Quando abrir chamado
Informe rota, ação, mensagem e horário aproximado sem credenciais, documentos ou dados financeiros privados. Anexe apenas captura sanitizada.$hlp$, $hlp$troubleshooting$hlp$, $hlp$/finance$hlp$, NULL, $hlp$internal$hlp$, 340, 1, true),
($hlp$finance$hlp$, $hlp$estornar-baixa$hlp$, $hlp$Estornar baixa$hlp$, $hlp$Estornar baixa no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Estornar baixa

**Para que serve:** Estornar baixa, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Estornar baixa (`/finance/entries/$id`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra o título e localize a baixa no histórico.
2. Use a ação de estorno disponível para o pagamento.
3. Confirme a operação e consulte novamente histórico, saldo e status.

## Resultado esperado
Baixa revertida conforme o resultado do servidor, com recálculo do saldo do título.

## Regras e limites
- Exige capacidade `can_reverse`.
- Estorno de baixa não significa devolução bancária, cancelamento de cobrança ou cancelamento de NFS-e.
- Não exclua o título para corrigir um pagamento.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Estornar baixa; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.entries.$id.tsx; src/lib/finance.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/entries/$id$hlp$, $hlp$techfinance.entries.view.own$hlp$, $hlp$internal$hlp$, 100, 1, true),
($hlp$finance$hlp$, $hlp$gerenciar-cobrancas-bancarias$hlp$, $hlp$Gerenciar cobranças bancárias$hlp$, $hlp$Gerenciar cobranças bancárias no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Gerenciar cobranças bancárias

**Para que serve:** Gerenciar cobranças bancárias, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.banking`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar cobranças bancárias (`/finance/banking`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Confira a conexão e abra Cobranças.
2. Use a criação autorizada e preencha tipo, vencimento, valor, pagador, documento e descrição.
3. Confira o resultado e os dados de cobrança disponibilizados, como copia e cola ou linha digitável.
4. Cancele somente quando autorizado.
5. Simule liquidação apenas se a conexão for mock e a simulação estiver habilitada.

## Resultado esperado
Quando habilitado, o único adaptador atual gera cobranças simuladas Inter. Não há emissão bancária real implementada nem comprovação de recebimento real.

## Regras e limites
- Emissão usa `techfinance.bank_charge_issuance.manage.workspace`; cancelamento usa `techfinance.bank_charge_cancellation.manage.workspace`.
- Simulação exige `techfinance.banking_simulation.manage.workspace` e modo mock.
- Falha ou bloqueio de adaptador não autoriza afirmar que um boleto/Pix real foi emitido.

### Campos e controles
Tipo; vencimento; valor; pagador; documento; descrição.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Gerenciar cobranças bancárias; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.banking.tsx -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/banking$hlp$, $hlp$techfinance.banking.view.workspace$hlp$, $hlp$internal$hlp$, 200, 1, true),
($hlp$finance$hlp$, $hlp$gerenciar-empresas$hlp$, $hlp$Gerenciar empresas e CNPJs$hlp$, $hlp$Gerenciar empresas e CNPJs no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Gerenciar empresas e CNPJs

**Para que serve:** Gerenciar empresas e CNPJs, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.legal_entities`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar empresas e CNPJs (`/finance/legal-entities`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Use Nova empresa para cadastrar razão social e demais identificadores.
2. Informe código, nome fantasia, CNPJ, IE, IM e situação ativa.
3. Edite ou defina a empresa padrão quando tiver autorização por registro.
4. No preenchimento de CNPJs, revise candidatos, escolha registros e valide os documentos antes de aplicar.
5. Para excluir, revise vínculos e a confirmação.

## Resultado esperado
Empresa cadastrada ou atualizada no workspace, com identificadores revisados.

## Regras e limites
- Razão social/nome é obrigatório.
- Empresa padrão é uma ação controlada, não autorização para administrar o workspace.
- Preenchimento de CNPJ exige revisão; não presuma correspondência automática correta.
- Exclusão pode ser bloqueada por uso ou acesso.

### Campos e controles
Código; razão social; nome fantasia; CNPJ; IE; IM; ativa.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Gerenciar empresas e CNPJs; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/components/finance/legal-entities-page.tsx; src/components/finance/legal-entity-cnpj-fill-dialog.tsx -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/legal-entities$hlp$, $hlp$techfinance.legal_entities.view.workspace$hlp$, $hlp$internal$hlp$, 160, 1, true),
($hlp$finance$hlp$, $hlp$gerenciar-faturas$hlp$, $hlp$Gerenciar faturas$hlp$, $hlp$Gerenciar faturas no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Gerenciar faturas

**Para que serve:** Gerenciar faturas, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.invoices`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar faturas (`/invoices`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Busque por número ou descrição e filtre status, gateway, vencimento, valor e empresa.
2. Use a criação autorizada e confira dados e vencimento antes de salvar.
3. Consulte links de cobrança oferecidos no registro; copie o link quando necessário.
4. Marque como paga ou exclua apenas quando a capacidade do registro permitir.
5. Para ajuste em lote, selecione registros e revise a alteração de vencimento.
6. A emissão NFS-e é oferecida como ação, mas no servidor atual retorna indisponibilidade.

## Resultado esperado
Faturas consultadas ou alteradas conforme autorização, sem presumir emissão fiscal.

## Regras e limites
- Tela compartilhada, acessível também por chaves techsales.invoices indicadas no menu.
- Status: Rascunho, Em aberto, Paga, Vencida, Cancelada e Reembolsada.
- Kanban não libera mudança arbitrária de status.
- Exportação e capacidades de quitação/exclusão são controladas no servidor.
- Fatura paga e baixa de lançamento são conceitos distintos; confira vínculos, não deduza sincronização universal.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Gerenciar faturas; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/invoices.tsx; src/lib/access-control/use-finance-business-capabilities.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/invoices$hlp$, $hlp$techfinance.invoices.view.workspace$hlp$, $hlp$internal$hlp$, 260, 1, true),
($hlp$finance$hlp$, $hlp$gerenciar-grupos$hlp$, $hlp$Gerenciar grupos empresariais$hlp$, $hlp$Gerenciar grupos empresariais no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Gerenciar grupos empresariais

**Para que serve:** Gerenciar grupos empresariais, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.legal_entity_groups`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar grupos empresariais (`/finance/legal-entity-groups`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Crie um grupo e informe código, nome e descrição.
2. Marque os CNPJs integrantes e a situação ativa.
3. Salve e confira a composição.
4. Edite ou exclua somente quando a ação do registro estiver autorizada.
5. Use o grupo no filtro de relatórios para consultar o consolidado.

## Resultado esperado
Agrupamento de empresas disponível nos filtros compatíveis.

## Regras e limites
- Nome do grupo é obrigatório.
- Grupo empresarial não é grupo de usuários nem concede permissões.
- Relatórios podem eliminar operações intercompany internas ao grupo.

### Campos e controles
Código; nome; descrição; ativo; seleção de CNPJs integrantes.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Gerenciar grupos empresariais; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/components/finance/legal-entity-groups-page.tsx; src/components/finance/legal-entity-select.tsx -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/legal-entity-groups$hlp$, $hlp$techfinance.legal_entity_groups.view.workspace$hlp$, $hlp$internal$hlp$, 170, 1, true),
($hlp$finance$hlp$, $hlp$gerenciar-pagamentos-bancarios$hlp$, $hlp$Gerenciar rascunhos, aprovação e execução bancária$hlp$, $hlp$Gerenciar rascunhos, aprovação e execução bancária no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Gerenciar rascunhos, aprovação e execução bancária

**Para que serve:** Gerenciar rascunhos, aprovação e execução bancária, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.banking`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar rascunhos, aprovação e execução bancária (`/finance/banking`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Pagamentos e crie um rascunho autorizado.
2. Informe tipo, valor, agendamento, favorecido, documento e dados Pix ou boleto conforme o tipo.
3. Confira o rascunho e use Aprovar se autorizado.
4. Execute pela ação separada e consulte novamente o status.
5. Cancele ou simule liquidação somente quando a ação correspondente estiver disponível.

## Resultado esperado
No único adaptador atual (Inter simulado habilitado), o pagamento percorre estados simulados, sem transferência bancária real. Aprovação, execução e liquidação são etapas distintas.

## Regras e limites
- Criar usa `techfinance.bank_payment_drafts.create.workspace`.
- Aprovar, executar e cancelar usam recursos separados: bank_payment_approval, bank_payment_execution e bank_payment_cancellation, ação manage no escopo workspace.
- Simulação depende de modo mock e chave específica.
- Consulte o status antes de repetir execução após falha.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Gerenciar rascunhos, aprovação e execução bancária; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.banking.tsx; src/lib/banking.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/banking$hlp$, $hlp$techfinance.banking.view.workspace$hlp$, $hlp$internal$hlp$, 210, 1, true),
($hlp$finance$hlp$, $hlp$gerenciar-plano-contas$hlp$, $hlp$Gerenciar plano de contas$hlp$, $hlp$Gerenciar plano de contas no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Gerenciar plano de contas

**Para que serve:** Gerenciar plano de contas, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.categories`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar plano de contas (`/finance/categories`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Consulte as categorias disponíveis.
2. Use a criação para informar nome, código, tipo e categoria pai quando aplicável.
3. Salve e confira a estrutura exibida.
4. Use exclusão apenas se oferecida e autorizada para a categoria.

## Resultado esperado
Categoria financeira disponível para classificação de receitas ou despesas.

## Regras e limites
- Criação e exclusão têm permissões específicas; consultar não permite alterar.
- A interface não deve ser tratada como editor de funcionalidades não expostas.

### Campos e controles
Nome; código; tipo Receita/Despesa; categoria pai.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Gerenciar plano de contas; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.categories.tsx; src/lib/finance.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/categories$hlp$, $hlp$techfinance.categories.view.workspace$hlp$, $hlp$internal$hlp$, 140, 1, true),
($hlp$finance$hlp$, $hlp$gerenciar-recorrencias$hlp$, $hlp$Gerenciar recorrências financeiras$hlp$, $hlp$Gerenciar recorrências financeiras no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Gerenciar recorrências financeiras

**Para que serve:** Gerenciar recorrências financeiras, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.recurrences`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar recorrências financeiras (`/finance/recurrences`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Filtre as agendas por direção e empresa/grupo.
2. Crie uma recorrência com descrição, valor, datas e cadência.
3. Configure intervalo para Dias fixos e os limites de término oferecidos.
4. Confira a agenda criada; pause ou retome pela ação da linha.
5. Use a geração das pendentes quando autorizado e confira contagem de criadas, ignoradas ou falhas.
6. Exclua uma agenda apenas após conferir a confirmação.

## Resultado esperado
Agenda recorrente cadastrada, com geração condicionada à data e aos limites.

## Regras e limites
- Cadências do servidor: semanal, mensal, anual e dias fixos.
- Intervalo personalizado: 1–365 dias; dia do mês: 1–31; máximo de ocorrências: 1–1000.
- Pausar agenda não estorna pagamentos existentes.
- Capacidades de atualizar, excluir e gerar são retornadas por registro.
- Gerar exige leitura e atualização da recorrência e criação de lançamentos no escopo do responsável. Cada chamada avança no máximo 24 períodos por agenda. A exclusão só é permitida antes da primeira ocorrência gerada; pausar não apaga títulos já gerados.
- Não presuma execução automática do cron sem configuração validada.

### Campos e controles
Tipo; descrição; valor; categoria; cadência; início; término e limites quando informados; notas.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Gerenciar recorrências financeiras; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.recurrences.tsx; src/lib/finance-recurrences.functions.ts; src/lib/finance-recurrences.server.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/recurrences$hlp$, $hlp$techfinance.recurrences.view.own$hlp$, $hlp$internal$hlp$, 110, 1, true),
($hlp$finance$hlp$, $hlp$gerenciar-templates-cobranca$hlp$, $hlp$Gerenciar templates de cobrança$hlp$, $hlp$Gerenciar templates de cobrança no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Gerenciar templates de cobrança

**Para que serve:** Gerenciar templates de cobrança, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.charging_templates`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar templates de cobrança (`/settings/charging-templates`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Crie um template ou abra um existente.
2. Informe nome, canal E-mail/WhatsApp, ativo e mensagem.
3. Para e-mail, revise o assunto.
4. Use somente as variáveis apresentadas e salve.
5. Exclua apenas quando autorizado e confira eventuais réguas que utilizam o template.

## Resultado esperado
Modelo de mensagem salvo para uso na cobrança.

## Regras e limites
- Nome e corpo são obrigatórios.
- Salvar modelo não envia cobrança nem aprova template na Meta.
- Criação, atualização e exclusão têm autorização própria por recurso/registro.

### Campos e controles
Nome; canal; ativo; assunto; mensagem. Exemplos exibidos: {customer_name}, {invoice_number}, {amount}, {due_date}.

## Erros comuns
“Preencha nome e corpo”: complete ambos os campos. Em erro de acesso, solicite revisão sem tentar contornar pela URL.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Gerenciar templates de cobrança; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/settings.charging-templates.tsx; src/lib/charging-templates.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/charging-templates$hlp$, $hlp$techfinance.charging_templates.view.workspace$hlp$, $hlp$internal$hlp$, 300, 1, true),
($hlp$finance$hlp$, $hlp$integracoes$hlp$, $hlp$Integrações e limites operacionais$hlp$, $hlp$Integrações e limites operacionais no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Integrações e limites operacionais

## Conta Azul
A configuração atual fica em `/settings/integrations/contaazul`; `/integrations/contaazul` redireciona para ela. O componente usa o controle compartilhado INTEGRATIONS_MANAGE; isso não é uma chave de leitura de vendas. Importações passam pelo planejamento e reconciliação do importador completo: registros existentes ganham vínculo, novos carregam o identificador da execução para rollback e ambiguidades vão para revisão. Baixas vêm de financial_payments, não de sobrescrever paid_amount.

## Banco Inter
Consulte [conexão](/ajuda/finance/operar-banco-inter), [cobranças](/ajuda/finance/gerenciar-cobrancas-bancarias), [pagamentos](/ajuda/finance/gerenciar-pagamentos-bancarios) e [conciliação](/ajuda/finance/conciliar-transacoes). Mock exige habilitação e não representa movimentação real. Aprovação e execução bancária são separadas.

## NFS-e
`issueNfse` lança indisponibilidade após autorizar leitura da fatura: nenhuma nota é emitida pelo adaptador atual. PDFs/XMLs existentes só podem ser abertos quando os links estiverem presentes.

## Serviços, contratos e projetos
Serviços usam fluxo compartilhado. Medições contratuais podem gerar título interno ou vincular legado; esse fluxo não emite nota, boleto ou cobrança. Consulte [Gerar título de medição](/ajuda/contracts/gerar-medicao-financeiro). A aba financeira de projetos é externa ao conjunto de rotas /finance e deve ser documentada no módulo Projects.

## Cobrança e agendas
Configuração de régua, templates e recorrência não certifica execução de cron ou entrega de canal.$hlp$, $hlp$reference$hlp$, $hlp$/settings/integrations/contaazul$hlp$, NULL, $hlp$internal$hlp$, 310, 1, true),
($hlp$finance$hlp$, $hlp$operar-banco-inter$hlp$, $hlp$Consultar conexão e extrato do Banco Inter$hlp$, $hlp$Consultar conexão e extrato do Banco Inter no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Consultar conexão e extrato do Banco Inter

**Para que serve:** Consultar conexão e extrato do Banco Inter, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.banking`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar conexão e extrato do Banco Inter (`/finance/banking`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Banco Inter e confira status da conexão e disponibilidade do modo mock.
2. Somente com habilitação e autorização, inicie e conclua o fluxo oferecido.
3. Use Sincronizar quando permitido e confira a contagem retornada.
4. Consulte as abas Extrato e Histórico e siga para Conciliação quando necessário.
5. Desconecte apenas com autorização específica.

## Resultado esperado
Conexão e movimentações consultadas segundo o modo efetivamente habilitado.

## Regras e limites
- O resolvedor atual só implementa Inter simulado e exige simulação habilitada; os modos sandbox e produção são rejeitados. Conectar e desconectar exigem `techfinance.banking.manage.workspace` além de `techfinance.banking.view.workspace`. Simulação não é operação bancária real.
- Não documentar habilitação de produção como concluída.
- Sincronizar exige `techfinance.banking_sync.manage.workspace`; demais ações usam os recursos específicos indicados no código.
- Credenciais e tokens nunca devem ser copiados para chamados ou artigos.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar conexão e extrato do Banco Inter; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.banking.tsx; src/lib/banking.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/banking$hlp$, $hlp$techfinance.banking.view.workspace$hlp$, $hlp$internal$hlp$, 190, 1, true),
($hlp$finance$hlp$, $hlp$operar-servico$hlp$, $hlp$Consultar e operar serviço faturável$hlp$, $hlp$Consultar e operar serviço faturável no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Consultar e operar serviço faturável

**Para que serve:** Consultar e operar serviço faturável, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro autorizado a consultar `techservice.services` (view.own, view.team ou view.workspace), sujeito ao módulo e às políticas próprias de serviços. A permissão `techfinance.entries.view` controla o atalho financeiro, mas não autoriza esta consulta. Ações exigem capacidade específica; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar e operar serviço faturável (`/services/$id`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra o serviço a partir da listagem.
2. Confira nome, descrição, status, cadência, quantidade, preço unitário, início e fim.
3. Salve alterações somente se autorizado.
4. Se pendente e autorizado, use Ativar; consulte o resultado.
5. Exclua somente com capacidade de exclusão válida e após confirmação.

## Resultado esperado
Serviço consultado ou alterado conforme autorização, sem presumir emissão de cobrança externa.

## Regras e limites
- Cadências expostas: mensal, trimestral e anual.
- Faturar exige `techservice.billing.manage.workspace` em conjunto com as chaves financeiras verificadas na rota.
- Ações também dependem das capacidades do serviço.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar e operar serviço faturável; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/services.$id.tsx -->$hlp$, $hlp$howto$hlp$, $hlp$/services/$id$hlp$, $hlp$techfinance.entries.view.own$hlp$, $hlp$internal$hlp$, 280, 1, true),
($hlp$finance$hlp$, $hlp$parcelar-lancamento$hlp$, $hlp$Parcelar lançamento$hlp$, $hlp$Parcelar lançamento no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Parcelar lançamento

**Para que serve:** Parcelar lançamento, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Parcelar lançamento (`/finance/payable`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Novo lançamento e preencha tipo, descrição e valor total.
2. Ative Parcelar e escolha de 2 a 120 parcelas.
3. Escolha Mensal, Semanal ou Dias fixos; neste último, informe o intervalo.
4. Escolha ajuste de centavos na primeira ou na última parcela e confira a prévia.
5. Salve e confira os títulos e vencimentos na listagem.

## Resultado esperado
Grupo de parcelas cujo somatório corresponde ao total.

## Regras e limites
- Parcelamento reparte um total; recorrência repete uma agenda.
- Intervalo personalizado no servidor: 1 a 365 dias.
- Mensal ajusta o vencimento ao último dia válido quando necessário.
- A exclusão exige autorização de exclusão em todas as parcelas reais do grupo; sem essa autorização, toda a operação falha. No modo somente em aberto, parcelas fora de Em aberto/Vencido são mantidas; a âncora também pode ser mantida para preservar o grupo.

### Campos e controles
Número de parcelas; cadência; intervalo; ajuste de centavos; prévia de valores e datas.

## Erros comuns
Soma das parcelas diferente do total: revise valores e arredondamento. Intervalos acima de 365 podem ser rejeitados mesmo que digitáveis na interface.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Parcelar lançamento; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/components/finance/quick-create-entry-dialog.tsx; src/lib/finance.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/payable$hlp$, $hlp$techfinance.entries.view.own$hlp$, $hlp$internal$hlp$, 70, 1, true),
($hlp$finance$hlp$, $hlp$perguntas-frequentes$hlp$, $hlp$Perguntas frequentes do TechFinance$hlp$, $hlp$Perguntas frequentes do TechFinance no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Perguntas frequentes do TechFinance

## Criar título emite nota ou boleto?
Não. Cadastro de título é interno. Cobrança bancária e emissão fiscal são fluxos separados; o adaptador NFS-e atual está indisponível.

## Dar baixa transfere dinheiro?
Não. A baixa manual registra o fato financeiro; execução bancária é operação separada.

## Posso quitar arrastando o Kanban?
Não. O status dos títulos deriva de pagamentos; Kanban é somente leitura para essa finalidade.

## Parcelamento e recorrência são iguais?
Não. Parcelamento divide um total em 2–120 parcelas; recorrência repete a geração conforme agenda e limites.

## Por que outra pessoa vê valores diferentes?
Permissões, escopos, filtros e workspace podem diferir. Indicadores só incluem registros consultáveis.

## Por que a DRE muda entre Competência e Caixa?
O regime muda o critério temporal: competência do título ou data de pagamento.

## Grupo empresarial soma tudo sem ajustes?
Não necessariamente. O consolidado pode eliminar lançamentos intercompany entre seus CNPJs.

## Centro de custo tem cadastro nesta tela?
Não. A rota atual é de consulta de estrutura e vínculos.

## Posso editar venda importada nesta listagem?
Não. Vendas importadas é somente leitura.

## Aprovar pagamento significa executar?
Não. A execução é uma ação separada; consulte também a liquidação.

## Mock comprova pagamento bancário?
Não. Mock é simulação e depende de habilitação.

## Salvar template envia WhatsApp?
Não. É configuração; envio depende de execução e canal. Um template interno não equivale a template aprovado pela Meta.

## Empresa padrão concede acesso?
Não. É configuração financeira, não autorização RBAC.

## Por que tenho acesso à tela, mas não ao artigo?
O artigo pode exigir uma chave exata diferente do seu escopo de leitura. Solicite revisão editorial; acesso ao material nunca concede acesso aos dados.$hlp$, $hlp$faq$hlp$, $hlp$/finance$hlp$, NULL, $hlp$internal$hlp$, 350, 1, true),
($hlp$finance$hlp$, $hlp$permissoes$hlp$, $hlp$Permissões do TechFinance$hlp$, $hlp$Permissões do TechFinance no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Permissões do TechFinance

## Regra de acesso
Membership ativo no workspace ativo, licença do módulo e permissões efetivas são necessários. Deny prevalece. Escopos own, team e workspace não são intercambiáveis. Visibilidade do menu não autoriza a operação. Admin/gestor no menu não significa bypass irrestrito no servidor.

## Leitura e menu
Dashboard, A receber, A pagar e Faturamento de Serviços usam entries.view.own/team/workspace. Recorrências usa recurrences.view nos mesmos escopos. DRE/Fluxo usam reports.view. Cadastros usam categories, cost_centers, legal_entities, legal_entity_groups e bank_accounts com view.workspace/team/own. Banco Inter e Conciliação usam banking.view.workspace. Vendas importadas usa sales.view.workspace. NFS-e e Auditoria usam seus recursos view nos escopos do menu. Réguas e templates usam dunning e charging_templates. Prefixo dessas chaves: `techfinance.`. Faturas também aceita as chaves `techsales.invoices.view.*` listadas no menu.

## Criar e alterar
A criação rápida de títulos aceita entries.create.own ou entries.create.workspace. Edição e exclusão dependem da capacidade do registro; a edição em lote exige autorização de todos os selecionados. Baixa e estorno passam por finance_payment_access; não deduzir acesso apenas de entries.update. Recorrências retornam can_update, can_delete e can_generate. Cadastros de negócio usam finance_business_authorize e capacidades por linha.

## Exportar
Títulos: entries.export.workspace; relatórios: reports.export.workspace; contas bancárias: bank_accounts.export.workspace; NFS-e: nfse.export.workspace. Outras exportações usam as chaves explicitadas pela respectiva tela. Prefixo techfinance. A autorização é conferida novamente no servidor.

## Ações bancárias especiais
banking_sync.manage.workspace; bank_charge_issuance.manage.workspace; bank_charge_cancellation.manage.workspace; bank_payment_drafts.create.workspace; bank_payment_approval.manage.workspace; bank_payment_execution.manage.workspace; bank_payment_cancellation.manage.workspace; banking_simulation.manage.workspace. Conciliação exige banking.update.workspace; criar títulos por conciliação também exige entries.create. Todos sob techfinance.

## Controles comprovados
finance_entry_access, finance_payment_access, finance_recurrence_access/capabilities e finance_business_authorize limitam ações de registro. RLS e RPCs completam os controles do cliente. Não orientar concessão automática para todos os cargos.

## Limite da Ajuda
`min_permission` admite uma chave exata, mas vários menus aceitam qualquer chave de uma lista. Um artigo pode ficar indisponível para um escopo alternativo legítimo. A Ajuda não altera suas permissões; solicite revisão editorial se o material não aparecer.

## Para solicitar acesso
Informe tela, ação desejada e contexto sem dados privados. O administrador deve revisar cargo, deny, membership, licença e escopo. Não conceda manage apenas para liberar leitura.$hlp$, $hlp$reference$hlp$, $hlp$/finance$hlp$, NULL, $hlp$internal$hlp$, 330, 1, true),
($hlp$finance$hlp$, $hlp$primeiros-15-minutos$hlp$, $hlp$Primeiros 15 minutos no TechFinance$hlp$, $hlp$Primeiros 15 minutos no TechFinance no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Primeiros 15 minutos no TechFinance

## 1. Confira o contexto
Selecione o workspace e o módulo TechFinance. Se o menu não aparecer, solicite conferência de licença e permissões. Não use links diretos para contornar bloqueios.

## 2. Conheça a base
Consulte Empresas (CNPJs), Grupos empresariais, Contas bancárias e Plano de contas. Crie cadastros apenas se sua função autorizar. Centros de custo é uma consulta nesta implementação.

## 3. Consulte títulos
Em A receber ou A pagar, filtre por descrição, status, empresa/grupo e responsável. Abra a descrição para consultar a ficha. Confira valor, saldo, competência, vencimento e pagamentos.

## 4. Faça a primeira operação autorizada
Em Novo lançamento, informe descrição e valor positivo, confira tipo e datas. Parcelar divide o total; Recorrências cria uma agenda, não é a mesma operação. Somente registre uma baixa se houver evidência financeira correspondente.

## 5. Confira o resultado
Consulte os pagamentos na ficha, a DRE e o Fluxo de caixa. Alterne competência/caixa na DRE antes de comparar valores.

## Atenção
Não teste cobrança, transferência ou importação com dados reais. O único adaptador Banco Inter implementado é simulado, condicionado à habilitação de simulações; os modos sandbox e produção não estão implementados. A emissão NFS-e retorna indisponibilidade no código atual.

## Relacionados
[Consultar títulos](/ajuda/finance/consultar-contas-a-receber) · [Registrar baixa](/ajuda/finance/registrar-baixa)$hlp$, $hlp$quickstart$hlp$, $hlp$/finance$hlp$, $hlp$techfinance.entries.view.own$hlp$, $hlp$internal$hlp$, 20, 1, true),
($hlp$finance$hlp$, $hlp$registrar-baixa$hlp$, $hlp$Registrar baixa parcial ou total$hlp$, $hlp$Registrar baixa parcial ou total no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Registrar baixa parcial ou total

**Para que serve:** Registrar baixa parcial ou total, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Registrar baixa parcial ou total (`/finance/entries/$id`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra o título e use Receber/Pagar quando disponível.
2. Informe valor, data e método; selecione conta bancária se aplicável.
3. Confira que o valor não ultrapassa o saldo em aberto e confirme.
4. Reabra o histórico e verifique saldo e status.

## Resultado esperado
Pagamento financeiro registrado; baixa parcial mantém saldo e a quitação total pode marcar o título como Pago.

## Regras e limites
- Exige capacidade `can_pay`, determinada pelo servidor; não basta acesso à ficha.
- Títulos pagos ou cancelados não oferecem nova baixa nesta interface.
- Registro manual de baixa não executa transferência externa.

### Campos e controles
Valor positivo até o saldo; data; método (Pix, Boleto, Cartão, Transferência, Dinheiro ou Outro); conta bancária opcional.

## Erros comuns
“Informe um valor válido.”: revise o valor. “Valor maior que o saldo em aberto.”: limite ao saldo atualizado. “Sem permissão para esta operação de baixa.”: solicite revisão de acesso.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Registrar baixa parcial ou total; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/components/finance/register-payment-dialog.tsx; src/lib/access-control/finance-records.server.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/entries/$id$hlp$, $hlp$techfinance.entries.view.own$hlp$, $hlp$internal$hlp$, 90, 1, true),
($hlp$finance$hlp$, $hlp$revisar-a-integracao-conta-azul$hlp$, $hlp$Revisar a integração Conta Azul$hlp$, $hlp$Revisar a integração Conta Azul.$hlp$, $hlp$# Revisar a integração Conta Azul

**Para que serve:** Revisar a integração Conta Azul, no contexto da tela `/settings/integrations/contaazul`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.integrations`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/integrations/contaazul`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Integrações > Conta Azul.
2. Revise a conexão e o fluxo de importação apresentado.
3. Confira o planejamento e as conciliações antes de aplicar a importação.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Integração do TechFinance: registros existentes recebem vínculos; correspondências ambíguas vão para revisão. Pagamento deriva de financial_payments, não de escrita direta em paid_amount.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `finance`; consulte os artigos desse módulo em `/ajuda/finance`.

<!-- screenshot: capturar /settings/integrations/contaazul com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/integrations/contaazul$hlp$, NULL, $hlp$internal$hlp$, 134, 1, true),
($hlp$finance$hlp$, $hlp$simular-fluxo-caixa$hlp$, $hlp$Simular fluxo de caixa$hlp$, $hlp$Simular fluxo de caixa no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Simular fluxo de caixa

**Para que serve:** Simular fluxo de caixa, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.reports`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Simular fluxo de caixa (`/finance/cash-flow`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Selecione empresa ou grupo.
2. Confira vencidos e projeções de 0–30, 31–60 e 61–90 dias.
3. Abra Cenários e ajuste percentuais de recebimento e despesas mantidas.
4. Compare os cenários pessimista, realista e otimista.

## Resultado esperado
Projeção recalculada sem alterar títulos ou executar pagamentos.

## Regras e limites
- Recebimento padrão: 70%, 100% e 105%; despesas mantidas: 100% nos três cenários.
- Fatores validados no servidor entre 0 e 2.
- Consolidado indica quantidade de CNPJs e lançamentos intercompany eliminados.
- Alterar cenário é simulação, não edição em massa de lançamentos.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Simular fluxo de caixa; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.cash-flow.tsx; src/lib/finance.functions.ts -->$hlp$, $hlp$howto$hlp$, $hlp$/finance/cash-flow$hlp$, $hlp$techfinance.reports.view.workspace$hlp$, $hlp$internal$hlp$, 130, 1, true),
($hlp$finance$hlp$, $hlp$visao-geral$hlp$, $hlp$Visão geral do TechFinance$hlp$, $hlp$Visão geral do TechFinance no TechFinance: operação, acesso e limites confirmados no código.$hlp$, $hlp$# Visão geral do TechFinance

O TechFinance reúne títulos a receber e a pagar, baixas, parcelamentos, recorrências, cadastros financeiros, relatórios e consulta de integrações.

## Como navegar
Abra Visão geral > Dashboard; em Financeiro, escolha A receber, A pagar, Recorrências, DRE gerencial, Fluxo de caixa, Plano de contas, Centros de custo, Empresas (CNPJs), Grupos empresariais, Contas bancárias, Banco Inter, Conciliação, Faturas, Faturamento de Serviços, Vendas importadas, NFS-e, Auditoria, Régua de cobrança ou Templates de cobrança.

## O que cada registro representa
Lançamento é um título financeiro. Baixa registra recebimento ou pagamento e recalcula o saldo; não é, por si, uma transferência bancária. Fatura é um documento de cobrança separado. NFS-e é um registro fiscal separado; a emissão está bloqueada no adaptador atual. Vendas importadas são consulta de origem Conta Azul, não um editor de vendas.

## Acesso e segurança
Licença do módulo, membership ativo, permissões efetivas, escopo e acesso ao registro limitam os resultados. O menu não substitui autorização do servidor. Indicadores refletem apenas dados consultáveis.

## Próximos passos
- [Primeiros 15 minutos](/ajuda/finance/primeiros-15-minutos)
- [Permissões](/ajuda/finance/permissoes)
- [Campos e status](/ajuda/finance/campos-e-status)$hlp$, $hlp$overview$hlp$, $hlp$/finance$hlp$, $hlp$techfinance.entries.view.own$hlp$, $hlp$internal$hlp$, 10, 1, true)
ON CONFLICT (module_key, slug) DO NOTHING;
INSERT INTO public.help_articles
  (module_key, slug, title, summary, body_md, article_type, route_pattern, min_permission, audience, sort_order, version, is_published)
VALUES
($hlp$core$hlp$, $hlp$abrir-o-widget-publico-de-atendimento$hlp$, $hlp$Abrir o widget público de atendimento$hlp$, $hlp$Abrir o widget público de atendimento.$hlp$, $hlp$# Abrir o widget público de atendimento

**Para que serve:** Abrir o widget público de atendimento, no contexto da tela `/widget/$workspaceId`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/widget/$workspaceId`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o widget incorporado no site autorizado.
2. Consulte a interface e siga os controles de atendimento apresentados.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O workspaceId seleciona o contexto do widget, não concede acesso aos dados internos. Não confunda visitante com membro ativo.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /widget/$workspaceId com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/widget/$workspaceId$hlp$, NULL, $hlp$internal$hlp$, 220, 1, true),
($hlp$core$hlp$, $hlp$aceitar-convite-com-token$hlp$, $hlp$Aceitar convite com token$hlp$, $hlp$Aceitar convite com token.$hlp$, $hlp$# Aceitar convite com token

**Para que serve:** Aceitar convite com token, no contexto da tela `/accept-invite/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/accept-invite/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o convite recebido.
2. Confira o e-mail e preencha os campos do formulário.
3. Confirme a senha quando exigido e conclua o aceite.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O token é credencial de acesso. Não o substitua por um valor de exemplo ao operar nem o inclua em capturas.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /accept-invite/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/accept-invite/$token$hlp$, NULL, $hlp$internal$hlp$, 191, 1, true),
($hlp$core$hlp$, $hlp$aceitar-um-convite-recebido$hlp$, $hlp$Aceitar um convite recebido$hlp$, $hlp$Aceitar um convite recebido.$hlp$, $hlp$# Aceitar um convite recebido

**Para que serve:** Aceitar um convite recebido, no contexto da tela `/accept-invite`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/accept-invite`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o link original recebido por e-mail.
2. Confira o convite e preencha Nome completo, Telefone celular e senha quando solicitados.
3. Confirme a senha e conclua o aceite pelo formulário.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Use o link original. Convite inválido ou conta incompatível exige revisão pelo administrador; não compartilhe o token.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /accept-invite com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/accept-invite$hlp$, NULL, $hlp$internal$hlp$, 190, 1, true),
($hlp$core$hlp$, $hlp$acompanhar-meus-chamados-de-suporte$hlp$, $hlp$Acompanhar meus chamados de suporte$hlp$, $hlp$Acompanhar meus chamados de suporte.$hlp$, $hlp$# Acompanhar meus chamados de suporte

**Para que serve:** Acompanhar meus chamados de suporte, no contexto da tela `/settings/my-tickets`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/my-tickets`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Minha conta > Meus chamados.
2. Consulte os chamados e abra o detalhe desejado.
3. Use os controles apresentados para acompanhar o tratamento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Renderiza MyBugReportsPage. Não confunda chamados de produto com tickets de atendimento comercial em /tickets.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/my-tickets com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/my-tickets$hlp$, NULL, $hlp$internal$hlp$, 146, 1, true),
($hlp$core$hlp$, $hlp$administrar-canais-de-atendimento$hlp$, $hlp$Administrar canais de atendimento$hlp$, $hlp$Administrar canais de atendimento.$hlp$, $hlp$# Administrar canais de atendimento

**Para que serve:** Administrar canais de atendimento, no contexto da tela `/settings/channels`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.channels`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/channels`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Canais de atendimento.
2. Consulte as conexões e contas apresentadas.
3. Use o editor de conta somente se possuir autorização de gerenciamento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A consulta exige system.channels.view.workspace; gerenciamento usa system.channels.manage.workspace. Não trate estar conectado como garantia de entrega de mensagens.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/channels com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/channels$hlp$, $hlp$system.channels.view.workspace$hlp$, $hlp$internal$hlp$, 117, 1, true),
($hlp$core$hlp$, $hlp$administrar-membros-do-workspace$hlp$, $hlp$Administrar membros do workspace$hlp$, $hlp$Administrar membros do workspace.$hlp$, $hlp$# Administrar membros do workspace

**Para que serve:** Administrar membros do workspace, no contexto da tela `/settings/teams`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.members`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/teams`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Pessoas & Acesso > Membros.
2. Consulte os membros e o estado do vínculo.
3. Revise o usuário antes de convidar, editar ou desativar pelo controle disponível.
4. Confira os efeitos da confirmação no diálogo de desativação.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Membro inativo perde acesso mas permanece identificável como responsável. Não confunda Membros com Times nem conceda acesso só para importar um nome do HubSpot.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/teams com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/teams$hlp$, $hlp$system.members.view.workspace$hlp$, $hlp$internal$hlp$, 171, 1, true),
($hlp$core$hlp$, $hlp$atualizar-ajuda-oficial$hlp$, $hlp$Atualizar o catálogo oficial da Ajuda$hlp$, $hlp$Atualizar o catálogo oficial da Ajuda com os controles disponíveis no TechERP.$hlp$, $hlp$# Atualizar o catálogo oficial da Ajuda

**Para que serve:** Atualizar o catálogo oficial da Ajuda.

**Quem pode fazer:** Membro ativo com acesso ao material; atualização exige permissão editorial específica ou administração da plataforma.

**Onde fica:** Ajuda e Treinamento (`/ajuda`).

**Antes de começar:** Entre no aplicativo e confira o workspace ativo.

## Passo a passo
1. Abra a Ajuda com conta de administrador da plataforma ou membro ativo com permissão de atualizar/gerenciar a Base de Conhecimento.
2. Clique em Atualizar Ajuda oficial.
3. Aguarde a confirmação e confira artigos novos na pesquisa e nos módulos.
4. Se a atualização parar, repita: artigos já atualizados são preservados.

## Resultado esperado
O material ou a confirmação aparece sem alterar a operação dos módulos.

## Regras e limites
Aplica somente o conteúdo oficial incluído na versão do aplicativo. Não aceita texto, identificadores ou permissões fornecidos pelo navegador. Preserva versões iguais ou maiores que o catálogo. Não publica o aplicativo nem modifica registros comerciais.

## Erros comuns
Artigo indisponível: confira acesso e publicação do material. Falha de carregamento: tente novamente.

## Relacionados
- [Continuar na Ajuda](/ajuda/core/usar-ajuda)$hlp$, $hlp$howto$hlp$, $hlp$/ajuda$hlp$, $hlp$techservice.kb.update.workspace$hlp$, $hlp$internal$hlp$, 13, 1, true),
($hlp$core$hlp$, $hlp$atualizar-o-perfil-da-conta$hlp$, $hlp$Atualizar o perfil da conta$hlp$, $hlp$Atualizar o perfil da conta.$hlp$, $hlp$# Atualizar o perfil da conta

**Para que serve:** Atualizar o perfil da conta, no contexto da tela `/settings`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Perfil.
2. Confira o e-mail apresentado e edite o Nome completo.
3. Use a ação de salvamento do perfil.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O layout /settings não é uma segunda tela de perfil. Alterar o perfil não concede permissões nem muda o cargo do usuário.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings$hlp$, NULL, $hlp$internal$hlp$, 108, 1, true),
($hlp$core$hlp$, $hlp$campos-e-status$hlp$, $hlp$Campos e estados de Core ERP e Configurações$hlp$, $hlp$Campos e estados de Core ERP e Configurações.$hlp$, $hlp$# Campos e estados de Core ERP e Configurações

Campos transversais: nome e identificação do cadastro; contexto de workspace; estado da conexão; situação do vínculo de membro. Não são um enum único de todos os módulos.

Membros `inactive` preservam referência ao responsável, mas não liberam acesso. Idiomas da interface: `pt`, `en`, `es`; preferência de região: `BR`, `US`, `EU`. Chave API, webhook e token SCIM são segredos, não campos para capturas.

## Relacionados
- [Visão geral](/ajuda/core/visao-geral)
- [Permissões](/ajuda/core/permissoes)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 124, 1, true),
($hlp$core$hlp$, $hlp$concluir-o-retorno-de-conexao-unipile$hlp$, $hlp$Concluir o retorno de conexão Unipile$hlp$, $hlp$Concluir o retorno de conexão Unipile.$hlp$, $hlp$# Concluir o retorno de conexão Unipile

**Para que serve:** Concluir o retorno de conexão Unipile, no contexto da tela `/unipile-connected`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/unipile-connected`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Conclua o fluxo no provedor e aguarde o retorno para /unipile-connected.
2. Leia o estado informado.
3. Volte à tela de configuração para conferir a conta conectada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Callback não é prova de capacidade de envio; confira a conta no workspace correto. Não divulgue parâmetros de conexão.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /unipile-connected com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/unipile-connected$hlp$, NULL, $hlp$internal$hlp$, 217, 1, true),
($hlp$core$hlp$, $hlp$configurar-a-identidade-visual$hlp$, $hlp$Configurar a identidade visual$hlp$, $hlp$Configurar a identidade visual.$hlp$, $hlp$# Configurar a identidade visual

**Para que serve:** Configurar a identidade visual, no contexto da tela `/settings/branding`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.branding`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/branding`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Workspace > White-label.
2. Revise a aba Workspace (ERP).
3. Escolha a aba do módulo desejado ou Convite para personalizar o contexto correspondente.
4. Confira a prévia e salve pelo controle do formulário.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A identidade do workspace e a identidade por módulo são contextos diferentes. Arquétipos trocam estilo preservando identidade e assets; não prometa mudança de host ou licença ao trocar o tema.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/branding com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/branding$hlp$, $hlp$system.branding.view.workspace$hlp$, $hlp$internal$hlp$, 116, 1, true),
($hlp$core$hlp$, $hlp$configurar-notificacoes-no-slack$hlp$, $hlp$Configurar notificações no Slack$hlp$, $hlp$Configurar notificações no Slack.$hlp$, $hlp$# Configurar notificações no Slack

**Para que serve:** Configurar notificações no Slack, no contexto da tela `/settings/notifications/slack`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.integrations`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/notifications/slack`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/notifications/slack.
2. Confira Webhook URL, Workspace Slack e Canal default.
3. Revise o mapeamento Eventos → Canal antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O recurso da rota é system.integrations. Webhook URL é segredo; não a coloque em capturas ou compartilhe publicamente.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/notifications/slack com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/notifications/slack$hlp$, NULL, $hlp$internal$hlp$, 149, 1, true),
($hlp$core$hlp$, $hlp$configurar-o-provedor-de-ia-do-workspace$hlp$, $hlp$Configurar o provedor de IA do workspace$hlp$, $hlp$Configurar o provedor de IA do workspace.$hlp$, $hlp$# Configurar o provedor de IA do workspace

**Para que serve:** Configurar o provedor de IA do workspace, no contexto da tela `/settings/integrations/ai`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.ai_settings`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/integrations/ai`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Integrações > Inteligência Artificial.
2. Revise o provedor selecionado e os campos apresentados.
3. Salve as configurações pelo formulário e utilize os controles de validação disponíveis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.ai_settings; o menu agrupa sob Integrações, mas o gate é específico de IA. Chat usa o provedor do workspace, Lovable AI como padrão, sem fallback; segredos ficam cifrados no servidor.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/integrations/ai com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/integrations/ai$hlp$, NULL, $hlp$internal$hlp$, 133, 1, true),
($hlp$core$hlp$, $hlp$configurar-propriedades-personalizadas$hlp$, $hlp$Configurar propriedades personalizadas$hlp$, $hlp$Configurar propriedades personalizadas.$hlp$, $hlp$# Configurar propriedades personalizadas

**Para que serve:** Configurar propriedades personalizadas, no contexto da tela `/settings/custom-properties`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.custom_properties`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/custom-properties`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Estrutura CRM > Propriedades.
2. Escolha a Entidade e abra a criação ou edição.
3. Revise Tipo, Rótulo, Chave, Grupo e Opções.
4. Confira ordem, obrigatoriedade e o Prompt de IA opcional antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A chave é apresentada como sem espaços. Campo de prompt não garante enriquecimento executado. O cadastro não substitui regras de acesso a campos privados.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/custom-properties com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/custom-properties$hlp$, $hlp$system.custom_properties.view.workspace$hlp$, $hlp$internal$hlp$, 120, 1, true),
($hlp$core$hlp$, $hlp$consultar-a-apresentacao-comercial$hlp$, $hlp$Consultar a apresentação comercial$hlp$, $hlp$Consultar a apresentação comercial.$hlp$, $hlp$# Consultar a apresentação comercial

**Para que serve:** Consultar a apresentação comercial, no contexto da tela `/sales`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/sales`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /sales.
2. Leia a apresentação do produto.
3. Use os links apresentados para seguir ao destino desejado.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Página comercial não é tela operacional dos módulos nem fluxo de cadastro público irrestrito.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /sales com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/sales$hlp$, NULL, $hlp$internal$hlp$, 211, 1, true),
($hlp$core$hlp$, $hlp$consultar-a-base-de-conhecimento-publica$hlp$, $hlp$Consultar a base de conhecimento pública$hlp$, $hlp$Consultar a base de conhecimento pública.$hlp$, $hlp$# Consultar a base de conhecimento pública

**Para que serve:** Consultar a base de conhecimento pública, no contexto da tela `/kb`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/kb`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /kb.
2. Consulte os artigos disponíveis e abra o assunto desejado.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A base pública /kb usa kb.functions e não é a Ajuda interna /ajuda. O artigo interno desta entrega não fica público por documentar essa tela.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /kb com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/kb$hlp$, NULL, $hlp$internal$hlp$, 197, 1, true),
($hlp$core$hlp$, $hlp$consultar-a-biblioteca-de-midia$hlp$, $hlp$Consultar a biblioteca de mídia$hlp$, $hlp$Consultar a biblioteca de mídia.$hlp$, $hlp$# Consultar a biblioteca de mídia

**Para que serve:** Consultar a biblioteca de mídia, no contexto da tela `/settings/media`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.media`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/media`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/media.
2. Consulte os itens da biblioteca.
3. Use remoção apenas no item indicado e quando a ação estiver autorizada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.media. Biblioteca de mídia não é sinônimo de Arquivos ou do bucket privado de fotos de contatos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/media com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/media$hlp$, NULL, $hlp$internal$hlp$, 142, 1, true),
($hlp$core$hlp$, $hlp$consultar-a-conexao-do-whatsapp$hlp$, $hlp$Consultar a conexão do WhatsApp$hlp$, $hlp$Consultar a conexão do WhatsApp.$hlp$, $hlp$# Consultar a conexão do WhatsApp

**Para que serve:** Consultar a conexão do WhatsApp, no contexto da tela `/settings/whatsapp`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.whatsapp`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/whatsapp`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Conexão do WhatsApp.
2. Revise a conexão e as contas apresentadas.
3. Siga o fluxo de configuração exibido para a conta desejada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Estar conectado não libera envio irrestrito. Fora das 24 horas desde a última mensagem inbound, envio exige template APPROVED validado no servidor.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/whatsapp com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/whatsapp$hlp$, $hlp$system.whatsapp.view.workspace$hlp$, $hlp$internal$hlp$, 176, 1, true),
($hlp$core$hlp$, $hlp$consultar-a-configuracao-do-zapier$hlp$, $hlp$Consultar a configuração do Zapier$hlp$, $hlp$Consultar a configuração do Zapier.$hlp$, $hlp$# Consultar a configuração do Zapier

**Para que serve:** Consultar a configuração do Zapier, no contexto da tela `/settings/zapier`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.webhooks`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/zapier`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/zapier.
2. Revise as instruções e os dados de configuração apresentados.
3. Use credenciais somente em um destino de integração confiável.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso de rota system.webhooks. Nunca inclua API keys, tokens ou URLs secretas em capturas.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/zapier com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/zapier$hlp$, NULL, $hlp$internal$hlp$, 179, 1, true),
($hlp$core$hlp$, $hlp$consultar-a-politica-de-privacidade$hlp$, $hlp$Consultar a política de privacidade$hlp$, $hlp$Consultar a política de privacidade.$hlp$, $hlp$# Consultar a política de privacidade

**Para que serve:** Consultar a política de privacidade, no contexto da tela `/privacy`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/privacy`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra a página pelo link oficial.
2. Leia o documento e identifique o assunto ou direito aplicável.
3. Use os canais indicados no próprio documento quando precisar de esclarecimento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Página informativa. Não é formulário de alteração de política, garantia contratual adicional ou confirmação automática de solicitação.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /privacy com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/privacy$hlp$, NULL, $hlp$internal$hlp$, 204, 1, true),
($hlp$core$hlp$, $hlp$consultar-a-politica-de-reembolso$hlp$, $hlp$Consultar a política de reembolso$hlp$, $hlp$Consultar a política de reembolso.$hlp$, $hlp$# Consultar a política de reembolso

**Para que serve:** Consultar a política de reembolso, no contexto da tela `/refund`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/refund`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra a página pelo link oficial.
2. Leia o documento e identifique o assunto ou direito aplicável.
3. Use os canais indicados no próprio documento quando precisar de esclarecimento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Página informativa. Não é formulário de alteração de política, garantia contratual adicional ou confirmação automática de solicitação.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /refund com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/refund$hlp$, NULL, $hlp$internal$hlp$, 208, 1, true),
($hlp$core$hlp$, $hlp$consultar-assinaturas-de-workflow$hlp$, $hlp$Consultar assinaturas de workflow$hlp$, $hlp$Consultar assinaturas de workflow.$hlp$, $hlp$# Consultar assinaturas de workflow

**Para que serve:** Consultar assinaturas de workflow, no contexto da tela `/settings/workflow-subscriptions`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.workflows`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/workflow-subscriptions`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/workflow-subscriptions.
2. Consulte as assinaturas e as ações disponíveis.
3. Revise a configuração antes de criar ou editar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.workflows. Não confunda assinatura de workflow com assinatura eletrônica ou recorrência financeira.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/workflow-subscriptions com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/workflow-subscriptions$hlp$, NULL, $hlp$internal$hlp$, 178, 1, true),
($hlp$core$hlp$, $hlp$consultar-conexoes-de-anuncios$hlp$, $hlp$Consultar conexões de anúncios$hlp$, $hlp$Consultar conexões de anúncios.$hlp$, $hlp$# Consultar conexões de anúncios

**Para que serve:** Consultar conexões de anúncios, no contexto da tela `/settings/ads-sync`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/ads-sync`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/ads-sync.
2. Confira Provedor, ID externo e Nome de exibição no formulário Conectar conta.
3. Consulte Contas conectadas e Audiências sincronizadas.
4. Use Remover apenas quando quiser desconectar a conta indicada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Registrar uma conexão na tela não prova execução de sincronização no provedor; valide o estado apresentado e não prometa atualização automática.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/ads-sync com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/ads-sync$hlp$, NULL, $hlp$internal$hlp$, 110, 1, true),
($hlp$core$hlp$, $hlp$consultar-e-administrar-permissoes$hlp$, $hlp$Consultar e administrar permissões$hlp$, $hlp$Consultar e administrar permissões.$hlp$, $hlp$# Consultar e administrar permissões

**Para que serve:** Consultar e administrar permissões, no contexto da tela `/settings/permissions`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.roles`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/permissions`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Pessoas & Acesso > Permissões.
2. Revise a matriz de permissões.
3. Consulte o painel de permissões efetivas.
4. Revise também regras de campos e modelos de acesso nos painéis correspondentes antes de alterar uma concessão.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.roles. A permissão efetiva exige membership ativo, escopo correto e ausência de deny; esconder menu não protege URL/API. Edição de cargos deve ficar restrita a owner/admin.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/permissions com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/permissions$hlp$, $hlp$system.roles.view.workspace$hlp$, $hlp$internal$hlp$, 152, 1, true),
($hlp$core$hlp$, $hlp$consultar-e-organizar-arquivos$hlp$, $hlp$Consultar e organizar arquivos$hlp$, $hlp$Consultar e organizar arquivos.$hlp$, $hlp$# Consultar e organizar arquivos

**Para que serve:** Consultar e organizar arquivos, no contexto da tela `/files`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.files`.

**Onde fica:** Configurações ou navegação do workspace > `/files`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Arquivos.
2. Consulte a lista de arquivos e as ações habilitadas para seu acesso.
3. Use as ações de envio ou organização somente nos registros que você pode alterar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O recurso de autorização é system.files. Sessões de “Ver como” podem ser somente leitura; compartilhar um arquivo é uma ação distinta de consultar.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /files com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/files$hlp$, NULL, $hlp$internal$hlp$, 103, 1, true),
($hlp$core$hlp$, $hlp$consultar-exportacoes-e-relatorios$hlp$, $hlp$Consultar exportações e relatórios$hlp$, $hlp$Consultar exportações e relatórios.$hlp$, $hlp$# Consultar exportações e relatórios

**Para que serve:** Consultar exportações e relatórios, no contexto da tela `/settings/exports`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.analytics.reports`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/exports`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/exports.
2. Revise as exportações disponíveis e suas configurações.
3. Confira o destino antes de salvar uma configuração.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O mapa de rota usa system.analytics.reports. Não confunda configurar uma exportação com comprovar entrega por e-mail.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/exports com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/exports$hlp$, NULL, $hlp$internal$hlp$, 125, 1, true),
($hlp$core$hlp$, $hlp$consultar-minhas-permissoes$hlp$, $hlp$Consultar minhas permissões$hlp$, $hlp$Consultar minhas permissões.$hlp$, $hlp$# Consultar minhas permissões

**Para que serve:** Consultar minhas permissões, no contexto da tela `/settings/my-permissions`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/my-permissions`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/my-permissions.
2. Consulte as permissões agrupadas retornadas para sua conta.
3. Se aparecer Nenhuma permissão atribuída, solicite revisão ao administrador.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Esta tela é de consulta; não permite conceder permissões a si próprio. O acesso efetivo depende do workspace e deny prevalece.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/my-permissions com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/my-permissions$hlp$, NULL, $hlp$internal$hlp$, 145, 1, true),
($hlp$core$hlp$, $hlp$consultar-o-acordo-de-processamento-de-dados$hlp$, $hlp$Consultar o acordo de processamento de dados$hlp$, $hlp$Consultar o acordo de processamento de dados.$hlp$, $hlp$# Consultar o acordo de processamento de dados

**Para que serve:** Consultar o acordo de processamento de dados, no contexto da tela `/dpa`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/dpa`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra a página pelo link oficial.
2. Leia o documento e identifique o assunto ou direito aplicável.
3. Use os canais indicados no próprio documento quando precisar de esclarecimento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Página informativa. Não é formulário de alteração de política, garantia contratual adicional ou confirmação automática de solicitação.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /dpa com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/dpa$hlp$, NULL, $hlp$internal$hlp$, 195, 1, true),
($hlp$core$hlp$, $hlp$consultar-o-cancelamento-de-comunicacoes$hlp$, $hlp$Consultar o cancelamento de comunicações$hlp$, $hlp$Consultar o cancelamento de comunicações.$hlp$, $hlp$# Consultar o cancelamento de comunicações

**Para que serve:** Consultar o cancelamento de comunicações, no contexto da tela `/unsubscribe`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/unsubscribe`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o link de descadastro recebido na comunicação.
2. Confira o estado ou a confirmação apresentada.
3. Siga a ação indicada quando disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O mecanismo é o link da comunicação, não uma sessão administrativa. Descadastro não apaga automaticamente a conta ou todos os registros pessoais.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /unsubscribe com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/unsubscribe$hlp$, NULL, $hlp$internal$hlp$, 218, 1, true),
($hlp$core$hlp$, $hlp$consultar-o-catalogo-de-integracoes$hlp$, $hlp$Consultar o catálogo de integrações$hlp$, $hlp$Consultar o catálogo de integrações.$hlp$, $hlp$# Consultar o catálogo de integrações

**Para que serve:** Consultar o catálogo de integrações, no contexto da tela `/settings/integrations`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.integrations`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/integrations`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Integrações.
2. Localize a integração no catálogo.
3. Abra seu detalhe para consultar conexão e recursos disponíveis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Cada integração tem requisitos próprios; aparecer no catálogo não significa estar conectada ou licenciada.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/integrations com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/integrations$hlp$, $hlp$system.integrations.view.workspace$hlp$, $hlp$internal$hlp$, 131, 1, true),
($hlp$core$hlp$, $hlp$consultar-o-dashboard-do-erp$hlp$, $hlp$Consultar o dashboard do ERP$hlp$, $hlp$Consultar o dashboard do ERP.$hlp$, $hlp$# Consultar o dashboard do ERP

**Para que serve:** Consultar o dashboard do ERP, no contexto da tela `/home`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/home`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o Dashboard do ERP em /home.
2. Ajuste o intervalo de datas.
3. Consulte os indicadores por módulo.
4. Use as opções de exportação somente se estiverem habilitadas.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Exportação usa system.home/export. O painel agrega os módulos reais; não substitui seus dashboards específicos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /home com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/home$hlp$, NULL, $hlp$internal$hlp$, 104, 1, true),
($hlp$core$hlp$, $hlp$consultar-o-detalhe-de-uma-integracao$hlp$, $hlp$Consultar o detalhe de uma integração$hlp$, $hlp$Consultar o detalhe de uma integração.$hlp$, $hlp$# Consultar o detalhe de uma integração

**Para que serve:** Consultar o detalhe de uma integração, no contexto da tela `/settings/integrations/$slug`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.integrations`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/integrations/$slug`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra uma integração pelo catálogo.
2. Confira o nome e o estado da conexão.
3. Use somente as ações e recursos habilitados no detalhe.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O slug seleciona o conector. Não aplique o procedimento de um conector a todos os demais.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/integrations/$slug com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/integrations/$slug$hlp$, NULL, $hlp$internal$hlp$, 132, 1, true),
($hlp$core$hlp$, $hlp$consultar-o-log-de-auditoria$hlp$, $hlp$Consultar o log de auditoria$hlp$, $hlp$Consultar o log de auditoria.$hlp$, $hlp$# Consultar o log de auditoria

**Para que serve:** Consultar o log de auditoria, no contexto da tela `/settings/audit-log`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.audit`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/audit-log`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/audit-log.
2. Filtre por Módulo, Entidade e Ação.
3. Examine os eventos retornados no contexto do workspace.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A rota usa system.audit. Eventos de auditoria não devem ser confundidos com todos os eventos operacionais ou com garantia de retenção ilimitada.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/audit-log com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/audit-log$hlp$, NULL, $hlp$internal$hlp$, 114, 1, true),
($hlp$core$hlp$, $hlp$consultar-o-marketplace$hlp$, $hlp$Consultar o Marketplace$hlp$, $hlp$Consultar o Marketplace.$hlp$, $hlp$# Consultar o Marketplace

**Para que serve:** Consultar o Marketplace, no contexto da tela `/settings/marketplace`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.integrations`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/marketplace`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Marketplace.
2. Consulte os aplicativos e abra o detalhe de um app.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O menu cita system.marketplace, enquanto o gate de rota aponta system.integrations. A divergência deve ser resolvida antes de publicar a chave mínima definitiva.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/marketplace com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/marketplace$hlp$, NULL, $hlp$internal$hlp$, 140, 1, true),
($hlp$core$hlp$, $hlp$consultar-o-painel-de-ia$hlp$, $hlp$Consultar o painel de IA$hlp$, $hlp$Consultar o painel de IA.$hlp$, $hlp$# Consultar o painel de IA

**Para que serve:** Consultar o painel de IA, no contexto da tela `/settings/ai-panel`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.ai_settings`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/ai-panel`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/ai-panel.
2. Revise os controles e informações de IA apresentados.
3. Para configurar o provedor do workspace, use /settings/integrations/ai.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O mapeamento de rota usa system.ai_settings. O painel não é um módulo vertical nem autoriza acesso a dados dos demais módulos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/ai-panel com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/ai-panel$hlp$, NULL, $hlp$internal$hlp$, 111, 1, true),
($hlp$core$hlp$, $hlp$consultar-orientacoes-de-sso$hlp$, $hlp$Consultar orientações de SSO$hlp$, $hlp$Consultar orientações de SSO.$hlp$, $hlp$# Consultar orientações de SSO

**Para que serve:** Consultar orientações de SSO, no contexto da tela `/settings/sso`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/sso`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/sso.
2. Leia as orientações de SAML 2.0 e OIDC.
3. Encaminhe a configuração ao administrador responsável pelo provedor de identidade e pelo ambiente Lovable Cloud.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A tela é informativa: não contém formulário de cadastro de IdP. Os badges de JIT e grupos não demonstram configuração ativa; outros IdPs OIDC genéricos não possuem fluxo próprio nesta tela.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/sso com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/sso$hlp$, NULL, $hlp$internal$hlp$, 168, 1, true),
($hlp$core$hlp$, $hlp$consultar-os-termos-de-servico$hlp$, $hlp$Consultar os termos de serviço$hlp$, $hlp$Consultar os termos de serviço.$hlp$, $hlp$# Consultar os termos de serviço

**Para que serve:** Consultar os termos de serviço, no contexto da tela `/terms`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/terms`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra a página pelo link oficial.
2. Leia o documento e identifique o assunto ou direito aplicável.
3. Use os canais indicados no próprio documento quando precisar de esclarecimento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Página informativa. Não é formulário de alteração de política, garantia contratual adicional ou confirmação automática de solicitação.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /terms com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/terms$hlp$, NULL, $hlp$internal$hlp$, 216, 1, true),
($hlp$core$hlp$, $hlp$consultar-planos-e-cobranca$hlp$, $hlp$Consultar planos e cobrança$hlp$, $hlp$Consultar planos e cobrança.$hlp$, $hlp$# Consultar planos e cobrança

**Para que serve:** Consultar planos e cobrança, no contexto da tela `/settings/billing`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/billing`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Workspace > Planos e cobrança.
2. Revise o plano, as cotas mensais e o comparativo.
3. Consulte a seção de planos dos módulos antes de iniciar uma ação de contratação disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O plano não concede automaticamente permissões de operação. Não use os números de referência da tela de quotas da plataforma como contrato comercial.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/billing com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/billing$hlp$, $hlp$system.billing.view.workspace$hlp$, $hlp$internal$hlp$, 115, 1, true),
($hlp$core$hlp$, $hlp$consultar-presets-e-cargos-de-contratacao$hlp$, $hlp$Consultar presets e cargos de contratação$hlp$, $hlp$Consultar presets e cargos de contratação.$hlp$, $hlp$# Consultar presets e cargos de contratação

**Para que serve:** Consultar presets e cargos de contratação, no contexto da tela `/catalog/contracting-presets`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/catalog/contracting-presets`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Cadastros > Presets e Cargos.
2. Selecione Presets de contratação para trabalhar com os presets.
3. Selecione Cargos e funções para consultar o cadastro de perfis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O cadastro é compartilhado pelos módulos consumidores; o TechHire possui catálogos próprios. Não presuma que mudar um preset reescreva contratações existentes.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /catalog/contracting-presets com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/catalog/contracting-presets$hlp$, NULL, $hlp$internal$hlp$, 101, 1, true),
($hlp$core$hlp$, $hlp$consultar-privacidade-e-meus-dados$hlp$, $hlp$Consultar privacidade e meus dados$hlp$, $hlp$Consultar privacidade e meus dados.$hlp$, $hlp$# Consultar privacidade e meus dados

**Para que serve:** Consultar privacidade e meus dados, no contexto da tela `/settings/privacy`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/privacy`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Minha conta > Privacidade & Meus Dados.
2. Leia as opções de exercício de direitos e tratamento de dados.
3. Revise as consequências antes de solicitar uma ação disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Ações de LGPD não equivalem a autorização para exportar todos os dados do workspace; pedidos devem ser tratados no escopo da conta.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/privacy com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/privacy$hlp$, NULL, $hlp$internal$hlp$, 156, 1, true),
($hlp$core$hlp$, $hlp$consultar-um-aplicativo-do-marketplace$hlp$, $hlp$Consultar um aplicativo do Marketplace$hlp$, $hlp$Consultar um aplicativo do Marketplace.$hlp$, $hlp$# Consultar um aplicativo do Marketplace

**Para que serve:** Consultar um aplicativo do Marketplace, no contexto da tela `/settings/marketplace/$slug`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.integrations`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/marketplace/$slug`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o aplicativo pelo Marketplace.
2. Confira o detalhe e as opções apresentadas.
3. Revise os requisitos antes de usar uma ação de instalação ou conexão disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O slug identifica o app; não presuma que todos ofereçam as mesmas ações ou que instalação inclua licença. Há divergência menu/gate: system.marketplace versus system.integrations.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/marketplace/$slug com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/marketplace/$slug$hlp$, NULL, $hlp$internal$hlp$, 141, 1, true),
($hlp$core$hlp$, $hlp$definir-a-preferencia-de-regiao$hlp$, $hlp$Definir a preferência de região$hlp$, $hlp$Definir a preferência de região.$hlp$, $hlp$# Definir a preferência de região

**Para que serve:** Definir a preferência de região, no contexto da tela `/settings/data-residency`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.settings`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/data-residency`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/data-residency.
2. Consulte a região atual.
3. Se autorizado a gerenciar system.settings, selecione Brasil, Estados Unidos ou União Europeia.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O código registra preferência de localização. Não há nesta tela fluxo que comprove migração física dos dados, prazo de migração ou garantia de residência territorial.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/data-residency com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/data-residency$hlp$, NULL, $hlp$internal$hlp$, 121, 1, true),
($hlp$core$hlp$, $hlp$diagnosticar-o-acesso-de-um-membro$hlp$, $hlp$Diagnosticar o acesso de um membro$hlp$, $hlp$Diagnosticar o acesso de um membro.$hlp$, $hlp$# Diagnosticar o acesso de um membro

**Para que serve:** Diagnosticar o acesso de um membro, no contexto da tela `/settings/rbac-diagnostics`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.rbac_diagnostics`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/rbac-diagnostics`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Pessoas & Acesso > Diagnóstico de acesso.
2. Escolha o Membro em Usuário analisado.
3. Revise a visibilidade e as permissões efetivas exibidas.
4. Compare o resultado com a rota e ação que o membro precisa executar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.rbac_diagnostics. Diagnóstico é diferente de editar concessões; um menu visível não comprova autorização de escrita.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/rbac-diagnostics com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/rbac-diagnostics$hlp$, $hlp$system.rbac_diagnostics.view.workspace$hlp$, $hlp$internal$hlp$, 160, 1, true),
($hlp$core$hlp$, $hlp$entender-o-acesso-por-convite$hlp$, $hlp$Entender o acesso por convite$hlp$, $hlp$Entender o acesso por convite.$hlp$, $hlp$# Entender o acesso por convite

**Para que serve:** Entender o acesso por convite, no contexto da tela `/signup`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/signup`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /signup.
2. Leia Acesso por convite.
3. Solicite convite ao administrador ou use Ir para o login se já possui conta.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Cadastro público está desativado. Esta página não cria conta ou workspace por autoatendimento.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /signup com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/signup$hlp$, NULL, $hlp$internal$hlp$, 214, 1, true),
($hlp$core$hlp$, $hlp$entrar-na-conta$hlp$, $hlp$Entrar na conta$hlp$, $hlp$Entrar na conta.$hlp$, $hlp$# Entrar na conta

**Para que serve:** Entrar na conta, no contexto da tela `/login`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/login`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /login.
2. Informe Email e Senha.
3. Use o controle de entrada apresentado ou a opção de autenticação externa disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Ter conta não concede acesso automático a qualquer workspace; membership e permissões continuam obrigatórios.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /login com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/login$hlp$, NULL, $hlp$internal$hlp$, 199, 1, true),
($hlp$core$hlp$, $hlp$erros-comuns$hlp$, $hlp$Erros comuns em Core ERP e Configurações$hlp$, $hlp$Erros comuns em Core ERP e Configurações.$hlp$, $hlp$# Erros comuns em Core ERP e Configurações

## Não encontro a tela
Confira o workspace, o módulo, a licença e a permissão. Um item ausente pode ser subtela ou acesso por link, não um defeito.

## A tela abre mas não consigo alterar
Consulta e gerenciamento são ações diferentes. Verifique a permissão da ação, sem tentar contornar controles.

## Integração salva mas sem resultado externo
Confira conexão, ambiente, provedor e mensagem retornada. Salvar não comprova sincronização ou entrega.

## Link indisponível
Peça revisão ao responsável pelo link original; não compartilhe tokens nem teste identificadores alheios.

## Relacionados
- [Visão geral](/ajuda/core/visao-geral)
- [Permissões](/ajuda/core/permissoes)$hlp$, $hlp$troubleshooting$hlp$, NULL, NULL, $hlp$internal$hlp$, 126, 1, true),
($hlp$core$hlp$, $hlp$escolher-o-idioma-da-interface$hlp$, $hlp$Escolher o idioma da interface$hlp$, $hlp$Escolher o idioma da interface.$hlp$, $hlp$# Escolher o idioma da interface

**Para que serve:** Escolher o idioma da interface, no contexto da tela `/settings/language`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/language`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Workspace > Idioma.
2. Confira o idioma atual.
3. Selecione Português, Inglês ou Espanhol.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A tela usa setLocale para a interface; não é tradução automática dos dados cadastrados nem ajuste de país de telefones.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/language com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/language$hlp$, $hlp$system.language.view.workspace$hlp$, $hlp$internal$hlp$, 136, 1, true),
($hlp$core$hlp$, $hlp$escolher-uma-origem-de-importacao$hlp$, $hlp$Escolher uma origem de importação$hlp$, $hlp$Escolher uma origem de importação.$hlp$, $hlp$# Escolher uma origem de importação

**Para que serve:** Escolher uma origem de importação, no contexto da tela `/settings/import`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.import`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/import`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Importar dados.
2. Consulte as origens disponíveis no hub.
3. Escolha a origem e siga o fluxo específico exibido.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.import. Importações específicas podem exigir permissões adicionais de entidade e integração; o hub não é autorização universal para gravar nos seis módulos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/import com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/import$hlp$, $hlp$system.import.view.workspace$hlp$, $hlp$internal$hlp$, 129, 1, true),
($hlp$core$hlp$, $hlp$explorar-os-modulos-do-workspace$hlp$, $hlp$Explorar os módulos do workspace$hlp$, $hlp$Explorar os módulos do workspace.$hlp$, $hlp$# Explorar os módulos do workspace

**Para que serve:** Explorar os módulos do workspace, no contexto da tela `/modules`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/modules`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Módulos.
2. Consulte os módulos disponíveis no workspace.
3. Escolha um módulo liberado para navegar ou consulte Explorar mais.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Os seis módulos são crm, ats, people, contracts, projects e finance. Licença e permissões são controles distintos; services é identificador legado de TechContracts.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /modules com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/modules$hlp$, NULL, $hlp$internal$hlp$, 106, 1, true),
($hlp$core$hlp$, $hlp$gerar-e-revogar-tokens-scim$hlp$, $hlp$Gerar e revogar tokens SCIM$hlp$, $hlp$Gerar e revogar tokens SCIM.$hlp$, $hlp$# Gerar e revogar tokens SCIM

**Para que serve:** Gerar e revogar tokens SCIM, no contexto da tela `/settings/scim`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/scim`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/scim.
2. Consulte Base URL e endpoints Users e Groups.
3. Informe um nome para a integração e clique Gerar.
4. Copie o token uma única vez para um gerenciador de segredos.
5. Use a revogação quando a integração não deva mais acessar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O valor completo do token aparece uma única vez. A existência dos endpoints na tela não certifica compatibilidade completa com todo IdP; valide o conector sem expor credenciais.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/scim com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/scim$hlp$, NULL, $hlp$internal$hlp$, 163, 1, true),
($hlp$core$hlp$, $hlp$gerenciar-chaves-de-api$hlp$, $hlp$Gerenciar chaves de API$hlp$, $hlp$Gerenciar chaves de API.$hlp$, $hlp$# Gerenciar chaves de API

**Para que serve:** Gerenciar chaves de API, no contexto da tela `/settings/api-keys`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.api_keys`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/api-keys`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/api-keys.
2. Consulte Endpoints disponíveis e Suas chaves.
3. Para criar uma chave, preencha Nome e revise Permissões.
4. Guarde o segredo fora da Ajuda e utilize a ação de revogação quando necessário.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
As permissões de system.api_keys possuem escopo próprio no catálogo. Não copie valores de chave nem presuma que uma chave contorne RLS ou restrições do usuário.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/api-keys com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/api-keys$hlp$, NULL, $hlp$internal$hlp$, 112, 1, true),
($hlp$core$hlp$, $hlp$importar-uma-planilha-csv$hlp$, $hlp$Importar uma planilha CSV$hlp$, $hlp$Importar uma planilha CSV.$hlp$, $hlp$# Importar uma planilha CSV

**Para que serve:** Importar uma planilha CSV, no contexto da tela `/settings/import-csv`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/import-csv`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/import-csv.
2. Selecione a entidade e o arquivo no assistente.
3. Revise mapeamento e validações antes de confirmar a importação.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A autorização acompanha a entidade importada. Não inclua uma planilha real, dados pessoais ou credenciais nas capturas da Ajuda.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/import-csv com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/import-csv$hlp$, NULL, $hlp$internal$hlp$, 130, 1, true),
($hlp$core$hlp$, $hlp$ler-avaliar-artigo$hlp$, $hlp$Ler e avaliar um artigo$hlp$, $hlp$Ler e avaliar um artigo com os controles disponíveis no TechERP.$hlp$, $hlp$# Ler e avaliar um artigo

**Para que serve:** Ler e avaliar um artigo.

**Quem pode fazer:** Membro ativo com acesso ao material; atualização exige permissão editorial específica ou administração da plataforma.

**Onde fica:** Ajuda e Treinamento (`/ajuda/$module/$slug`).

**Antes de começar:** Entre no aplicativo e confira o workspace ativo.

## Passo a passo
1. Abra o artigo e confira a data de atualização e a versão.
2. Use o índice para ir à seção desejada.
3. Consulte os artigos relacionados ao final.
4. Responda se o artigo foi útil; registre um comentário de até 2.000 caracteres quando necessário.

## Resultado esperado
O material ou a confirmação aparece sem alterar a operação dos módulos.

## Regras e limites
HTML bruto não é executado no leitor. Avaliação é vinculada ao usuário autenticado e ao artigo disponível. Nenhuma avaliação altera automaticamente uma funcionalidade.

## Erros comuns
Artigo indisponível: confira acesso e publicação do material. Falha de carregamento: tente novamente.

## Relacionados
- [Continuar na Ajuda](/ajuda/core/usar-ajuda)$hlp$, $hlp$howto$hlp$, $hlp$/ajuda/$module/$slug$hlp$, NULL, $hlp$internal$hlp$, 12, 1, true),
($hlp$core$hlp$, $hlp$ler-um-artigo-da-base-publica$hlp$, $hlp$Ler um artigo da base pública$hlp$, $hlp$Ler um artigo da base pública.$hlp$, $hlp$# Ler um artigo da base pública

**Para que serve:** Ler um artigo da base pública, no contexto da tela `/kb/$slug`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/kb/$slug`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra um artigo a partir de /kb.
2. Leia o conteúdo disponível para o slug.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A base pública não expõe automaticamente help_articles. Slug inexistente não deve ser substituído por token ou identificador de outro recurso.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /kb/$slug com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/kb/$slug$hlp$, NULL, $hlp$internal$hlp$, 198, 1, true),
($hlp$core$hlp$, $hlp$manter-empresas-e-cnpjs-do-workspace$hlp$, $hlp$Manter empresas e CNPJs do workspace$hlp$, $hlp$Manter empresas e CNPJs do workspace.$hlp$, $hlp$# Manter empresas e CNPJs do workspace

**Para que serve:** Manter empresas e CNPJs do workspace, no contexto da tela `/settings/legal-entities`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/legal-entities`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Workspace > Empresas (CNPJs).
2. Consulte as empresas e selecione o cadastro desejado.
3. Revise os campos do formulário antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Cadastro compartilhado de pessoas jurídicas com componente da área financeira; não é a lista de empresas do CRM nem uma lista de workspaces.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/legal-entities com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/legal-entities$hlp$, $hlp$system.legal_entities.view.workspace$hlp$, $hlp$internal$hlp$, 138, 1, true),
($hlp$core$hlp$, $hlp$manter-grupos-empresariais$hlp$, $hlp$Manter grupos empresariais$hlp$, $hlp$Manter grupos empresariais.$hlp$, $hlp$# Manter grupos empresariais

**Para que serve:** Manter grupos empresariais, no contexto da tela `/settings/legal-entity-groups`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/legal-entity-groups`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Workspace > Grupos empresariais.
2. Consulte os grupos cadastrados.
3. Revise os vínculos de empresas antes de salvar alterações.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Grupo empresarial não é time de usuários, cargo de acesso nem agrupamento de workspaces.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/legal-entity-groups com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/legal-entity-groups$hlp$, $hlp$system.legal_entity_groups.view.workspace$hlp$, $hlp$internal$hlp$, 139, 1, true),
($hlp$core$hlp$, $hlp$manter-modelos-de-onboarding-por-entidade$hlp$, $hlp$Manter modelos de onboarding por entidade$hlp$, $hlp$Manter modelos de onboarding por entidade.$hlp$, $hlp$# Manter modelos de onboarding por entidade

**Para que serve:** Manter modelos de onboarding por entidade, no contexto da tela `/settings/onboarding-templates`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/onboarding-templates`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/onboarding-templates.
2. Defina Entidade, Nome e Descrição.
3. Revise os campos de Segmentação e o UUID opcional de Workflow.
4. Confira os JSONs de etapas/campos e tarefas automáticas antes de gravar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Modelo genérico por entidade; não substitui /people/onboarding-templates. JSON inválido ou UUID incorreto precisa ser corrigido antes de uso.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/onboarding-templates com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/onboarding-templates$hlp$, NULL, $hlp$internal$hlp$, 150, 1, true),
($hlp$core$hlp$, $hlp$manter-o-catalogo-de-servicos$hlp$, $hlp$Manter o catálogo de serviços$hlp$, $hlp$Manter o catálogo de serviços.$hlp$, $hlp$# Manter o catálogo de serviços

**Para que serve:** Manter o catálogo de serviços, no contexto da tela `/catalog/services`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/catalog/services`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Cadastros > Catálogo de Serviços.
2. Consulte os serviços cadastrados ou abra o formulário de criação/edição disponível.
3. Preencha Nome e revise código, categoria, tipo, preço base, moeda e unidade.
4. Revise custo, imposto, SLA, descrição, competências e tags antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A rota verifica techsales.catalog.services.update.workspace. A seção Integração com recrutamento não transforma este cadastro no catálogo nativo do ATS.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /catalog/services com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/catalog/services$hlp$, NULL, $hlp$internal$hlp$, 102, 1, true),
($hlp$core$hlp$, $hlp$manter-objetos-personalizados$hlp$, $hlp$Manter objetos personalizados$hlp$, $hlp$Manter objetos personalizados.$hlp$, $hlp$# Manter objetos personalizados

**Para que serve:** Manter objetos personalizados, no contexto da tela `/settings/custom-objects`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.custom_objects`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/custom-objects`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Estrutura CRM > Objetos custom.
2. Defina Nome e Slug do objeto no formulário disponível.
3. Revise os Campos e os respectivos tipos antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Criação, atualização e exclusão verificam ações distintas de system.custom_objects. Criar um objeto não cria um novo módulo vertical.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/custom-objects com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/custom-objects$hlp$, $hlp$system.custom_objects.view.workspace$hlp$, $hlp$internal$hlp$, 119, 1, true),
($hlp$core$hlp$, $hlp$manter-respostas-prontas$hlp$, $hlp$Manter respostas prontas$hlp$, $hlp$Manter respostas prontas.$hlp$, $hlp$# Manter respostas prontas

**Para que serve:** Manter respostas prontas, no contexto da tela `/settings/snippets`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/snippets`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/snippets.
2. Consulte as respostas prontas.
3. Abra o formulário disponível e revise o conteúdo antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Um snippet não é um template WhatsApp aprovado pela Meta nem substitui suas regras de envio.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/snippets com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/snippets$hlp$, NULL, $hlp$internal$hlp$, 167, 1, true),
($hlp$core$hlp$, $hlp$manter-tipos-de-assinatura-de-comunicacao$hlp$, $hlp$Manter tipos de assinatura de comunicação$hlp$, $hlp$Manter tipos de assinatura de comunicação.$hlp$, $hlp$# Manter tipos de assinatura de comunicação

**Para que serve:** Manter tipos de assinatura de comunicação, no contexto da tela `/settings/subscriptions`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.communication.subscription_types`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/subscriptions`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/subscriptions.
2. Consulte o cadastro de tipos de assinatura.
3. Revise a criação ou edição disponível antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.communication.subscription_types. São preferências/tipos de comunicação, não assinatura de contrato nem cobrança recorrente.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/subscriptions com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/subscriptions$hlp$, NULL, $hlp$internal$hlp$, 169, 1, true),
($hlp$core$hlp$, $hlp$manter-webhooks-de-integracao$hlp$, $hlp$Manter webhooks de integração$hlp$, $hlp$Manter webhooks de integração.$hlp$, $hlp$# Manter webhooks de integração

**Para que serve:** Manter webhooks de integração, no contexto da tela `/settings/webhooks`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.webhooks`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/webhooks`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/webhooks.
2. Consulte os webhooks e filtros existentes.
3. Revise destino e configuração na criação ou edição disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.webhooks. URL e segredo de destino são sensíveis; configurar não comprova entrega ou autorização no serviço receptor.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/webhooks com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/webhooks$hlp$, NULL, $hlp$internal$hlp$, 175, 1, true),
($hlp$core$hlp$, $hlp$navegar-artigos-modulo$hlp$, $hlp$Navegar pelos artigos de um módulo$hlp$, $hlp$Navegar pelos artigos de um módulo com os controles disponíveis no TechERP.$hlp$, $hlp$# Navegar pelos artigos de um módulo

**Para que serve:** Navegar pelos artigos de um módulo.

**Quem pode fazer:** Membro ativo com acesso ao material; atualização exige permissão editorial específica ou administração da plataforma.

**Onde fica:** Ajuda e Treinamento (`/ajuda/$module`).

**Antes de começar:** Entre no aplicativo e confira o workspace ativo.

## Passo a passo
1. Abra um módulo na página da Ajuda.
2. Use o filtro de texto para encontrar o título desejado.
3. Escolha o artigo e confira o seu tipo: visão geral, primeiros 15 minutos, como fazer, referência, erros ou FAQ.

## Resultado esperado
O material ou a confirmação aparece sem alterar a operação dos módulos.

## Regras e limites
Se o módulo não estiver disponível, confira licença, vínculo ativo e permissões com a administração. Não tente contornar por URL.

## Erros comuns
Artigo indisponível: confira acesso e publicação do material. Falha de carregamento: tente novamente.

## Relacionados
- [Continuar na Ajuda](/ajuda/core/ler-avaliar-artigo)$hlp$, $hlp$howto$hlp$, $hlp$/ajuda/$module$hlp$, NULL, $hlp$internal$hlp$, 11, 1, true),
($hlp$core$hlp$, $hlp$organizar-grupos-de-propriedades$hlp$, $hlp$Organizar grupos de propriedades$hlp$, $hlp$Organizar grupos de propriedades.$hlp$, $hlp$# Organizar grupos de propriedades

**Para que serve:** Organizar grupos de propriedades, no contexto da tela `/settings/property-groups`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/property-groups`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/property-groups.
2. Consulte os grupos.
3. Informe Novo nome para a alteração desejada e use o controle disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Grupos organizam propriedades; não são grupos de usuários e não concedem permissão sobre os campos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/property-groups com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/property-groups$hlp$, NULL, $hlp$internal$hlp$, 157, 1, true),
($hlp$core$hlp$, $hlp$organizar-times-do-workspace$hlp$, $hlp$Organizar times do workspace$hlp$, $hlp$Organizar times do workspace.$hlp$, $hlp$# Organizar times do workspace

**Para que serve:** Organizar times do workspace, no contexto da tela `/settings/user-groups`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/user-groups`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Pessoas & Acesso > Times.
2. Consulte Equipes do workspace.
3. Preencha Nome, Cor e Descrição no formulário disponível.
4. Revise os participantes e salve.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Times organizam usuários; não são empresas, cargos de contratação ou módulos licenciados. A permissão para organizar times não é autorização universal sobre seus registros.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/user-groups com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/user-groups$hlp$, NULL, $hlp$internal$hlp$, 172, 1, true),
($hlp$core$hlp$, $hlp$perguntas-frequentes$hlp$, $hlp$Perguntas frequentes de Core ERP e Configurações$hlp$, $hlp$Perguntas frequentes de Core ERP e Configurações.$hlp$, $hlp$# Perguntas frequentes de Core ERP e Configurações

## Configurações pertencem todas ao Core?
Não. NFS-e e pagamentos são financeiros; assinatura eletrônica é TechContracts; scoring e metas são TechSales.

## Core é um módulo vertical?
Não. Ele reúne recursos compartilhados.

## Admin do workspace acessa a plataforma?
Não por esse papel; plataforma tem validação própria.

## A Ajuda fica disponível para clientes?
Não. Esta entrega usa `audience=internal`; `/kb` é uma base diferente.

## Uma configuração salva garante o resultado externo?
Não; verifique conexão e execução no provedor.

## Relacionados
- [Visão geral](/ajuda/core/visao-geral)
- [Permissões](/ajuda/core/permissoes)$hlp$, $hlp$faq$hlp$, NULL, NULL, $hlp$internal$hlp$, 127, 1, true),
($hlp$core$hlp$, $hlp$permissoes$hlp$, $hlp$Permissões de Core ERP e Configurações$hlp$, $hlp$Permissões de Core ERP e Configurações.$hlp$, $hlp$# Permissões de Core ERP e Configurações

Membro ativo e workspace correto são pré-requisitos. Recursos administrativos usam `system.*`; nem toda rota `/settings` pertence ao Core. Ler não implica criar, atualizar, excluir, exportar ou gerenciar. Deny prevalece.

O menu pode ter alternativas em `permissionAny`, enquanto `help_articles.min_permission` armazena uma única chave. Por isso os rascunhos com alternativas inconciliáveis não recebem chave inventada; precisam de revisão antes da publicação.

Chaves de menu, gate de URL, middleware e RLS devem ser verificados em conjunto.

## Relacionados
- [Visão geral](/ajuda/core/visao-geral)
- [Permissões](/ajuda/core/permissoes)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 125, 1, true),
($hlp$core$hlp$, $hlp$preparar-a-impressao-do-dashboard$hlp$, $hlp$Preparar a impressão do dashboard$hlp$, $hlp$Preparar a impressão do dashboard.$hlp$, $hlp$# Preparar a impressão do dashboard

**Para que serve:** Preparar a impressão do dashboard, no contexto da tela `/home/print`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/home/print`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra a versão de impressão do dashboard.
2. Confira o período e os indicadores apresentados.
3. Use a impressão do navegador após conferir o conteúdo.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A rota verifica a ação de exportação de system.home. A impressão não deve expor dados a pessoas sem acesso ao workspace.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /home/print com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/home/print$hlp$, NULL, $hlp$internal$hlp$, 105, 1, true),
($hlp$core$hlp$, $hlp$primeiros-15-minutos$hlp$, $hlp$Primeiros 15 minutos em Core ERP e Configurações$hlp$, $hlp$Primeiros 15 minutos em Core ERP e Configurações.$hlp$, $hlp$# Primeiros 15 minutos em Core ERP e Configurações

1. Confirme a conta e o workspace.
2. Abra `/home`.
3. Consulte seu acesso antes de alterar configurações.
4. Localize a tela na lista abaixo.
5. Abra seu guia e revise regras e limites antes de agir.

- `/auth/extension-link`: Vincular a extensão do TechHire
- `/catalog/contracting-presets`: Consultar presets e cargos de contratação
- `/catalog/services`: Manter o catálogo de serviços
- `/files`: Consultar e organizar arquivos
- `/home`: Consultar o dashboard do ERP
- `/home/print`: Preparar a impressão do dashboard
- `/modules`: Explorar os módulos do workspace
- `/onboarding/$entity`: Usar o onboarding guiado de uma entidade
- `/settings`: Atualizar o perfil da conta
- `/settings/access-policy`: Revisar a política de acesso
- `/settings/ads-sync`: Consultar conexões de anúncios
- `/settings/ai-panel`: Consultar o painel de IA
- `/settings/api-keys`: Gerenciar chaves de API
- `/settings/audit-export`: Revisar exportação de audit logs
- `/settings/audit-log`: Consultar o log de auditoria
- `/settings/billing`: Consultar planos e cobrança
- `/settings/branding`: Configurar a identidade visual
- `/settings/channels`: Administrar canais de atendimento
- `/settings/custom-objects`: Manter objetos personalizados
- `/settings/custom-properties`: Configurar propriedades personalizadas
- `/settings/data-residency`: Definir a preferência de região
- `/settings/exports`: Consultar exportações e relatórios
- `/settings/hubspot-users`: Revisar responsáveis importados do HubSpot
- `/settings/import`: Escolher uma origem de importação
- `/settings/import-csv`: Importar uma planilha CSV
- `/settings/integrations`: Consultar o catálogo de integrações
- `/settings/integrations/$slug`: Consultar o detalhe de uma integração
- `/settings/integrations/ai`: Configurar o provedor de IA do workspace
- `/settings/integrations/linkedin`: Revisar a conexão LinkedIn
- `/settings/language`: Escolher o idioma da interface
- `/settings/legal-entities`: Manter empresas e CNPJs do workspace
- `/settings/legal-entity-groups`: Manter grupos empresariais
- `/settings/marketplace`: Consultar o Marketplace
- `/settings/marketplace/$slug`: Consultar um aplicativo do Marketplace
- `/settings/media`: Consultar a biblioteca de mídia
- `/settings/mobile`: Usar instalação PWA e notificações
- `/settings/my-permissions`: Consultar minhas permissões
- `/settings/my-tickets`: Acompanhar meus chamados de suporte
- `/settings/notifications`: Revisar preferências de notificações
- `/settings/notifications/slack`: Configurar notificações no Slack
- `/settings/onboarding-templates`: Manter modelos de onboarding por entidade
- `/settings/permissions`: Consultar e administrar permissões
- `/settings/phones`: Revisar país padrão e telefones legados
- `/settings/privacy`: Consultar privacidade e meus dados
- `/settings/property-groups`: Organizar grupos de propriedades
- `/settings/rbac-diagnostics`: Diagnosticar o acesso de um membro
- `/settings/record-layouts`: Revisar layouts de fichas
- `/settings/scim`: Gerar e revogar tokens SCIM
- `/settings/security`: Revisar a segurança da minha conta
- `/settings/snippets`: Manter respostas prontas
- `/settings/sso`: Consultar orientações de SSO
- `/settings/subscriptions`: Manter tipos de assinatura de comunicação
- `/settings/teams`: Administrar membros do workspace
- `/settings/user-groups`: Organizar times do workspace
- `/settings/webhooks`: Manter webhooks de integração
- `/settings/whatsapp`: Consultar a conexão do WhatsApp
- `/settings/widget`: Revisar o widget do site
- `/settings/workflow-subscriptions`: Consultar assinaturas de workflow
- `/settings/zapier`: Consultar a configuração do Zapier
- `/workspace/modules`: Revisar módulos do workspace
- `/accept-invite`: Aceitar um convite recebido
- `/accept-invite/$token`: Aceitar convite com token
- `/dpa`: Consultar o acordo de processamento de dados
- `/kb`: Consultar a base de conhecimento pública
- `/kb/$slug`: Ler um artigo da base pública
- `/login`: Entrar na conta
- `/privacy`: Consultar a política de privacidade
- `/refund`: Consultar a política de reembolso
- `/reset-password`: Recuperar a senha da conta
- `/sales`: Consultar a apresentação comercial
- `/signup`: Entender o acesso por convite
- `/terms`: Consultar os termos de serviço
- `/unipile-connected`: Concluir o retorno de conexão Unipile
- `/unsubscribe`: Consultar o cancelamento de comunicações
- `/widget/$workspaceId`: Abrir o widget público de atendimento

## Relacionados
- [Visão geral](/ajuda/core/visao-geral)
- [Permissões](/ajuda/core/permissoes)$hlp$, $hlp$quickstart$hlp$, NULL, NULL, $hlp$internal$hlp$, 123, 1, true),
($hlp$core$hlp$, $hlp$recuperar-a-senha-da-conta$hlp$, $hlp$Recuperar a senha da conta$hlp$, $hlp$Recuperar a senha da conta.$hlp$, $hlp$# Recuperar a senha da conta

**Para que serve:** Recuperar a senha da conta, no contexto da tela `/reset-password`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/reset-password`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Recuperar senha a partir do login.
2. Siga o formulário exibido para recuperação.
3. Use o link de recuperação recebido para definir a nova senha quando essa etapa for apresentada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Não envie senha, token ou link de recuperação a terceiros. O fluxo depende do estado de recuperação da sessão.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /reset-password com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/reset-password$hlp$, NULL, $hlp$internal$hlp$, 209, 1, true),
($hlp$core$hlp$, $hlp$revisar-a-conexao-linkedin$hlp$, $hlp$Revisar a conexão LinkedIn$hlp$, $hlp$Revisar a conexão LinkedIn.$hlp$, $hlp$# Revisar a conexão LinkedIn

**Para que serve:** Revisar a conexão LinkedIn, no contexto da tela `/settings/integrations/linkedin`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.integrations`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/integrations/linkedin`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > LinkedIn (Unipile).
2. Confira as contas conectadas.
3. Revise Fuso horário, Início, Fim e Uso de hoje.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Os limites exibidos dependem da conta e do provedor; conexão não autoriza envio irrestrito nem substitui consentimento.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/integrations/linkedin com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/integrations/linkedin$hlp$, $hlp$system.linkedin.view.workspace$hlp$, $hlp$internal$hlp$, 135, 1, true),
($hlp$core$hlp$, $hlp$revisar-a-politica-de-acesso$hlp$, $hlp$Revisar a política de acesso$hlp$, $hlp$Revisar a política de acesso.$hlp$, $hlp$# Revisar a política de acesso

**Para que serve:** Revisar a política de acesso, no contexto da tela `/settings/access-policy`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.settings`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/access-policy`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/access-policy.
2. Revise IP allow-list e o estado de Ativar enforcement.
3. Revise timeout de sessão, exigência de MFA e opção Forçar SSO.
4. Consulte as tentativas bloqueadas recentes antes de encerrar a revisão.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Timeout validado entre 15 e 1440 minutos; lista limitada a 50 entradas. O helper isIpAllowed aceita correspondência exata e trata entradas com barra como prefixo de três octetos; lista vazia permite. Não interprete isso como suporte CIDR geral nem como prova de enforcement em todo login.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/access-policy com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/access-policy$hlp$, NULL, $hlp$internal$hlp$, 109, 1, true),
($hlp$core$hlp$, $hlp$revisar-a-seguranca-da-minha-conta$hlp$, $hlp$Revisar a segurança da minha conta$hlp$, $hlp$Revisar a segurança da minha conta.$hlp$, $hlp$# Revisar a segurança da minha conta

**Para que serve:** Revisar a segurança da minha conta, no contexto da tela `/settings/security`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/security`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Minha conta > Segurança (2FA).
2. Consulte o estado e as opções de autenticação multifator.
3. Siga o fluxo de configuração e validação apresentado.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Segurança pessoal não substitui a política de acesso do workspace. Não publique QR codes, segredos de MFA ou códigos de recuperação.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/security com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/security$hlp$, NULL, $hlp$internal$hlp$, 165, 1, true),
($hlp$core$hlp$, $hlp$revisar-exportacao-de-audit-logs$hlp$, $hlp$Revisar exportação de audit logs$hlp$, $hlp$Revisar exportação de audit logs.$hlp$, $hlp$# Revisar exportação de audit logs

**Para que serve:** Revisar exportação de audit logs, no contexto da tela `/settings/audit-export`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.audit_exports`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/audit-export`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/audit-export.
2. Revise as configurações e o estado Ativo.
3. Altere somente os destinos e opções aprovados para exportação de auditoria.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso de rota system.audit_exports. Destinos e credenciais de exportação são sensíveis; a presença da configuração não comprova entrega em um destino externo.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/audit-export com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/audit-export$hlp$, NULL, $hlp$internal$hlp$, 113, 1, true),
($hlp$core$hlp$, $hlp$revisar-layouts-de-fichas$hlp$, $hlp$Revisar layouts de fichas$hlp$, $hlp$Revisar layouts de fichas.$hlp$, $hlp$# Revisar layouts de fichas

**Para que serve:** Revisar layouts de fichas, no contexto da tela `/settings/record-layouts`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/record-layouts`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/record-layouts.
2. Consulte os layouts e as opções de organização apresentados.
3. Revise a configuração da entidade antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O layout organiza a apresentação; não redefine as permissões de acesso a dados nem a visibilidade de campos sensíveis.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/record-layouts com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/record-layouts$hlp$, NULL, $hlp$internal$hlp$, 161, 1, true),
($hlp$core$hlp$, $hlp$revisar-modulos-do-workspace$hlp$, $hlp$Revisar módulos do workspace$hlp$, $hlp$Revisar módulos do workspace.$hlp$, $hlp$# Revisar módulos do workspace

**Para que serve:** Revisar módulos do workspace, no contexto da tela `/workspace/modules`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/workspace/modules`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /workspace/modules.
2. Consulte os módulos e seus estados.
3. Revise as opções habilitadas para o workspace antes de confirmar uma mudança.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Os seis módulos verticais são distintos do Core e da administração de plataforma. Services é identificador legado de TechContracts, não novo produto.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /workspace/modules com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/workspace/modules$hlp$, NULL, $hlp$internal$hlp$, 180, 1, true),
($hlp$core$hlp$, $hlp$revisar-o-widget-do-site$hlp$, $hlp$Revisar o widget do site$hlp$, $hlp$Revisar o widget do site.$hlp$, $hlp$# Revisar o widget do site

**Para que serve:** Revisar o widget do site, no contexto da tela `/settings/widget`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/widget`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Widget do site.
2. Revise as opções apresentadas de configuração do widget.
3. Confira o contexto do workspace antes de usar a configuração no site.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O widget público e a Inbox são superfícies diferentes. A configuração não concede a visitantes acesso à Ajuda interna ou aos registros do ERP.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/widget com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/widget$hlp$, $hlp$system.widget.view.workspace$hlp$, $hlp$internal$hlp$, 177, 1, true),
($hlp$core$hlp$, $hlp$revisar-pais-padrao-e-telefones-legados$hlp$, $hlp$Revisar país padrão e telefones legados$hlp$, $hlp$Revisar país padrão e telefones legados.$hlp$, $hlp$# Revisar país padrão e telefones legados

**Para que serve:** Revisar país padrão e telefones legados, no contexto da tela `/settings/phones`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.phone_normalization`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/phones`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Workspace > Telefones.
2. Consulte o país padrão e ajuste-o somente com autorização de gerenciamento.
3. Abra os registros de revisão de telefones legados.
4. Confira cada sugestão antes de aplicar uma resolução.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O gate da rota usa system.phone_normalization, mas o menu usa system.language. Cadastro de telefone segue E.164; não invente país para corrigir números ambíguos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/phones com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/phones$hlp$, NULL, $hlp$internal$hlp$, 153, 1, true),
($hlp$core$hlp$, $hlp$revisar-preferencias-de-notificacoes$hlp$, $hlp$Revisar preferências de notificações$hlp$, $hlp$Revisar preferências de notificações.$hlp$, $hlp$# Revisar preferências de notificações

**Para que serve:** Revisar preferências de notificações, no contexto da tela `/settings/notifications`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/notifications`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/notifications.
2. Consulte as preferências disponíveis.
3. Ajuste apenas as opções exibidas e confirme o resultado na tela.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Preferência de notificação não altera a responsabilidade dos registros nem concede acesso a outro módulo.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/notifications com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/notifications$hlp$, NULL, $hlp$internal$hlp$, 148, 1, true),
($hlp$core$hlp$, $hlp$revisar-responsaveis-importados-do-hubspot$hlp$, $hlp$Revisar responsáveis importados do HubSpot$hlp$, $hlp$Revisar responsáveis importados do HubSpot.$hlp$, $hlp$# Revisar responsáveis importados do HubSpot

**Para que serve:** Revisar responsáveis importados do HubSpot, no contexto da tela `/settings/hubspot-users`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/hubspot-users`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/hubspot-users.
2. Confira os responsáveis e vínculos apresentados.
3. Revise a ação disponível antes de criar ou associar responsáveis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Responsável importado não recebe automaticamente acesso: membership inactive preserva o nome e remove acesso. Não trate importação como convite aceito.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/hubspot-users com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/hubspot-users$hlp$, NULL, $hlp$internal$hlp$, 128, 1, true),
($hlp$core$hlp$, $hlp$usar-ajuda$hlp$, $hlp$Usar a Ajuda e Treinamento$hlp$, $hlp$Usar a Ajuda e Treinamento com os controles disponíveis no TechERP.$hlp$, $hlp$# Usar a Ajuda e Treinamento

**Para que serve:** Usar a Ajuda e Treinamento.

**Quem pode fazer:** Membro ativo com acesso ao material; atualização exige permissão editorial específica ou administração da plataforma.

**Onde fica:** Ajuda e Treinamento (`/ajuda`).

**Antes de começar:** Entre no aplicativo e confira o workspace ativo.

## Passo a passo
1. Abra Ajuda e Treinamento pelo menu.
2. Digite ao menos duas letras na pesquisa e clique em Pesquisar.
3. Abra um resultado ou escolha um módulo disponível.
4. Para orientação da tela em que está, clique em Ajuda desta tela no cabeçalho.

## Resultado esperado
O material ou a confirmação aparece sem alterar a operação dos módulos.

## Regras e limites
A pesquisa usa texto em português e devolve até 30 resultados. Somente módulos autorizados aparecem. Artigos podem ter requisito próprio de leitura; acesso ao material não autoriza executar a operação.

## Erros comuns
Artigo indisponível: confira acesso e publicação do material. Falha de carregamento: tente novamente.

## Relacionados
- [Continuar na Ajuda](/ajuda/core/navegar-artigos-modulo)$hlp$, $hlp$howto$hlp$, $hlp$/ajuda$hlp$, NULL, $hlp$internal$hlp$, 10, 1, true),
($hlp$core$hlp$, $hlp$usar-instalacao-pwa-e-notificacoes$hlp$, $hlp$Usar instalação PWA e notificações$hlp$, $hlp$Usar instalação PWA e notificações.$hlp$, $hlp$# Usar instalação PWA e notificações

**Para que serve:** Usar instalação PWA e notificações, no contexto da tela `/settings/mobile`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/mobile`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/mobile.
2. Confira a opção Instalar agora quando disponível no navegador.
3. Revise as opções de notificações e o estado de permissão do navegador.
4. Leia a orientação de Modo offline.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Instalação e push dependem do navegador. Não prometa que todas as operações do ERP funcionem offline.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/mobile com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/mobile$hlp$, NULL, $hlp$internal$hlp$, 144, 1, true),
($hlp$core$hlp$, $hlp$usar-o-onboarding-guiado-de-uma-entidade$hlp$, $hlp$Usar o onboarding guiado de uma entidade$hlp$, $hlp$Usar o onboarding guiado de uma entidade.$hlp$, $hlp$# Usar o onboarding guiado de uma entidade

**Para que serve:** Usar o onboarding guiado de uma entidade, no contexto da tela `/onboarding/$entity`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/onboarding/$entity`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o link de onboarding da entidade desejada.
2. Confira o modelo e as etapas carregadas pelo assistente.
3. Preencha os campos solicitados e avance pelas etapas disponíveis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O parâmetro $entity identifica a entidade; esta rota genérica não é o onboarding de pessoas do TechPeople. Etapas e tarefas dependem do modelo configurado.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /onboarding/$entity com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/onboarding/$entity$hlp$, NULL, $hlp$internal$hlp$, 107, 1, true),
($hlp$core$hlp$, $hlp$vincular-a-extensao-do-techhire$hlp$, $hlp$Vincular a extensão do TechHire$hlp$, $hlp$Vincular a extensão do TechHire.$hlp$, $hlp$# Vincular a extensão do TechHire

**Para que serve:** Vincular a extensão do TechHire, no contexto da tela `/auth/extension-link`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/auth/extension-link`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra a tela de vínculo a partir do fluxo da extensão.
2. Informe a URL do TechHire e a API key nos campos correspondentes.
3. Siga a ação de vínculo apresentada pela tela.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Trate a API key como segredo; não a inclua em chamados, capturas ou artigos. Esta conexão serve à extensão do TechHire, não cria um sétimo módulo.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /auth/extension-link com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/auth/extension-link$hlp$, NULL, $hlp$internal$hlp$, 100, 1, true),
($hlp$core$hlp$, $hlp$visao-geral$hlp$, $hlp$Visão geral de Core ERP e Configurações$hlp$, $hlp$Visão geral de Core ERP e Configurações.$hlp$, $hlp$# Visão geral de Core ERP e Configurações

Core não é um sétimo módulo vertical. Os seis módulos são TechSales (`crm`), TechHire (`ats`), TechPeople (`people`), TechContracts (`contracts`), TechProjects (`projects`) e TechFinance (`finance`). `services` é identificador legado de TechContracts.

A Ajuda interna usa `/ajuda`; `/kb` é outra base pública. Conteúdo com `audience=client` não oferece acesso externo nesta implementação.

## Mapa das telas
- `/auth/extension-link`: Vincular a extensão do TechHire
- `/catalog/contracting-presets`: Consultar presets e cargos de contratação
- `/catalog/services`: Manter o catálogo de serviços
- `/files`: Consultar e organizar arquivos
- `/home`: Consultar o dashboard do ERP
- `/home/print`: Preparar a impressão do dashboard
- `/modules`: Explorar os módulos do workspace
- `/onboarding/$entity`: Usar o onboarding guiado de uma entidade
- `/settings`: Atualizar o perfil da conta
- `/settings/access-policy`: Revisar a política de acesso
- `/settings/ads-sync`: Consultar conexões de anúncios
- `/settings/ai-panel`: Consultar o painel de IA
- `/settings/api-keys`: Gerenciar chaves de API
- `/settings/audit-export`: Revisar exportação de audit logs
- `/settings/audit-log`: Consultar o log de auditoria
- `/settings/billing`: Consultar planos e cobrança
- `/settings/branding`: Configurar a identidade visual
- `/settings/channels`: Administrar canais de atendimento
- `/settings/custom-objects`: Manter objetos personalizados
- `/settings/custom-properties`: Configurar propriedades personalizadas
- `/settings/data-residency`: Definir a preferência de região
- `/settings/exports`: Consultar exportações e relatórios
- `/settings/hubspot-users`: Revisar responsáveis importados do HubSpot
- `/settings/import`: Escolher uma origem de importação
- `/settings/import-csv`: Importar uma planilha CSV
- `/settings/integrations`: Consultar o catálogo de integrações
- `/settings/integrations/$slug`: Consultar o detalhe de uma integração
- `/settings/integrations/ai`: Configurar o provedor de IA do workspace
- `/settings/integrations/linkedin`: Revisar a conexão LinkedIn
- `/settings/language`: Escolher o idioma da interface
- `/settings/legal-entities`: Manter empresas e CNPJs do workspace
- `/settings/legal-entity-groups`: Manter grupos empresariais
- `/settings/marketplace`: Consultar o Marketplace
- `/settings/marketplace/$slug`: Consultar um aplicativo do Marketplace
- `/settings/media`: Consultar a biblioteca de mídia
- `/settings/mobile`: Usar instalação PWA e notificações
- `/settings/my-permissions`: Consultar minhas permissões
- `/settings/my-tickets`: Acompanhar meus chamados de suporte
- `/settings/notifications`: Revisar preferências de notificações
- `/settings/notifications/slack`: Configurar notificações no Slack
- `/settings/onboarding-templates`: Manter modelos de onboarding por entidade
- `/settings/permissions`: Consultar e administrar permissões
- `/settings/phones`: Revisar país padrão e telefones legados
- `/settings/privacy`: Consultar privacidade e meus dados
- `/settings/property-groups`: Organizar grupos de propriedades
- `/settings/rbac-diagnostics`: Diagnosticar o acesso de um membro
- `/settings/record-layouts`: Revisar layouts de fichas
- `/settings/scim`: Gerar e revogar tokens SCIM
- `/settings/security`: Revisar a segurança da minha conta
- `/settings/snippets`: Manter respostas prontas
- `/settings/sso`: Consultar orientações de SSO
- `/settings/subscriptions`: Manter tipos de assinatura de comunicação
- `/settings/teams`: Administrar membros do workspace
- `/settings/user-groups`: Organizar times do workspace
- `/settings/webhooks`: Manter webhooks de integração
- `/settings/whatsapp`: Consultar a conexão do WhatsApp
- `/settings/widget`: Revisar o widget do site
- `/settings/workflow-subscriptions`: Consultar assinaturas de workflow
- `/settings/zapier`: Consultar a configuração do Zapier
- `/workspace/modules`: Revisar módulos do workspace
- `/accept-invite`: Aceitar um convite recebido
- `/accept-invite/$token`: Aceitar convite com token
- `/dpa`: Consultar o acordo de processamento de dados
- `/kb`: Consultar a base de conhecimento pública
- `/kb/$slug`: Ler um artigo da base pública
- `/login`: Entrar na conta
- `/privacy`: Consultar a política de privacidade
- `/refund`: Consultar a política de reembolso
- `/reset-password`: Recuperar a senha da conta
- `/sales`: Consultar a apresentação comercial
- `/signup`: Entender o acesso por convite
- `/terms`: Consultar os termos de serviço
- `/unipile-connected`: Concluir o retorno de conexão Unipile
- `/unsubscribe`: Consultar o cancelamento de comunicações
- `/widget/$workspaceId`: Abrir o widget público de atendimento

## Relacionados
- [Visão geral](/ajuda/core/visao-geral)
- [Permissões](/ajuda/core/permissoes)$hlp$, $hlp$overview$hlp$, NULL, NULL, $hlp$internal$hlp$, 122, 1, true)
ON CONFLICT (module_key, slug) DO NOTHING;
INSERT INTO public.help_articles
  (module_key, slug, title, summary, body_md, article_type, route_pattern, min_permission, audience, sort_order, version, is_published)
VALUES
($hlp$platform$hlp$, $hlp$administrar-sandboxes-da-plataforma$hlp$, $hlp$Administrar sandboxes da plataforma$hlp$, $hlp$Administrar sandboxes da plataforma.$hlp$, $hlp$# Administrar sandboxes da plataforma

**Para que serve:** Administrar sandboxes da plataforma, no contexto da tela `/settings/platform/sandbox`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/settings/platform/sandbox`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Sandbox.
2. Clique Novo sandbox.
3. Selecione Workspace de origem e informe Nome do sandbox.
4. Revise o resultado e as ações de ciclo de vida disponíveis na lista.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Exclusivo de admin da plataforma. Não presuma anonimização, isolamento integral de integrações ou cópia completa de todos os dados; confirme antes de usar dados reais.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /settings/platform/sandbox com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/platform/sandbox$hlp$, NULL, $hlp$internal$hlp$, 186, 1, true),
($hlp$platform$hlp$, $hlp$administrar-workspaces-da-plataforma$hlp$, $hlp$Administrar workspaces da plataforma$hlp$, $hlp$Administrar workspaces da plataforma.$hlp$, $hlp$# Administrar workspaces da plataforma

**Para que serve:** Administrar workspaces da plataforma, no contexto da tela `/admin/workspaces`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/admin/workspaces`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Super-admin.
2. Filtre por Ativos, Suspensos, Lixeira ou Todos.
3. Abra um workspace para conferir seus dados e membros.
4. Para criar workspace ou convidar membro, revise os campos e o papel antes de confirmar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Exclusivo de admin da plataforma; owner/admin de workspace não é super-admin. Ações de ciclo de vida exigem revisão do diálogo de confirmação.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /admin/workspaces com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/admin/workspaces$hlp$, NULL, $hlp$internal$hlp$, 182, 1, true),
($hlp$platform$hlp$, $hlp$campos-e-status$hlp$, $hlp$Campos e estados de Administração da plataforma$hlp$, $hlp$Campos e estados de Administração da plataforma.$hlp$, $hlp$# Campos e estados de Administração da plataforma

Workspaces são apresentados pelos filtros Ativos, Suspensos, Lixeira e Todos. São filtros da interface, não uma afirmação de enum único no banco. Quotas mostram Emails, WhatsApp, API e IA; seus limites no componente são referências de exibição. Status agrega indicadores e crons, com atualização periódica.

## Relacionados
- [Visão geral](/ajuda/platform/visao-geral)
- [Permissões](/ajuda/platform/permissoes)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 130, 1, true),
($hlp$platform$hlp$, $hlp$consultar-e-configurar-alertas-da-plataforma$hlp$, $hlp$Consultar e configurar alertas da plataforma$hlp$, $hlp$Consultar e configurar alertas da plataforma.$hlp$, $hlp$# Consultar e configurar alertas da plataforma

**Para que serve:** Consultar e configurar alertas da plataforma, no contexto da tela `/settings/platform/alerts`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/settings/platform/alerts`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Alertas.
2. Consulte alertas e regras disponíveis.
3. Revise os critérios antes de salvar uma regra ou executar uma ação de tratamento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Exclusivo de admin da plataforma. A existência de regra não garante entrega externa de aviso.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /settings/platform/alerts com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/platform/alerts$hlp$, NULL, $hlp$internal$hlp$, 184, 1, true),
($hlp$platform$hlp$, $hlp$consultar-quotas-por-workspace$hlp$, $hlp$Consultar quotas por workspace$hlp$, $hlp$Consultar quotas por workspace.$hlp$, $hlp$# Consultar quotas por workspace

**Para que serve:** Consultar quotas por workspace, no contexto da tela `/settings/platform/quotas`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/settings/platform/quotas`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Quotas.
2. Localize o workspace e confira o Plano.
3. Compare os contadores de Emails, WhatsApp, API e IA.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Limites PLAN_LIMITS são referências display-only por plano. O texto de alerta em 80% e as cores não provam bloqueio de uso ou regra contratual de cobrança.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /settings/platform/quotas com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/platform/quotas$hlp$, NULL, $hlp$internal$hlp$, 185, 1, true),
($hlp$platform$hlp$, $hlp$consultar-status-e-manutencao-da-plataforma$hlp$, $hlp$Consultar status e manutenção da plataforma$hlp$, $hlp$Consultar status e manutenção da plataforma.$hlp$, $hlp$# Consultar status e manutenção da plataforma

**Para que serve:** Consultar status e manutenção da plataforma, no contexto da tela `/settings/platform/status`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/settings/platform/status`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Status.
2. Revise os indicadores de workspace, integrações e crons.
3. Use Reagendar crons apenas após avaliar o estado dos jobs.
4. Execute Backfill de qualificações na timeline somente para o caso descrito na tela.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Atualização de consulta a cada 30 segundos. O backfill cria atividade Pesquisa para qualificações históricas e é apresentado como idempotente; não é manutenção genérica dos seis módulos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /settings/platform/status com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/platform/status$hlp$, NULL, $hlp$internal$hlp$, 188, 1, true),
($hlp$platform$hlp$, $hlp$consultar-varreduras-de-seguranca$hlp$, $hlp$Consultar varreduras de segurança$hlp$, $hlp$Consultar varreduras de segurança.$hlp$, $hlp$# Consultar varreduras de segurança

**Para que serve:** Consultar varreduras de segurança, no contexto da tela `/settings/platform/security`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/settings/platform/security`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Segurança.
2. Consulte as varreduras e resultados disponíveis.
3. Use a ação habilitada para nova verificação quando necessário.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Exclusivo de admin da plataforma. Um resultado de varredura não certifica ausência de vulnerabilidades ou conformidade integral.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /settings/platform/security com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/settings/platform/security$hlp$, NULL, $hlp$internal$hlp$, 187, 1, true),
($hlp$platform$hlp$, $hlp$erros-comuns$hlp$, $hlp$Erros comuns em Administração da plataforma$hlp$, $hlp$Erros comuns em Administração da plataforma.$hlp$, $hlp$# Erros comuns em Administração da plataforma

## Não encontro a tela
Confira o workspace, o módulo, a licença e a permissão. Um item ausente pode ser subtela ou acesso por link, não um defeito.

## A tela abre mas não consigo alterar
Consulta e gerenciamento são ações diferentes. Verifique a permissão da ação, sem tentar contornar controles.

## Integração salva mas sem resultado externo
Confira conexão, ambiente, provedor e mensagem retornada. Salvar não comprova sincronização ou entrega.

## Link indisponível
Peça revisão ao responsável pelo link original; não compartilhe tokens nem teste identificadores alheios.

## Relacionados
- [Visão geral](/ajuda/platform/visao-geral)
- [Permissões](/ajuda/platform/permissoes)$hlp$, $hlp$troubleshooting$hlp$, NULL, NULL, $hlp$internal$hlp$, 132, 1, true),
($hlp$platform$hlp$, $hlp$perguntas-frequentes$hlp$, $hlp$Perguntas frequentes de Administração da plataforma$hlp$, $hlp$Perguntas frequentes de Administração da plataforma.$hlp$, $hlp$# Perguntas frequentes de Administração da plataforma

## Configurações pertencem todas ao Core?
Não. NFS-e e pagamentos são financeiros; assinatura eletrônica é TechContracts; scoring e metas são TechSales.

## Core é um módulo vertical?
Não. Ele reúne recursos compartilhados.

## Admin do workspace acessa a plataforma?
Não por esse papel; plataforma tem validação própria.

## A Ajuda fica disponível para clientes?
Não. Esta entrega usa `audience=internal`; `/kb` é uma base diferente.

## Uma configuração salva garante o resultado externo?
Não; verifique conexão e execução no provedor.

## Relacionados
- [Visão geral](/ajuda/platform/visao-geral)
- [Permissões](/ajuda/platform/permissoes)$hlp$, $hlp$faq$hlp$, NULL, NULL, $hlp$internal$hlp$, 133, 1, true),
($hlp$platform$hlp$, $hlp$permissoes$hlp$, $hlp$Permissões de Administração da plataforma$hlp$, $hlp$Permissões de Administração da plataforma.$hlp$, $hlp$# Permissões de Administração da plataforma

Somente admin da plataforma. Owner/admin de workspace não equivale a platform admin. As telas consultam `useIsPlatformAdmin`; funções de plataforma verificam o cadastro `platform_admins`. Não substitua isso por uma chave system inventada. A Ajuda distingue o módulo `platform` do Core.

## Relacionados
- [Visão geral](/ajuda/platform/visao-geral)
- [Permissões](/ajuda/platform/permissoes)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 131, 1, true),
($hlp$platform$hlp$, $hlp$primeiros-15-minutos$hlp$, $hlp$Primeiros 15 minutos em Administração da plataforma$hlp$, $hlp$Primeiros 15 minutos em Administração da plataforma.$hlp$, $hlp$# Primeiros 15 minutos em Administração da plataforma

1. Confirme a conta e o workspace.
2. Abra `/admin/workspaces`.
3. Consulte seu acesso antes de alterar configurações.
4. Localize a tela na lista abaixo.
5. Abra seu guia e revise regras e limites antes de agir.

- `/admin/bug-reports`: Tratar chamados da plataforma
- `/admin/workspaces`: Administrar workspaces da plataforma
- `/admin/workspaces/$id`: Revisar um workspace e seus membros
- `/settings/platform/alerts`: Consultar e configurar alertas da plataforma
- `/settings/platform/quotas`: Consultar quotas por workspace
- `/settings/platform/sandbox`: Administrar sandboxes da plataforma
- `/settings/platform/security`: Consultar varreduras de segurança
- `/settings/platform/status`: Consultar status e manutenção da plataforma

## Relacionados
- [Visão geral](/ajuda/platform/visao-geral)
- [Permissões](/ajuda/platform/permissoes)$hlp$, $hlp$quickstart$hlp$, NULL, NULL, $hlp$internal$hlp$, 129, 1, true),
($hlp$platform$hlp$, $hlp$revisar-um-workspace-e-seus-membros$hlp$, $hlp$Revisar um workspace e seus membros$hlp$, $hlp$Revisar um workspace e seus membros.$hlp$, $hlp$# Revisar um workspace e seus membros

**Para que serve:** Revisar um workspace e seus membros, no contexto da tela `/admin/workspaces/$id`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/admin/workspaces/$id`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o workspace pela lista Super-admin.
2. Confira os dados do workspace e os Membros.
3. Revise Nome, Email, Telefone e Papel ao preparar um convite.
4. Para ações de ciclo de vida, leia o diálogo e confirme o workspace alvo.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Suspensão e exclusão podem afetar todo o workspace. Não descreva exclusão como reversível sem conferir o estado e a operação específica.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /admin/workspaces/$id com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/admin/workspaces/$id$hlp$, NULL, $hlp$internal$hlp$, 183, 1, true),
($hlp$platform$hlp$, $hlp$tratar-chamados-da-plataforma$hlp$, $hlp$Tratar chamados da plataforma$hlp$, $hlp$Tratar chamados da plataforma.$hlp$, $hlp$# Tratar chamados da plataforma

**Para que serve:** Tratar chamados da plataforma, no contexto da tela `/admin/bug-reports`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/admin/bug-reports`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Chamados.
2. Consulte os chamados em lista ou quadro.
3. Abra o registro, revise o diagnóstico e use o diálogo de resolução quando apropriado.
4. Revise cuidadosamente qualquer ação em massa ou exclusão.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Exclusivo de admin da plataforma. A análise por IA auxilia a triagem, não comprova correção publicada.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /admin/bug-reports com dados fictícios, ocultando tokens, segredos e dados pessoais. -->$hlp$, $hlp$howto$hlp$, $hlp$/admin/bug-reports$hlp$, NULL, $hlp$internal$hlp$, 181, 1, true),
($hlp$platform$hlp$, $hlp$visao-geral$hlp$, $hlp$Visão geral de Administração da plataforma$hlp$, $hlp$Visão geral de Administração da plataforma.$hlp$, $hlp$# Visão geral de Administração da plataforma

Core não é um sétimo módulo vertical. Os seis módulos são TechSales (`crm`), TechHire (`ats`), TechPeople (`people`), TechContracts (`contracts`), TechProjects (`projects`) e TechFinance (`finance`). `services` é identificador legado de TechContracts.

A Ajuda interna usa `/ajuda`; `/kb` é outra base pública. Conteúdo com `audience=client` não oferece acesso externo nesta implementação.

## Mapa das telas
- `/admin/bug-reports`: Tratar chamados da plataforma
- `/admin/workspaces`: Administrar workspaces da plataforma
- `/admin/workspaces/$id`: Revisar um workspace e seus membros
- `/settings/platform/alerts`: Consultar e configurar alertas da plataforma
- `/settings/platform/quotas`: Consultar quotas por workspace
- `/settings/platform/sandbox`: Administrar sandboxes da plataforma
- `/settings/platform/security`: Consultar varreduras de segurança
- `/settings/platform/status`: Consultar status e manutenção da plataforma

## Relacionados
- [Visão geral](/ajuda/platform/visao-geral)
- [Permissões](/ajuda/platform/permissoes)$hlp$, $hlp$overview$hlp$, NULL, NULL, $hlp$internal$hlp$, 128, 1, true)
ON CONFLICT (module_key, slug) DO NOTHING;
