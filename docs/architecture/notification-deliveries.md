# NOTIFICA-CENTRAL — pacote 4: entregas controladas

Implementação local sobre 39e47a794. Migração aditiva 0393 depende de 0391 e 0392; nenhuma migração histórica é alterada. Não aplicada a produção. Nenhum canal é habilitado nem permissão concedida a cargos automaticamente.

## Motor e compatibilidade

Regras são os próprios Workflows com ação send_notification, incluindo ramificações aninhadas. O editor canônico mantém rascunho/publicação e alçadas. A ação pode receber delivery {channels:[inapp,email,whatsapp],fallback:none|email}. Sem delivery usa a RPC legada e continua inapp-only. A RPC v2 resolve os destinatários e cria intenções/entregas atomicamente, sem passar IDs para inserts privilegiados em TypeScript. A P4 conectou somente legacy.workflow; a P8 acrescenta os oito eventos comprovados de TechSales e TechContracts descritos abaixo. A disponibilidade no catálogo não habilita regras ou canais.

O drain usa o workflows-tick existente, protegido por CRON_SECRET, com limite de 20 jobs. Sem segundo scheduler. A P6 integrou o Slack coletivo ao ledger com seu próprio subtipo protegido; ele não representa entrega pessoal nem segue consentimento individual. Na entrega P4 e na integração P6, os resumos diário/semanal eram somente agrupamento visual da central. A P12 acrescentou adesão pessoal separada ao digest externo, sem converter o agrupamento visual em opt-in.

## Autorização

- APIs interativas exigem sessão, ator, membership ativo e workspace selecionado coincidente com o enviado. SQL revalida todos.
- Configuração exige system.notification_settings.view/manage.workspace; visão de entregas do workspace exige system.notification_deliveries.view.workspace. Sem grants automáticos.
- Alterar WhatsApp exige também system.whatsapp.manage.workspace e system.channels.view.workspace. Consultar remetentes/modelos exige view do canal e da configuração. Política de e-mail pode mudar sem alterar os campos WhatsApp já salvos.
- Regras usam permissões e acesso ao registro de system.workflows, não um recurso paralelo.
- Histórico pessoal exige própria identidade e leitura atual da origem; workspace history exige a chave adicional e mantém a leitura da origem. Destinos completos e erros brutos não são expostos.
- Consentimento e telefone são pessoais, com compare-and-set. Alterar o próprio profiles.phone revoga as autorizações antigas desse usuário nos seus workspaces. O opt-in vincula usuário/workspace/telefone/finalidade/versão; não comprova posse via SMS.
- Serviço prova workflow/run/event/version/source, permissões atuais do executor para view/create do transporte e acesso atual do destinatário à origem. Não concede acesso ao destinatário nem exige acesso dele à administração do canal.

## Ledger, falhas e concorrência

workflow_deliveries é reutilizado com subtipo privado notification_delivery_intents. Funções antigas não concluem nem reivindicam esse subtipo. Cada ocorrência/destinatário/canal é única. Tentativas têm token de lease; claim e preflight verificam estado, versão, membership, origem, preferências, consentimento, remetente, cota e orçamento. O último preflight ocorre depois dos GETs do provedor, imediatamente antes do POST. Mudanças de destino/configuração não redirecionam uma tentativa já iniciada.

Contadores de cota/orçamento usam reserva do envio, inclusive backlog antigo, com serialização por workspace. Custos são estimativas locais e não consulta tarifária da Meta. Estado uncertain preserva reserva conservadora. Limites Meta/qualidade podem ser mais restritivos.

429 ou falha conhecida antes do POST admitem tentativa controlada com backoff e limite. Falha de rede, 408, 5xx, receipt ausente, perda de lease ou falha de persistência após aceitação ficam uncertain. Nunca há reenvio ou fallback cego. Fallback explícito WhatsApp→email é no máximo um job único, somente com falha definitiva/supressão elegível, revalidando todas as condições do e-mail. Sem alternância de números.

