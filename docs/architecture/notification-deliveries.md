# NOTIFICA-CENTRAL — pacote 4: entregas controladas

Implementação local sobre 39e47a794. Migração aditiva 0393 depende de 0391 e 0392; nenhuma migração histórica é alterada. Não aplicada a produção. Nenhum canal é habilitado nem permissão concedida a cargos automaticamente.

## Motor e compatibilidade

Regras são os próprios Workflows com ação send_notification, incluindo ramificações aninhadas. O editor canônico mantém rascunho/publicação e alçadas. A ação pode receber delivery {channels:[inapp,email,whatsapp],fallback:none|email}. Sem delivery usa a RPC legada e continua inapp-only. A RPC v2 resolve os destinatários e cria intenções/entregas atomicamente, sem passar IDs para inserts privilegiados em TypeScript. Só legacy.workflow está conectado a esta extensão; o catálogo não ativa novos produtores.

O drain usa o workflows-tick existente, protegido por CRON_SECRET, com limite de 20 jobs. Sem segundo scheduler. Slack continua na integração anterior e não participa dessa extensão. Os resumos diário/semanal continuam agrupamento visual da central, sem digest externo.

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
