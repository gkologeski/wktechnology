# NOTIFICA-CENTRAL — pacote 1: catálogo e compatibilidade

## Escopo

Este pacote fornece metadados de eventos e uma política comum para as preferências pessoais e as interrupções do sino. Preserva os produtores, os registros e os fluxos existentes. Não instala regras, migra dados, altera permissões, aplica SQL ou ativa envios externos.

O catálogo fica em `src/lib/notification-catalog.ts`. As preferências e a decisão de interrupção ficam em `src/lib/notification-preferences.ts`. A listagem autenticada e o realtime usam o mesmo resolvedor de tipos legados.

## Evento, grupo e tipo legado

- `type` é o valor já armazenado em `notifications`. Não é renomeado neste pacote.
- `eventKey` identifica uma entrada do catálogo. Para tipos legados sobrecarregados, a chave é `legacy.<type>`; ela não afirma que um evento de negócio mais específico ocorreu.
- `category` é o grupo estável de preferências. Não é canal, módulo, permissionamento ou destinatário.
- `moduleKey` identifica o módulo de um evento planejado. Para aliases legados permanece `null`, pois um mesmo tipo pode atender mais de um módulo.
- `availability: legacy` significa que há um adaptador de leitura compatível. Não comprova que existe um produtor ativo de cada alias em produção.
- `availability: planned` reserva um contrato para pacotes posteriores. Não cria produtor, regra, assinatura, agendamento ou canal habilitado.
- Após o pacote 10, `availability: active` identifica dezoito eventos comerciais, contratuais, de projetos, recrutamento e pessoas com integração disponível para regras explícitas. Não significa Workflow publicado, regra ativa, preferência ligada ou canal autorizado. Os 22 aliases `legacy` permanecem iguais.

O resolvedor usa aliases exatos em `Map`. Não usa prefixos genéricos como `sla.*`, propriedades herdadas, títulos, corpo, links ou IDs para inventar a semântica de um registro. Tipo desconhecido resolve para `null` e permanece no histórico.

## Compatibilidade dos 22 aliases

O inventário estático encontrou 19 tipos emitidos e três categorias antigas sem produtor direto identificado (`deal_stage`, `ticket`, `sla`). Os 22 aliases são mantidos para compatibilidade:

| Tipos existentes                                                                      | Grupo de preferências |
| ------------------------------------------------------------------------------------- | --------------------- |
| `mention`                                                                             | `mention`             |
| `assignment`                                                                          | `assignment`          |
| `deal_stage`                                                                          | `deal_stage`          |
| `ticket`                                                                              | `ticket`              |
| `task`, `sequence_handoff`                                                            | `task`                |
| `sla`, `sla.first_response_breach`, `sla.resolution_breach`, `sla.at_risk`            | `sla`                 |
| `message`                                                                             | `message`             |
| `workflow`                                                                            | `workflow`            |
| `approval`, `role_profile_approval`, `hiring_approval`, `hiring_preparation_approval` | `approval`            |
| `role_profile`, `hiring_formalization`                                                | `hiring`              |
| `form_submission`                                                                     | `form`                |
| `portfolio_conflict`                                                                  | `portfolio`           |
| `security_scan`, `platform_alert`                                                     | `platform`            |

Sobreposições preservadas:

- `mention` também pode representar revisão ou encaminhamento de agente.
- `message` pode ser mensagem da Inbox ou comentário de atividade.
- `task` reúne lembretes e encaminhamentos contratuais com situações diferentes.
- `workflow` inclui avisos livres, etapas de aprovação, criação de vaga e handoff SDR.
- `approval` não distingue revisão, aceite, ajuste solicitado ou falta de aprovador.
- `hiring_approval` atende demanda ATS e vínculo People. Os tipos `hiring_preparation_approval` e `hiring_formalization` atendem tanto profissionais quanto fornecedores e não identificam um único módulo ou estágio.

`withNotificationEvent` acrescenta somente o objeto `event` à resposta da listagem. Não muda `type`, IDs, usuário, workspace, `dedupe_key`, título, corpo, link, leitura ou cursor. O histórico continua sendo lido pelas fronteiras pessoais existentes.

O tipo `hiring_approval` e sua chave de deduplicação não podem ser renomeados no adaptador: o gatilho legado que alimenta `hiring_email_outbox` depende de `type='hiring_approval'` e de `dedupe_key` iniciado por `hiring:`.

## Eventos canônicos e disponibilidade

O pacote 1 reservou 27 entradas canônicas: 23 dos seis módulos e quatro compartilhadas. O pacote 10 mantém as doze entradas TechSales/TechContracts/TechProjects e acrescenta seis de TechHire/TechPeople; as outras nove permanecem planejadas. Nenhuma entrada cria ou ativa uma regra automaticamente.