Aceitação pelo provedor não é entrega/leitura. Recibos WhatsApp usam o processamento assinado canônico e vinculam delivery/token/key/wamid/workspace/número/remetente/conversa; transições são monotônicas e não podem ser forjadas por cliente autenticado. E-mail gerenciado sem recibo termina accepted, provider_id nulo; UUID local não é comprovante do provedor.

## Conteúdo e provedores

E-mail usa auth.users.email confirmado e o modelo fixo notification-update. WhatsApp usa apenas conexão direta Cloud API, número explicitamente fixado, qualidade alta e modelo vivo APPROVED/UTILITY/idioma exato, conteúdo neutro compatível. Headers/footers/botão URL só nos formatos fixos permitidos pelo validador. Nenhum snapshot de atividade, RH, financeiro ou mensagem privada sai da origem. O link vem de origem canônica do servidor, não de variáveis do evento.

Novos canais começam desligados, cotas/orçamento zero. Opt-in não habilita envio por si. Modelos/regras continuam sujeitos à classificação, aprovação, cobrança e políticas Meta vigentes. Sem promessa de gratuidade na janela de atendimento ou risco zero de bloqueio.

## Verificação e limites do aceite

Vitest cobre adapters com injeção de dependências, worker, schemas e APIs. PostgreSQL/PostgREST descartáveis usam migrações reais, atores sintéticos e JWT assinado localmente; nenhum banco configurado ou credencial real é usado. Navegador local usa componentes reais com fixtures e tokens White Label. Este aceite não é piloto de produção nem comprovação de recibo real. Após autorização futura de publicação, serão necessários migrações em ordem, permissões revisadas, política/remetente/modelo/consentimentos e piloto real com destinatário autorizado.

## P8: ocorrências de TechSales e TechContracts

A migração 0397 adiciona produtores para ganho, perda, outras mudanças de etapa, aceite comercial de proposta, aceite do cliente da minuta, assinatura comprovada, fim de vigência próximo e prazo de aviso de renovação próximo. Não reinterpreta registros históricos nem usa `signed_at`, contrato ativo ou importação como evidência suficiente de assinatura.

O seletor `trigger.notification_event` usa uma das oito chaves e a entidade correspondente. Eventos de prazo exigem `days_before` explícito de 1 a 365 dias; a interface inicia o rascunho com 30. Não é permitido combinar esse seletor com `time_based`. Regras genéricas continuam com sua semântica anterior e não consomem as linhas especializadas. Regras especializadas operam no workspace e revalidam a permissão do executor para cada registro, sem depender de ele ser o proprietário comercial.

As ocorrências usam `workflow_events`, com evidência privada vinculada à origem e à transição real. A coluna pública de seleção não constitui prova. Retomadas após espera ou aprovação precisam manter o vínculo com a ocorrência, a execução e a versão originais. A RPC de serviço verifica esse vínculo antes da execução; os gateways de notificação o conferem novamente. Sessões autenticadas não podem produzir uma prova válida preenchendo um tipo, título, UUID ou payload.

As fronteiras derivam `eventKey` da prova privada e o transportam ao contexto privado da central e às intenções de entrega. `notifications.type` legado permanece compatível. Preferências, filtros e interrupções usam a identidade explícita, sem inferência por título ou link. Som e tremor dos eventos novos começam desligados e exigem uma escolha explícita nas preferências do workspace. O overlay de preferências do workspace aceita também WhatsApp por categoria/evento: ausência herda a autorização geral, false bloqueia o evento nesse canal e true não supera consentimento, regra ou política. O formato antigo de preferências do perfil e os quatro sinais do sino permanecem inalterados. Claim e preflight revalidam o bloqueio por evento antes de qualquer novo envio.

O tick temporal existente chama o produtor de prazos, limitado e reservado ao serviço. Fim de vigência usa a data de término; renovação usa a data de término menos a antecedência de aviso do contrato, somente quando a renovação automática e o prazo estiverem configurados. A ocorrência só entra na janela entre a antecedência da regra e o prazo: não há varredura retroativa de vencidos. O dia de referência usa America/Sao_Paulo, seguindo o calendário brasileiro da implementação; o fuso de silêncio pessoal não altera as datas do contrato. A central não renova nem encerra o contrato.

