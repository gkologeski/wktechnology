# NOTIFICA-CENTRAL — pacote 4: entregas controladas

Implementação local sobre 39e47a794. Migração aditiva 0393 depende de 0391 e 0392; nenhuma migração histórica é alterada. Não aplicada a produção. Nenhum canal é habilitado nem permissão concedida a cargos automaticamente.

## Motor e compatibilidade

Regras são os próprios Workflows com ação send_notification, incluindo ramificações aninhadas. O editor canônico mantém rascunho/publicação e alçadas. A ação pode receber delivery {channels:[inapp,email,whatsapp],fallback:none|email}. Sem delivery usa a RPC legada e continua inapp-only. A RPC v2 resolve os destinatários e cria intenções/entregas atomicamente, sem passar IDs para inserts privilegiados em TypeScript. A P4 conectou somente legacy.workflow; a P8 acrescenta os oito eventos comprovados de TechSales e TechContracts descritos abaixo. A disponibilidade no catálogo não habilita regras ou canais.

O drain usa o workflows-tick existente, protegido por CRON_SECRET, com limite de 20 jobs. Sem segundo scheduler. A P6 integrou o Slack coletivo ao ledger com seu próprio subtipo protegido; ele não representa entrega pessoal nem segue consentimento individual. Os resumos diário/semanal continuam agrupamento visual da central, sem digest externo.

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