| Módulo                      | Chaves canônicas                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| TechSales (`crm`)           | `crm.deal.won`, `crm.deal.lost`, `crm.deal.stage_changed`, `crm.proposal.accepted`                                                   |
| TechHire (`ats`)            | `ats.application.received`, `ats.interview.scheduled`, `ats.offer.accepted`                                                          |
| TechPeople (`people`)       | `people.employment.started`, `people.document.expiring`, `people.approval.pending`                                                   |
| TechContracts (`contracts`) | `contracts.draft.accepted`, `contracts.signature.completed`, `contracts.contract.expiring`, `contracts.contract.renewal_due`         |
| TechFinance (`finance`)     | `finance.payable.due`, `finance.receivable.due`, `finance.payable.overdue`, `finance.receivable.overdue`, `finance.invoice.received` |
| TechProjects (`projects`)   | `projects.project.started`, `projects.project.overdue`, `projects.task.overdue`, `projects.milestone.due`                            |
| Compartilhados              | `shared.approval.pending`, `shared.sla.breached`, `shared.message.received`, `shared.mention.created`                                |

Uma futura integração deve fornecer a chave canônica a partir do produtor autorizado, em vez de deduzi-la de um aviso antigo.

### Integração do pacote 8

As oito chaves `crm.*` e `contracts.*` da tabela são operacionais para regras explícitas do motor Workflows. A seleção fica em `trigger.notification_event`; a UI abre somente um rascunho desativado. A ocorrência canônica é comprovada no banco, sem reinterpretar rótulos, títulos, links ou um status genérico. Ganho/perda têm prioridade sobre outras mudanças de etapa; uma transição recebe uma única classificação canônica.

`notifications.type` preserva o tipo legado `workflow`. As RPCs de listagem/lookup fornecem `eventKey` pela proveniência privada da ocorrência. O parser mantém esse campo e `withNotificationEvent` lhe dá precedência. Campo explícito inválido, desconhecido ou ainda planejado produz metadados nulos e não herda interrupções de um alias legado. Quando o campo é omitido em um registro antigo, a resolução legada permanece compatível. `contracts.draft.accepted` pertence a TechContracts mesmo quando a origem autorizada é o negócio vinculado.

`LEGACY_NOTIFICATION_EVENTS` continua com 22 entradas. `AVAILABLE_NOTIFICATION_EVENTS` e `AvailableEventKey` abrangem essas entradas e os doze eventos operacionais; apenas essa lista pode receber overrides do cliente. Os demais campos futuros salvos continuam preservados no banco, sem serem expostos ou editáveis.

Para os doze eventos, No app/e-mail partem da preferência do grupo. Som/tremor começam desligados e só podem ser ligados por escolha explícita no grupo ou evento do workspace; isso evita herdar defaults sonoros de tipos legados como `task`. O sino resolve o mesmo `eventKey` da consulta autenticada e aplica o overlay atual depois de conferir a origem. Payload de realtime continua fornecendo somente IDs; jamais autoriza interrupção por conteúdo bruto.

O overlay do workspace também admite `whatsapp?: boolean` em categoria/evento, sem acrescentar esse canal aos defaults ou à edição global de `profiles.notification_preferences`. Ausência/null restaura herança; `false` bloqueia o canal; `true` é somente preferência e não supera consentimento, política, regra ou autorização. `effectiveChannels` e a interrupção do sino continuam retornando somente os quatro canais anteriores. A apresentação de WhatsApp usa uma resolução separada, sem alegar elegibilidade ou transmissão real.

Vencimento usa `ends_at`; renovação exige `auto_renew` e `notice_days` válidos, com prazo `ends_at − notice_days`. A antecedência é explícita, de 1 a 365 dias; 30 é apenas o valor inicial editável do rascunho. A janela vai de prazo menos antecedência até o prazo, inclusivamente; não inclui prazos vencidos nem renova o contrato. Assinatura concluída exige prova válida da versão atual; o preset histórico baseado em `signed_at` permanece separado.

## Preferências e gravação compatível

Os sete grupos anteriores mantêm nomes internos e defaults: `mention`, `assignment`, `deal_stage`, `ticket`, `task`, `sla` e `message`. Valores booleanos explicitamente salvos, inclusive `false`, são preservados.

Os seis novos grupos são `workflow`, `approval`, `hiring`, `form`, `portfolio` e `platform`. O default é `inapp=true`, `email=false`, `sound=false`, `shake=false`. Isso oferece compatibilidade no sino sem habilitar um canal externo ou uma interrupção sonora implicitamente.

