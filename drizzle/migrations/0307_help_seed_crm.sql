COMMENT ON TABLE public.help_articles IS 'Artigos da Área de Ajuda; conteúdo versionado em docs/help/<módulo>/<slug>.md e gravado por migrations de seed idempotentes.';
-- Seed idempotente dos artigos do TechSales (gerado por: bun scripts/help-seed-sql.ts crm).
INSERT INTO public.help_articles
  (module_key, slug, title, summary, body_md, article_type, route_pattern, min_permission, audience, sort_order, version, is_published)
VALUES
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
ON CONFLICT (module_key, slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, body_md = EXCLUDED.body_md,
  article_type = EXCLUDED.article_type, route_pattern = EXCLUDED.route_pattern,
  min_permission = EXCLUDED.min_permission, audience = EXCLUDED.audience,
  sort_order = EXCLUDED.sort_order, version = EXCLUDED.version, is_published = EXCLUDED.is_published
WHERE public.help_articles.version < EXCLUDED.version
   OR public.help_articles.body_md IS DISTINCT FROM EXCLUDED.body_md;

-- Seed idempotente dos artigos do TechHire (gerado por: bun scripts/help-seed-sql.ts ats).
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
- Hoje os sites estão em modo simulado: nada é publicado de fato.
- Mostra até 200 publicações.

## Erros comuns
- "Registro indisponível ou sem permissão para esta ação.": peça acesso.

## Relacionados
- [Gerenciar vagas](/ajuda/ats/gerenciar-vagas)$hlp$, $hlp$howto$hlp$, $hlp$/sourcing/multi-posting$hlp$, $hlp$techhire.jobs.view.own$hlp$, $hlp$internal$hlp$, 66, 1, true),
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

**O multi-posting já publica nos sites?** Ainda não. Os sites estão em modo simulado.

**Anonimizar pode ser desfeito?** Não.

## Relacionados

- [Visão geral](/ajuda/ats/visao-geral)$hlp$, $hlp$faq$hlp$, NULL, NULL, $hlp$internal$hlp$, 6, 1, true),
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
ON CONFLICT (module_key, slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, body_md = EXCLUDED.body_md,
  article_type = EXCLUDED.article_type, route_pattern = EXCLUDED.route_pattern,
  min_permission = EXCLUDED.min_permission, audience = EXCLUDED.audience,
  sort_order = EXCLUDED.sort_order, version = EXCLUDED.version, is_published = EXCLUDED.is_published
WHERE public.help_articles.version < EXCLUDED.version
   OR public.help_articles.body_md IS DISTINCT FROM EXCLUDED.body_md;

-- TechPeople
INSERT INTO public.help_articles
  (module_key, slug, title, summary, body_md, article_type, route_pattern, min_permission, audience, sort_order, version, is_published)
VALUES
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

## Erros comuns
- "Não foi possível carregar o dashboard": clique em "Tentar novamente".

## Relacionados
- [Visão geral](/ajuda/people/visao-geral)$hlp$, $hlp$howto$hlp$, $hlp$/people/dashboard$hlp$, NULL, $hlp$internal$hlp$, 5, 1, true),
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
ON CONFLICT (module_key, slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, body_md = EXCLUDED.body_md,
  article_type = EXCLUDED.article_type, route_pattern = EXCLUDED.route_pattern,
  min_permission = EXCLUDED.min_permission, audience = EXCLUDED.audience,
  sort_order = EXCLUDED.sort_order, version = EXCLUDED.version, is_published = EXCLUDED.is_published
WHERE public.help_articles.version < EXCLUDED.version
   OR public.help_articles.body_md IS DISTINCT FROM EXCLUDED.body_md;
