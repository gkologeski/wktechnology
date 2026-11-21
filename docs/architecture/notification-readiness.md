# NOTIFICA-CENTRAL — P13: conferência de preparo publicado

A superfície fica em Modelos e canais da central existente. Não adiciona rota, scheduler, gate de implantação, allowlist, percentual ou SQL. A leitura não envia mensagem, aprova piloto ou publica Workflow.

## Contrato e autoridade

O input exige workspace e Workflow explícitos. A sessão e o workspace ativo precisam coincidir; a fronteira aplica notification_settings.view.workspace e autorização de leitura do Workflow no escopo canônico. Somente trigger/actions/goal_filters publicados são conferidos. Rascunhos nunca substituem a versão publicada. A resposta é mínima, com horário, identidade da configuração, versão, situação, evento canônico e códigos fechados de diagnóstico; não inclui ações brutas, nomes de destinatários, endereço, segredo ou snapshot de origem.

Os estados são observed, dependency_blocked, manual_pending e unavailable. Observed comprova apenas configuração consultada pelo leitor atual, inclusive defaults de uma política ainda sem gravação explícita. Origem, destinatários, suas permissões, provedor ao vivo, login, recibo e piloto real não são inferidos de flags ou caches. Não há readiness global de envio.

## Interface e contexto

O painel usa identidade e permissões reais, chaves por ator/workspace/Workflow e leitura fresca. Mudança de seleção/contexto remove o resultado anterior; revalidação o oculta, e falha não preserva dados como confirmados. Nenhum botão registra aceite persistido, envia, ativa ou pausa automaticamente.

A consulta existente de modelos WhatsApp passa a ser uma ação explícita. Não ocorre na montagem, foco, escolha de regra ou simples troca de remetente. A consulta usa o remetente escolhido e o contexto autorizado; seu recibo local é descartado ao trocar remetente/identidade ou perder acesso. Nome e idioma salvos são configuração, não aprovação ao vivo. O transporte continua revalidando as condições reais antes do POST.

## Piloto e pausa

O runbook é manual e exige autorização posterior, inventário de outras regras e backlog antes de habilitar uma política compartilhada, destinatário e canal explícitos, limites conservadores e acompanhamento de resultados. A política não isola o piloto de outras regras. Outras ações de Workflow mantêm seus próprios controles e efeitos.

Pausar apenas WhatsApp pode preservar fallback de e-mail explícito. Políticas da central não pausam todos os transportes, ações ou produtores legados. Trabalho em processamento ou aceito não é recolhido; resultado incerto não admite nova chave, repetição, alternância de número ou fallback como reversão.

## Aceite local

Cobrir versão publicada versus rascunho; falhas e dados ausentes; os cinco cenários canônicos de autorização; ausência de GET/segredos/transportes na conferência; consulta de modelos somente por ação explícita; troca de identidade/remetente e resposta tardia; estado oculto durante revalidação; UI dos dois temas em desktop e 375px. Navegador sintético não comprova login, banco ou recebimento real. Os fingerprints canônico e do mapa de fontes, quando registrados, têm métodos e limites distintos.