`normalizeNotificationPrefs` retorna somente os grupos e canais conhecidos. Quando um canal está ausente, usa o default do grupo. Um canal presente só fica ligado se seu valor for o booleano `true`; valores presentes inválidos ficam desligados, sem coerção por `Boolean(...)`. Campos futuros armazenados não são expostos ao navegador por essa normalização.

`notificationPrefsDiff` faz a tela enviar somente as opções efetivamente alteradas em relação à leitura carregada, em vez de reenviar um snapshot inteiro. Assim, salvar uma mudança não repõe opções que permaneceram intocadas na tela.

`updateMyNotificationPrefs` aceita esse patch estrito de categorias e canais conhecidos. Categorias ou canais desconhecidos enviados pelo cliente são rejeitados; eles não servem como mecanismo para escrever estruturas futuras. O servidor lê o JSON atual e aplica o patch sobre ele:

1. Mantém categorias e campos desconhecidos já armazenados no servidor.
2. Mantém categorias e canais omitidos por clientes antigos; ausência não equivale a restaurar defaults.
3. Grava com comparação do valor JSON anterior (compare-and-swap), sempre no `profiles.id` do usuário autenticado. A comparação é de JSONB inclusive para o valor JSON `null`, diferente de SQL NULL; a coluna é `NOT NULL`.
4. Se outra sessão alterou o valor, relê e reaplica o patch, até três tentativas. Se a disputa persistir, devolve erro de conflito; falha de banco não vira confirmação de sucesso.

A resposta GET, o cache e o acesso a preferências continuam pessoais. As chaves do cache incluem a identidade do usuário. O sino conserva a identidade junto à referência das preferências e não aplica preferências de outro usuário a um novo callback.

## Política de interrupção

`notificationInterruption` resolve a categoria pelo mesmo catálogo usado na listagem:

- Sem preferências carregadas para o usuário atual ou com tipo desconhecido: sem toast, som ou tremor; o histórico não é removido.
- Com `inapp=false`: sem toast, som ou tremor, mesmo que opções antigas de som ou tremor estejam ligadas.
- Nos demais casos reconhecidos: toast permitido; som e tremor exigem o booleano `true` do canal correspondente.
- Para `type='message'`, a supressão dentro da Inbox exige a origem de conversa (`entity='inbox_conversation'`) ou um link relativo da Inbox. A categoria `message` sozinha não identifica Inbox. Um comentário de atividade continua elegível ao aviso mesmo quando a pessoa está nessa tela.

As opções não modificam leitura, execução de tarefa, decisão ou responsabilidade. A alteração de preferência não apaga notificações anteriores. Produtores que já consultam `inapp` ou `email` continuam consultando os mesmos sete grupos com os mesmos defaults.

## Limites operacionais e de autorização

- Não há novo endpoint de publicação de catálogo nem criação de regras neste pacote.
- Não são criadas permissões ou concessões, nem alteradas RLS, RPCs, membership ou alçadas.
- A lista e o contador ainda seguem o escopo pessoal atual; o pacote não introduz a segmentação por workspace proposta no protótipo.
- `notification-scope.test.ts` cobre o filtro pessoal e identificadores; não é nova comprovação de membership, deny ou isolamento RLS real. Esses aceites pertencem ao pacote de fronteira de acesso.
- O catálogo não filtra o acesso ao registro de origem, resolve responsáveis, escolhe gestor, substituto ou CEO. As fronteiras existentes continuam responsáveis pelo acesso real.
- A preferência de e-mail não unifica todos os produtores. Alguns fluxos legados gravam diretamente ou possuem envio próprio; a UI e a Ajuda expõem esse limite. Não prometer bloqueio global de e-mail.
- Não são adicionados WhatsApp nas preferências, opt-in, templates, silêncio, resumos, escalonamento ou reprocessamento de entregas.
- Não há SQL aplicado, migração de histórico, envio de teste externo ou publicação de produção implícita no catálogo.

## Continuação

Após este pacote, a implementação deve seguir as dependências da auditoria aprovada:

1. Resolver destinatários e a fronteira de acesso, com identidade, membership ativo, workspace, leitura da origem, deny e substituição explícita; incluir os cinco cenários reais de autorização.
2. Integrar central e preferências com contexto de workspace, links de resolução, leitura confirmada e tratamento dos avisos históricos sem proveniência comprovada.
3. Unificar as entregas no motor Workflows existente, preservando o ledger e os gravadores canônicos, antes de habilitar WhatsApp, fallback, silêncio e resumos.
4. Conectar produtores canônicos e regras em pacotes pequenos, testando duplicidade, falha e resultado incerto sem reenviar cegamente.

Essas etapas não estão ativadas pelas entradas `planned`. A Ajuda da tela atual está em `docs/help/core/revisar-preferencias-de-notificacoes.md`; a versão editorial deve ser aplicada no app somente na entrega autorizada, pelo mecanismo existente de atualização da Ajuda oficial.