Criar uma regra não publica nem ativa o rascunho e não envia mensagens. As tarefas, decisões, encaminhamentos jurídicos/financeiros e assinaturas existentes permanecem sob seus gravadores e alçadas canônicos. Nenhum produtor novo cria uma segunda tarefa ou executa uma decisão em nome do destinatário.

## P9: ocorrências de TechProjects

A migração aditiva 0398 estende a mesma fila, provas privadas e ledger para quatro chaves: `projects.project.started`, `projects.project.overdue`, `projects.task.overdue` e `projects.milestone.due`. As oito chaves P8 e os 22 aliases legados permanecem; cadastro no catálogo não cria nem ativa regras, permissões ou canais. As preferências por evento e os controles de e-mail, WhatsApp oficial e Slack continuam nos gateways existentes.

Início significa a transição real `planning`→`active`. `starts_at` é uma data prevista e não inicia o projeto; inserir/importar um registro ativo, editar o nome ou retomar `on_hold` não produz esse evento. Se o projeto deixar de estar ativo antes da execução, a ocorrência pendente não autoriza novos efeitos.

Os campos de prazo são `due_at`, do tipo DATE. Atraso começa no dia civil seguinte em America/Sao_Paulo. Projetos atrasados devem estar em Planejamento ou Ativo. Tarefas abertas (`todo`, `doing`, `review`) podem pertencer a projetos em Planejamento, Ativo ou Em espera, em acordo com o painel existente. Se a tarefa possui situação personalizada, ela também precisa de categoria aberta e vínculo exato à lista e workspace; situação concluída, órfã ou inconsistente não fica elegível por seu rótulo. Marcos exigem `pending`/`in_progress`, `completed_at` nulo e pai não encerrado no mesmo workspace.

A configuração de atraso aceita somente a chave do evento. Não há `days_after`, repetição diária ou escalonamento automático. O instante em que o prazo passou a estar atrasado deve ser posterior ou igual à publicação atual; atrasos que já existiam antes dela não entram. Um processamento posterior pode recuperar prazos que ficaram atrasados depois da publicação. Para marco próximo do prazo, `days_before` é obrigatório entre 1 e 365, com 30 dias iniciais editáveis; a janela inclui o dia do prazo e não inclui marcos já vencidos.

O cursor privado usa workflow/origem/evento/prazo/antecedência, sem depender da versão publicada ou `updated_at`. O marcador interno `-1` identifica atraso e não é um parâmetro de usuário. O campo histórico `contract_id` desse cursor guarda o UUID da origem; a chave do evento vincula o tipo de entidade. Republicação, reprocessamento, exclusão do evento processado e alteração de prazo A→B→A não repetem o aviso referente a A. Alterar prazo, encerrar o item, invalidar o estado personalizado ou mudar seu vínculo pai bloqueia ocorrências pendentes na revalidação. Pausas e aprovações conservam a âncora privada original.

Os avisos e as intenções de e-mail preservam URLs relativas canônicas. Tarefas usam `/projects/tasks?taskId=UUID`, com leitura autenticada fresca por ID, independente de filtro ou página. Marcos usam `/projects/PAI?tab=milestones&milestoneId=UUID`, com pai do mesmo workspace. A central reconstrói esse destino pelo contexto protegido e visibilidade atual, inclusive para um aviso antigo sem link. A ficha só seleciona a aba e destaca uma linha autorizada; isso não conclui o marco nem dispara cobrança. As permissões da ficha do projeto e de cada recurso permanecem obrigatórias. Troca de usuário/workspace, negação ou falha de consulta não mantém uma ficha antiga acionável.

O produtor P9 não grava em `project_alerts`, não reavalia o painel de alertas por leitura, não altera tarefas, apontamentos, medições, faturamento ou alçadas. Somente ações explicitamente configuradas no Workflow podem executar seus efeitos canônicos, sob as permissões existentes. Todo aceite P9 é local com PostgreSQL/PostgREST, atores sintéticos e navegador; nenhum SQL de produção, publicação ou envio real faz parte do pacote.

