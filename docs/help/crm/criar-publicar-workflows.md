---
module_key: crm
slug: criar-publicar-workflows
title: Criar e publicar workflows
summary: Salve um rascunho, publique uma versão e acompanhe execuções de automações.
article_type: howto
route_pattern: /settings/workflows
min_permission: system.workflows.manage.workspace
audience: internal
sort_order: 413
version: 10
is_published: true
---

# Criar e publicar workflows

**Para que serve:** Configurar automações, separando o rascunho da versão publicada.
**Quem pode fazer:** Membro ativo autorizado a criar ou editar workflows no workspace. Cada ação continua exigindo suas permissões; escolher um destinatário não concede acesso ao registro nem permissão para aprovar.
**Onde fica:** Menu > TechSales > Otimizar > Workflows (`/settings/workflows`).
**Antes de começar:** Defina o gatilho e as ações. Se houver distribuição, crie a regra antes.

## Passo a passo

1. Abra a aba "Workflows".
2. Crie ou abra um workflow. O editor mostra "Novo workflow" ou "Editar workflow"; preencha o nome.
3. Configure o gatilho e as etapas.
4. Salve o rascunho.
5. Clique em "Salvar rascunho" para guardar sem ativar, ou em "Salvar e publicar".
6. Abra "Execuções recentes" para carregar o histórico, independente da lista de workflows.
7. Abra "Política de envio" para revisar regras de envio.
8. Em decisão pendente, preencha "Comentário da decisão (opcional)" e aprove ou rejeite.
   ![Tela: abas Workflows, Execuções recentes e Política de envio](/help-media/crm/criar-publicar-workflows.webp)

### Configurar quem recebe uma notificação

1. Adicione ou abra o passo **Enviar notificação**.
2. Preencha **Título** e, se necessário, **Corpo (opcional)**. Evite informações sensíveis. Quando houver variáveis, o aviso será convertido em uma mensagem neutra; consulte os detalhes no TechERP. O conteúdo privado da execução não será reproduzido para o destinatário.
3. Em **Quem recebe o aviso**, escolha uma regra:
   - **Executor do workflow:** usuário definido para executar a automação. Não significa necessariamente a pessoa que abriu o editor.
   - **Membro específico:** escolha uma pessoa pelo nome na lista de membros disponíveis.
   - **Responsável pelo registro** ou **Criador do registro:** o vínculo atual é resolvido na origem, durante a execução.
   - Em Pessoas, **Gestor da pessoa**; em Negócios, **Líder da equipe do negócio**; em Vagas, **Gestor da área de recrutamento**.
   - Em Contratos, **Aprovadores da etapa atual**.
   - Em Projetos, tarefas ou marcos de projeto, **Membros do projeto**.
4. Use **Adicionar destinatário** para combinar regras, até o limite de dez. A mesma pessoa recebe um único aviso por ocorrência, mesmo quando atende a mais de uma regra.
5. Para retirar uma regra, use o botão de remover correspondente. Mantenha pelo menos uma.
6. Salve o rascunho e revise antes de publicar a versão, conforme as permissões do workspace.

Somente membros ativos do mesmo workspace e com leitura atual do registro podem receber. Se faltar um responsável, a alçada estiver ausente ou o líder da equipe for ambíguo, o sistema não escolhe outro membro nem encaminha automaticamente ao CEO. Consulte o resultado em **Execuções recentes** e regularize os vínculos com a pessoa autorizada.

Destinos avançados que já estejam salvos, como equipe, cargo ou seguidores, são preservados para revisão. Este formulário ainda não oferece sua configuração completa. Um destino preservado só recebe quando existe uma fonte válida e a autorização é confirmada; seguidores sem uma fonte disponível não recebem avisos.

### Usar um evento comercial, contratual ou de projeto

1. Em **Central de notificações > Regras**, escolha **Evento da nova regra**. Há opções de TechSales — negócio ganho, perdido, outras mudanças de etapa e proposta aceita —, TechContracts — minuta aceita, assinatura concluída, vencimento e prazo de renovação — e TechProjects — projeto iniciado ou atrasado, tarefa atrasada e marco próximo do prazo. Clique em **Criar regra**.
2. O Workflow abre como rascunho desativado no construtor habitual, com um passo de notificação ao responsável pelo registro. Confira a responsabilidade; a seleção não grava, publica ou envia automaticamente.
3. Em **Gatilho de entrada > Evento de negócio**, confira a opção. O editor oferece apenas os eventos compatíveis com o tipo de objeto. A minuta aceita usa o negócio vinculado como contexto; isso não dispensa as permissões da minuta. Alterar o tipo de objeto remove uma seleção que ficou incompatível.
4. Nos eventos de proximidade (contratos e marcos), ajuste **Antecedência em dias**, de 1 a 365. O valor inicial do rascunho é 30. Vencimento usa o término da vigência; renovação usa o término menos o aviso prévio cadastrado e exige renovação automática. A janela termina no prazo; contratos com prazo já vencido ou dados inválidos não entram. No marco, a janela usa seu prazo e exige Pendente ou Em andamento, sem conclusão registrada.
5. Configure as condições e os passos, salve e revise antes de publicar e ativar. O evento de negócio e o gatilho genérico baseado em tempo são escolhas distintas; o editor não combina os dois.