### Integração do pacote 9 — TechProjects

As quatro chaves `projects.*` passam a `active`, sob as mesmas preferências e proveniência canônica das oito anteriores. Selecionar cria rascunho desativado, sem publicar ou ativar. Todos pertencem a `moduleKey=projects`; projeto usa entidade `projects`, tarefa `project_tasks` e marco `project_milestones`.

- `projects.project.started`: exclusivamente UPDATE Planejamento → Ativo. INSERT/importação já ativa, edição de starts_at e retomada Em espera não emitem essa ocorrência.
- `projects.project.overdue`: projeto Planejamento/Ativo, após vencer no calendário civil America/Sao_Paulo.
- `projects.task.overdue`: tarefa aberta, pai Planejamento/Ativo/Em espera, após vencer no mesmo calendário.
- `projects.milestone.due`: Pendente/Em andamento, completed_at nulo, pai Planejamento/Ativo/Em espera; days_before explícito 1–365 e valor inicial editável de 30 dias no rascunho. Janela até prazo, sem vencidos.

Overdue não admite days_before/days_after e não é lembrete diário. Somente vencimentos posteriores à publicação entram; uma verificação posterior recupera os elegíveis. Cursor por origem/prazo e regra não se reinicia ao republicar nem ao retornar A→B→A. Projetos encerrados, origens ausentes, outro workspace e acesso revogado suprimem conforme as fronteiras autorizadas; não são substituídos por nomes, datas ou destinatários presumidos. O produtor não altera prazos, status, cobrança nem os alertas operacionais opt-in do Dashboard.

Destinos reais: `/projects/<id>`; `/projects/tasks?taskId=<id>` com leitura focada independente de paginação/filtros; `/projects/<pai>?tab=milestones&milestoneId=<id>` com aba controlada e destaque da linha autorizada. Não há nova ficha de marco nem ação de conclusão por URL. Leituras focadas usam identidade/workspace, autorização atual e atualização obrigatória antes de exibir conteúdo.

## P10 — TechHire e TechPeople

O catálogo disponibiliza seis eventos adicionais (18 ativos, 22 aliases legados e nove planejados): `ats.application.received`, `ats.interview.scheduled`, `ats.offer.accepted`, `people.employment.started`, `people.document.expiring` e `people.approval.pending`. Disponibilidade não ativa regra ou canal. Som/tremor continuam opt-in explícito; WhatsApp por evento herda o consentimento geral na ausência de override, false bloqueia e true não supera autorização, política ou consentimento.

A oferta exige assinatura canônica da versão enviada. Início de vínculo autorizado exige admissão confirmada ou início direto governado; datas e status isolados não bastam e data futura não comprova trabalho. Documento usa validade DATE no calendário America/Sao_Paulo, com days_before explícito 1–365 e valor inicial editável 30; janela inclusiva até o prazo, sem vencidos. `ats_offers`, `people_documents` e `hiring_preparation_requests` são fontes somente leitura, vinculadas a evento nomeado.

Aprovação pendente cobre somente preparação profissional e a etapa atual liberada ao aprovador nomeado. O Workflow reutiliza o aviso obrigatório canônico no app, sem duplicá-lo, e permite canais explícitos somente ao mesmo aprovador. Desligar regra ou preferência nova não elimina o aviso obrigatório do processo. O editor não oferece destinatários arbitrários ou texto privado nesse evento; nenhuma decisão ou contratação decorre da URL ou da leitura.

Destinos exatos: `/jobs/PAI?tab=pipeline&applicationId=ID`, `/jobs/PAI?tab=interviews&interviewId=ID`, `/offers?offerId=ID`, `/people/PAI?tab=documents&documentId=ID` e `/people/hiring-requests?request=ID`. Início autorizado usa `/people/ID`. IDs são validados; pai e origem são conferidos no workspace e no cliente do usuário, sob controles HR canônicos. `milestoneId` de P9 permanece permitido no helper de navegação. Cache não autoriza o primeiro acesso: leituras focadas exigem resposta fresca e chaves de usuário/workspace. Durante revalidação, rascunhos da mesma identidade ficam montados, ocultos e bloqueados; erro, revogação ou troca de contexto retira o conteúdo.

Projeções de avisos/histórico não carregam salário, condições financeiras privadas, número/arquivo de documento, currículo, notas, link de reunião ou tokens públicos. Ler a origem mantém seus controles próprios, inclusive condições da oferta e documentos. O navegador sintético pode validar interação e layout; membership, RLS e produtores reais pertencem aos testes PostgreSQL locais. Nada é aplicado ou enviado externamente por esta documentação.