A projeção de avisos P9 exclui `projects.planned_cost`. Tanto o emissor especializado quanto o produtor genérico de novos eventos removem esse campo antes da prova e persistência; o redator prospectivo de INSERT roda antes do guarda de hash. Filtros, ações, retomadas e associações hidratadas no motor também usam a projeção pública de projeto. Cópias ou incrementos genéricos sobre esse custo são recusados antes dos efeitos, evitando tratar um campo removido como zero. A leitura financeira autorizada continua em `work_cost_projection`, sem concessões novas, e campos de mesmo nome em outros módulos não são apagados por uma lista global. Esta migração não reescreve o histórico antigo.

Durante uma revalidação de acesso, a ficha e o painel de tarefa mantêm campos em edição exclusivamente na identidade original, mas ocultam e bloqueiam a superfície até a leitura confirmar o acesso. Falha, resposta vazia ou troca de identidade remove a exibição antiga. Não é usado cache de outro usuário/workspace para abrir um link de notificação.

## P10 — TechHire e TechPeople

O catálogo disponibiliza seis eventos adicionais (18 ativos, 22 aliases legados e nove planejados): `ats.application.received`, `ats.interview.scheduled`, `ats.offer.accepted`, `people.employment.started`, `people.document.expiring` e `people.approval.pending`. Disponibilidade não ativa regra ou canal. Som/tremor continuam opt-in explícito; WhatsApp por evento herda o consentimento geral na ausência de override, false bloqueia e true não supera autorização, política ou consentimento.

A oferta exige assinatura canônica da versão enviada. Início de vínculo autorizado exige admissão confirmada ou início direto governado; datas e status isolados não bastam e data futura não comprova trabalho. Documento usa validade DATE no calendário America/Sao_Paulo, com days_before explícito 1–365 e valor inicial editável 30; janela inclusiva até o prazo, sem vencidos. `ats_offers`, `people_documents` e `hiring_preparation_requests` são fontes somente leitura, vinculadas a evento nomeado.

Aprovação pendente cobre somente preparação profissional e a etapa atual liberada ao aprovador nomeado. O Workflow reutiliza o aviso obrigatório canônico no app, sem duplicá-lo, e permite canais explícitos somente ao mesmo aprovador. Desligar regra ou preferência nova não elimina o aviso obrigatório do processo. O editor não oferece destinatários arbitrários ou texto privado nesse evento; nenhuma decisão ou contratação decorre da URL ou da leitura.

Destinos exatos: `/jobs/PAI?tab=pipeline&applicationId=ID`, `/jobs/PAI?tab=interviews&interviewId=ID`, `/offers?offerId=ID`, `/people/PAI?tab=documents&documentId=ID` e `/people/hiring-requests?request=ID`. Início autorizado usa `/people/ID`. IDs são validados; pai e origem são conferidos no workspace e no cliente do usuário, sob controles HR canônicos. `milestoneId` de P9 permanece permitido no helper de navegação. Cache não autoriza o primeiro acesso: leituras focadas exigem resposta fresca e chaves de usuário/workspace. Durante revalidação, rascunhos da mesma identidade ficam montados, ocultos e bloqueados; erro, revogação ou troca de contexto retira o conteúdo.

Projeções de avisos/histórico não carregam salário, condições financeiras privadas, número/arquivo de documento, currículo, notas, link de reunião ou tokens públicos. Ler a origem mantém seus controles próprios, inclusive condições da oferta e documentos. O navegador sintético pode validar interação e layout; membership, RLS e produtores reais pertencem aos testes PostgreSQL locais. Nada é aplicado ou enviado externamente por esta documentação.

## P11 — TechFinance

Cinco chaves tornam-se ativas: payable.due/receivable.due/payable.overdue/receivable.overdue e invoice.received no namespace finance. Total: 23 ativos, 22 aliases legados e 4 planejados compartilhados. Selecionar prepara rascunho desativado, sem canal habilitado, publicação ou efeito financeiro.

Do dia usa due_date DATE igual a hoje em America/Sao_Paulo, com saldo real em aberto; publicação durante o dia pode avisar uma vez. Atraso usa o cruzamento civil due_date+1 posterior à publicação, com saldo aberto atual, sem offset, varredura de backlog anterior ou lembrete diário. Pagamento parcial também depende do saldo e data. A UI não expõe days_before/days_after para esses quatro.