Entrar em ganho ou perda gera a classificação específica da transição. **Etapa do negócio alterada** acompanha as demais mudanças, incluindo reabertura; não é emitida como um segundo evento implícito para a mesma entrada em ganho/perda. Várias regras publicadas continuam sendo escolhas administrativas explícitas: revise-as para não configurar avisos repetidos com o mesmo objetivo.

**Proposta aceita** exige aceite comercial válido; **Assinatura concluída** exige a evidência válida da versão atual. Um status genérico, contrato Ativo ou data preenchida não substituem essas provas. O preset antigo **Contrato assinado**, quando existente, mantém seu contrato anterior e não é reescrito ao abrir o editor.

**Projeto iniciado** exige a transição Planejamento → Ativo; não inclui criação/importação já ativa, retomada Em espera ou edição da data de início. **Projeto atrasado** exige Planejamento ou Ativo; **Tarefa de projeto atrasada** exige tarefa aberta e projeto em Planejamento, Ativo ou Em espera. O atraso começa no dia civil seguinte ao prazo em São Paulo, sem campo de antecedência ou lembrete diário. Cada origem/prazo gera uma ocorrência por regra, somente para vencimentos após a publicação; verificações posteriores recuperam os elegíveis. Republicar ou restaurar um prazo já processado não repete o aviso desse prazo.

**Marco próximo do prazo** usa a antecedência configurável, inicialmente 30 dias, com projeto em Planejamento, Ativo ou Em espera. Não conclui o marco nem gera cobrança. Projetos concluídos/cancelados e prazos ausentes não recebem substitutos inventados. Os quatro eventos não alteram o agendador opt-in de alertas do Dashboard.

Preferências pessoais por evento podem suprimir o aviso sem alterar a operação. Para os novos eventos, som e tremor começam desligados e só são habilitados por escolha explícita no grupo ou evento do workspace. Os canais externos continuam dependendo de configuração e autorização próprias.

## Resultado esperado

"Rascunho salvo — publique para ativar"; "Publicado — v…"; "Aprovado — retomada enfileirada".

## Regras e limites

Salvar não é publicar. Aprovar ou rejeitar muda o andamento da execução.

- Abrir um fluxo antigo não regrava seus destinatários. O membro específico já salvo continua sendo considerado; na ausência de seleção, o padrão legado é o executor do workflow.
- Resolver um destinatário não transfere responsabilidade, concede acesso, altera alçada ou aprova o registro. Ler o aviso também não conclui a tarefa.
- Sem escolha explícita de canais, **Enviar notificação** mantém o aviso no aplicativo. A opção de entrega permite No app, e-mail e WhatsApp conforme a política do workspace. WhatsApp exige número Cloud API e modelo neutro aprovado, consentimento pessoal e limites. O fallback de e-mail só se aplica quando selecionado e permitido; resultado incerto não dispara alternativa. Consulte [Usar a central de notificações](/ajuda/core/usar-central-de-notificacoes).
- Desativar **No app** no grupo **Workflows**, nas preferências pessoais, suprime novos avisos desse passo. O histórico já gravado permanece disponível.
- Uma linha visível pode conter campos privados. O aviso não reproduz variáveis do contexto da execução. Títulos e corpos estáticos são mantidos; não escreva valores, documentos pessoais ou outros dados sensíveis diretamente nesses textos.
- Nem toda origem possui ficha própria. Alguns avisos podem abrir a lista do módulo ou a ficha associada; pode ser necessário escolher uma aba ou localizar o item. Sem rota interna comprovada, o aviso pode permanecer sem link. Isso não concede acesso adicional nem cria uma nova tela.

## Erros comuns

- "Erro ao salvar": revise o rascunho.
- "Erro ao publicar": confira a configuração.
- "Erro no teste": revise o registro de teste.
- "Erro ao remover": confira sua autorização.
- "Não foi possível carregar os workflows": clique em "Tentar novamente"; a falha não significa que não existem automações.
- "Não foi possível carregar as execuções recentes": tente novamente nessa aba. A lista e a edição dos workflows continuam disponíveis.
- "Estatísticas indisponíveis": os totais de 24 horas não puderam ser consultados; não são apresentados como zero.
- **Notificação bloqueada: não há destinatário elegível:** confira responsável, criador, equipe, gestor ou aprovador da origem. A pessoa precisa estar ativa no workspace e ter leitura atual do registro; o sistema não cria um destinatário alternativo.
- **Nenhum membro disponível para seleção:** aguarde o carregamento ou confira os membros com quem administra o workspace. Não é necessário digitar UUID.
- **O aviso não chegou:** confira o resultado da execução e **No app** no grupo **Workflows**. A preferência pode suprimir o novo aviso sem retirar os anteriores.
- **O título ficou neutro:** há variáveis no título ou no corpo. Consulte os detalhes no TechERP, pelo destino disponível para a origem; essa proteção evita reproduzir dados privados para outro usuário.
- **O evento não aparece para o objeto escolhido:** confira o tipo de objeto em Gatilho de entrada. Apenas eventos com uma origem compatível são oferecidos; os eventos de outros módulos ainda planejados não ficam disponíveis por esta configuração.
- **O aviso de vencimento ou renovação não entrou:** confira a antecedência, a vigência, o aviso prévio e a renovação automática. Prazo vencido, ausente ou inválido não é substituído por uma data inventada.

## Relacionados

- [Criar regras de distribuição](/ajuda/crm/criar-regras-de-distribuicao)
- [Erros comuns](/ajuda/crm/erros-comuns)
- [Revisar preferências de notificações](/ajuda/core/revisar-preferencias-de-notificacoes)

### Usar eventos de recrutamento e pessoas

O seletor também agrupa os três eventos de **TechHire** e os três de **TechPeople**. A seleção continua sendo somente um rascunho desativado. Inscrição exige registro real; entrevista exige agendamento confirmado futuro; oferta aceita exige assinatura válida da versão enviada. **Início de vínculo autorizado** representa admissão confirmada ou início direto governado, inclusive com data futura, sem afirmar dia trabalhado ou conceder acesso.

**Documento próximo do vencimento** usa validade civil em São Paulo e antecedência editável de 1 a 365 dias, inicialmente 30; a janela inclui o prazo e exclui vencidos. **Ofertas**, **Documentos de pessoas** e **Solicitações profissionais da preparação** são origens somente para leitura no Workflow. Exigem um evento compatível e não oferecem criação, alteração, exclusão ou gatilho genérico de tempo sobre essas origens.

Para **Aprovação de solicitação profissional pendente**, **Quem recebe o aviso** permite somente **Aprovador nomeado da etapa vigente**. O texto canônico do processo é preservado e não há destinatário arbitrário. Trata somente da preparação profissional, sem vagas ou fornecedores. O aviso obrigatório no aplicativo já existe independentemente da regra; a regra reaproveita esse aviso e pode acrescentar canais explícitos para o mesmo aprovador vigente, sem duplicar ou aprovar. Desligar a regra ou a preferência nova não remove o aviso obrigatório do processo.

Os avisos usam texto neutro. Não escreva salário, condições privadas, número de documento, currículo ou link público nos textos. O destino abre o registro e a aba exatos após conferir acesso atual, sem ações pela URL.

### Usar eventos financeiros

O seletor **Evento da nova regra** também agrupa as cinco opções de **TechFinance**. Os avisos de contas do dia usam vencimento igual a hoje em São Paulo e saldo real em aberto; os vencidos começam no dia seguinte, sem antecedência configurável ou lembrete diário. Publicar durante o dia pode avisar o vencimento daquele dia uma vez. Atrasos anteriores à publicação não entram; os posteriores podem ser recuperados pelo processamento.

**NF de contratação recebida** trata somente de NF-e/NFS-e registrada canonicamente na contratação profissional/fornecedor, não de emissão, fatura de cliente, RPA ou folha. Registro não é conferência, aceite nem pagamento. A origem fiscal é somente leitura. O rascunho começa com **Executor do workflow**, editável; o executor também precisa de acesso fiscal atual. O responsável Financeiro é resolvido da formalização vigente, sem CEO/fallback, e o remetente da nota só recebe por seleção explícita.

As condições e variáveis dos cinco eventos oferecem somente identificadores, estados e datas públicos dessa ocorrência. Valores, saldo, notas, CNPJ, dados bancários, arquivos e associações privadas não são oferecidos. A biblioteca omite as mutações genéricas de origem/tabelas financeiras; um rascunho incompatível é preservado e exige revisão antes de salvar. Workflows genéricos antigos mantêm suas opções anteriores. Nada é publicado ou ativado pela seleção e nenhuma baixa, emissão ou conciliação decorre da leitura do aviso.