invoice.received significa exclusivamente hiring_fiscal_documents pending_upload→registered com doc_type nfse/nfe, label NF de contratação recebida. registered→verified não gera outro recebimento; rejeitada bloqueia ocorrência pendente. Não representa emissão, customer_invoices, RPA/recibo ou folha. Snapshot mínimo contém apenas IDs, estados e datas; sem valores, CNPJ, dados bancários, notas, arquivos ou associações. A origem é readonly e ações genéricas de mutação financeira são recusadas, enquanto o editor genérico anterior conserva seu contrato.

Títulos usam /finance/entries/ID com leitura fresca autenticada e capacidades canônicas. NF usa /people/hiring-requests?request=REQ&fiscalDocumentId=DOC ou /contracts/supplier-requests?... conforme kind real. O contexto fiscal é a RPC canônica; não há SELECT raw fiscal. O frontend inclui ator/workspace na chave, exige leitura posterior à montagem e esconde/bloqueia superfície durante revalidação, preservando rascunhos da mesma identidade. Falha, ausência, revogação ou identidade nova retira conteúdo antigo. A URL não registra baixa, download, conferência ou aceite.

Para NF, Executor do workflow é um default editável e continua exigindo acesso fiscal. source_responsible é somente finance_user canônico da formalização vigente, ativo e autorizado; source_creator é uploaded_by somente quando escolhido explicitamente. Não há CFO/CEO/substituto presumido. Preferências por evento mantêm som/tremor desligados por padrão e WhatsApp herdado sem conceder consentimento/política/acesso.

As evidências do navegador são sintéticas, locais e usam biblioteca real com SVGs de bandeira empacotados pelo harness. Elas não provam login/RLS/produção ou envio real; esses limites ficam separados das suítes PostgreSQL de origem.


## Resumos e acompanhamentos P12

O agrupamento `CenterSettings.summary` permanece visual e não é migrado para adesão de envio. Resumo pessoal usa configuração privada própria por usuário/workspace, revisão CAS e defaults desativados/sem canais; diário às 08:30, segunda-feira 1 e America/Sao_Paulo são valores iniciais editáveis. Somente comunicações externas iniciais de prioridade `low` explícita e evento canônico comprovado são elegíveis; `people.approval.pending` fica excluído. Central imediata, texto neutro/link central, sem contagens ou snapshots externos e sem fallback automático no resumo.

Acompanhamento opcional está no `delivery.followup` do passo: lembrete de 1–168 horas × 1–3 ocorrências, horizonte máximo de 168 horas, ou uma escalada de 1–168 horas com seletor explícito. Exige inapp original existente/não lido e pendência canônica ainda válida, herda canais/fallback e nunca executa novamente outras ações. São elegíveis somente as 12 chaves fechadas de pendência; aprovação profissional não escala e a NF precisa permanecer registrada aguardando conferência. Política `digest_enabled`/`followups_enabled` começa false e `followup_daily_limit` zero; as mesmas alçadas administrativas e de Workflow continuam obrigatórias. Histórico distingue `occurrence_kind`, `parent_intent_id` e `batch_id`, sem inventar workflow/run para envelope multiorigem.


## P13: preparo e implantação gradual manual

A conferência publicada usa dados salvos e controles canônicos de leitura, sem novo SQL, privilégio de serviço, provedor ou envio. O catálogo de modelos WhatsApp deixa de fazer GET automático na montagem/foco e passa a exigir solicitação explícita para o remetente/contexto atuais. Status sincronizado ou configuração salva não são classificados como elegibilidade ao vivo.

O roteiro exige inventário de outras regras/backlog antes de habilitar políticas compartilhadas, revisão das outras ações do Workflow e plano de pausa. Desligar WhatsApp não elimina um fallback de e-mail explícito; políticas da central não são kill-switch global. Trabalho in-flight/accepted não é recolhido, e uncertain não pode ser repetido como rollback. Aceite local, publicação e piloto com sessões/provedor reais continuam etapas distintas.
