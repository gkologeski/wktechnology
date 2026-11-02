# Sequências multicanal — lote de rascunhos

A aprovação visual do protótipo em 02/11/2026 libera a integração incremental.
Este lote implementa `/prospecting/sequences`: planejamento de etapas, público
com o `AudienceGroupsEditor` do WhatsApp e persistência de rascunhos. Não
inscreve destinatários, não ativa agentes e não realiza envios ou chamadas.

## Fronteiras

- As chaves existentes `system.automation.sequences.view/create/update` mantêm
  escopos own/team/workspace. Não são concedidas permissões a cargos.
- Menu, rota, UI e server functions usam a matriz. As RPCs conferem novamente
  o workspace ativo, membership, deny, dono e operação real (create/update).
- `prospecting_sequence_drafts` só admite SELECT direto para usuários; escrita
  somente pela RPC. Revisões ficam em tabela separada, sem UPDATE/DELETE direto.
- `expectedRevision` e trava transacional impedem sobrescrita concorrente.
- A prévia consulta CRM com o cliente do usuário e RLS. Mostra contagens antes
  das exclusões planejadas, uma amostra de oito nomes e aviso de truncamento.
  Ela não representa autorização comercial de contato.
- Referências de contas/agentes conservam a permissão independente de canais.
  Nenhum segredo de provedor é carregado pelo construtor.
- Cadências anteriores não são migradas nem alteradas. A antiga ação de
  registrar atividade de e-mail não se transforma em envio real.

## Aplicação e aceite

A migration nova é `0292_prospecting_sequence_drafts.sql`. Não reaplicar o
histórico. Aplicar em produção apenas com CI e aceite concluídos, antes de
publicar a tela. O script `scripts/isolated-db/sequence-drafts-acceptance.mjs`
exige o marcador da stack local descartável e usa JWT emitido pelo GoTrue.
Restaura os overrides e apaga somente fixtures próprias em `finally`.

Os testes locais Vitest ficam em `src/lib/prospecting/sequences/`. Verificação
global, build finalizado e checagem de performance são exigidos no fechamento.
A aprovação do protótipo não é evidência de implantação em produção.

## Próximos lotes

1. Publicação de versões imutáveis, preflight por canal e seleção de templates
   aprovados com variáveis reais. Revalidar todas as referências no workspace.
2. Inscrição/snapshot, exclusões, deduplicação, opt-out e autorização de contato.
3. Executor com fila, lease/CAS, idempotência e reconciliação de envios incertos;
   e-mail real, WhatsApp oficial e telefonia existente, sem atalhos legados.
4. Eventos de resposta/reunião/atendimento humano cancelam contatos pendentes;
   associação inequívoca de conversa e canal; agente definido por atendimento.
5. Resultados, motivos de pausa/falha, métricas de entrega e aceite por canal.

A definição de rascunho é entrada de planejamento: não deve ser consumida por
workers como instrução executável antes da validação e publicação de versão.

## Lote de versões de configuração

`0293_prospecting_sequence_versions.sql` cria snapshots imutáveis por revisão.
A ação usa `system.automation.sequences.manage` e exige também a leitura da linha;
permissão de editar um rascunho não concede a de criar versões. O banco copia o
conteúdo salvo, sem aceitar definição/dono/autor enviados pelo cliente. Repetir
a criação da mesma revisão devolve a mesma versão. Alteração concorrente exige
recarregar. Usuários não têm escrita direta; UPDATE é proibido inclusive por
gatilho. Não há status executável nem fila/evento de prospecção nesta migração.

A tela valida a configuração salva antes de solicitar uma versão. O preflight
revalida contas visíveis e habilitadas, Gmail conectado do próprio remetente,
responsáveis ativos, agentes com versão publicada e vínculos habilitados para
campanhas e atendimento nas contas utilizadas. O catálogo WhatsApp é consultado
no provedor para o número autorizado exato; falha não vira catálogo vazio e não
há fallback para a tabela local. Os parâmetros posicionais são conferidos.
Cada catálogo é consultado uma vez por conta em cada validação.

Limites explícitos deste lote: chamadas automáticas aguardam o executor; modelos
com mídia, cabeçalho variável, variáveis nomeadas ou botões parametrizados exigem
outro adaptador e impedem a validação atual. A seleção aceita modelos de corpo
de texto com até vinte variáveis posicionais. A etapa de chamada humana exige
responsável e será convertida em tarefa pelo futuro executor.

O preflight é uma verificação pontual de configuração, não prova permanente de
credenciais, elegibilidade dos destinatários ou disponibilidade dos provedores.
A RPC de snapshot aplica autorização e integridade, não consulta a Meta. Mesmo
uma versão obtida diretamente pela RPC nunca autoriza execução por si só.
Antes de inscrever ou enviar, os próximos lotes devem validar filtros,
consentimento/opt-out, provedores, referência de cada conta/agente/responsável e
permissões atuais. Um worker nunca pode confiar apenas na existência da versão.

## Lote de reserva do público

A migração 0294 registra inscrições imutáveis em estado reservado, sem criar
filas ou enviar mensagens. A ação exige leitura e atribuição da versão, com
escopo atual do usuário. Os filtros congelados são resolvidos pelo mesmo leitor
de público das campanhas WhatsApp; resultados truncados são recusados.

O banco revalida a identidade sob RLS e as máscaras atuais. Registra somente
resumos na interface e mantém a evidência de autorização e os hashes de
identidade inacessíveis aos clientes. Opt-out, ausência de canal, duplicidade,
clientes, negócios abertos e inscrições anteriores produzem motivos distintos.
As exclusões comerciais e de outra sequência seguem a configuração; opt-out e
validade do canal não são opcionais. A proteção cobre estas reservas, inscrições
legadas de sequências e inscrições SDR ativas. Não representa um catálogo de
todas as campanhas do sistema.

Repetições da mesma requisição são idempotentes. Uma trava transacional por
workspace impede reservas concorrentes duplicadas. Consultas por UUIDs usam
lotes de 150 para respeitar o limite de URL do gateway, inclusive nas campanhas
WhatsApp que compartilham o leitor.

Ainda faltam executor, cancelamento/liberação das reservas, ingresso dinâmico e
retomada individual. Antes de qualquer execução, o executor deve revalidar
permissões, consentimento, opt-out, canais, contas, agentes e disponibilidade dos
provedores. A existência de uma reserva não autoriza um envio.

## Executor: implementação em andamento

A infraestrutura da migração 0295 separa inscrições em execução, reservas de
cada efeito e eventos do público imutável. Início, pausa e retomada exigem ator
ativo no workspace atual, escopo e permissões atuais; o worker usa lease com
expiração e bloqueio concorrente. Resultados desconhecidos ficam em quarentena,
sem reenvio automático. Recibos recebidos durante uma pausa são preservados e
conciliados na retomada. Tarefas de chamada humanas são criadas junto com o
recibo e avanço da execução, numa transação única.

O planejador implementa expediente configurado, esperas por horas, dias civis e
dias úteis, fusos com horário de verão, condições, interrupção por resposta,
opt-out e reunião. O contexto do destinatário usa a projeção protegida atual.

Este lote ainda não conecta o worker a um cron de produção. Adaptadores reais
de e-mail/WhatsApp, handoff, eventos de resposta, reconciliação operacional,
liberação de reservas, entrada dinâmica, painel e homologação/publicação
continuam necessários antes de ativar disparos. A infraestrutura isolada não
significa que o fluxo completo esteja pronto ou publicado.

## Adaptadores de entrega: implementação em andamento

A migração 0296 prepara o Gmail e a Cloud API/conector oficial de WhatsApp. O
Gmail usa a conta exata do responsável, Message-ID determinístico e referências
à conversa da mesma conta. O WhatsApp usa exclusivamente o modelo aprovado e
idioma da conta selecionada, com revalidação do catálogo e qualidade do número.
Nenhum fallback troca o remetente. Valores ausentes em variáveis impedem envio.
A identidade protegida e a conta são comparadas com a reserva antes do envio.

Após aceitação do provedor, o recibo é salvo privadamente antes da projeção na
Inbox. Essa projeção é idempotente; se falhar, a execução fica pausada, com recibo
preservado, sem reenvio. Retomar exige que a projeção esteja conciliada. As datas
da entrega são preservadas mesmo numa recuperação posterior. Uma pausa ou
cancelamento manual não é desfeito pelo recebimento de um recibo tardio.

O rodapé de e-mail reutiliza o descadastro existente; reservar um token para o
link não equivale a descadastro. A utilização do link torna a exclusão efetiva.
Os testes de transporte usam mocks; o aceite JWT insere recibos sintéticos e
simula falha na Inbox. Isso não comprova entrega real por Gmail/Meta. A conexão
ao cron, limites operacionais, handoff, painel e homologação final permanecem
pendentes, e nenhum disparo foi ativado em produção.

## Controles operacionais: implementação em andamento

A migração 0297 separa tarefa criada de chamada realizada: a execução permanece
em `waiting_task` até a conclusão da atividade associada. Um sinal indexado de
conclusão evita varrer todas as atividades pendentes; o worker valida vínculo e
permissões antes de continuar. O resultado canônico da chamada permite condições
sem interpretar um texto livre como resposta negativa.

Cada etapa possui relógio próprio, incluindo esperas consecutivas e esperas após
trabalho humano. Canal anterior pulado por falta de endereço não gera espera
por uma mensagem inexistente. Limites configuráveis por conta usam uma janela
móvel de 24 horas e trava transacional entre sequências. Só a prospecção entra
nessa cota; as respostas do atendimento não passam por ela. O worker processa
até duas contas em paralelo, tem orçamento de execução e libera claims ainda
não utilizados.

A conciliação recupera projeções de recibos já registrados; resultado desconhecido
continua em quarentena, mesmo em uma nova sequência que permita outros
atendimentos. Identidades e aliases são comparados com os destinatários
normalizados, inclusive após alterações no cadastro. Papéis de teste não podem
originar execuções. Apenas uma falha certificada antes de chamar o transporte
permite retentativa com novo nonce, mantendo a chave idempotente. Timeouts de
transporte nunca são interpretados automaticamente como prova de não envio.

As solicitações Gmail e do gateway oficial têm timeout e redirects manuais.
Ainda faltam a tela de operação, tratamento/encaminhamento imediato das respostas,
liberação de reservas, entrada dinâmica, ligação do cron e aceite/publicação.

## Operação e respostas: implementação em andamento

A migração 0298 e o painel por versão permitem iniciar uma inscrição com
preflight dos canais atuais, pausar, retomar, cancelar e conferir execuções
paginadas. Cada botão recebe capacidades por responsável; as mutações repetem
as verificações no SQL. Contadores são de registros visíveis, não totais globais.

A migração 0299 registra sinais duráveis de respostas sem adquirir locks das
execuções dentro da ingestão. E-mails precisam ser respostas verificadas ao
remetente e cabeçalho originais; mensagens automáticas são excluídas. O canal,
conversa e agente são os da resposta efetiva. Esperas mantêm a etapa atual até
o vencimento, preservando sua política de encaminhamento. O agente padrão do
canal não pode substituir a escolha da sequência. Atendimento humano cria uma
atividade e notificação idempotentes; nunca retoma uma conversa assumida por
pessoa. Vínculo com agente usa a infraestrutura publicada de canais/SDR e não
envia mensagem de IA artificial para simular uma resposta recebida.

O aceite isolado usa JWTs reais e mensagens sintéticas para validar a pausa de
cadência e o vínculo do agente correto. Liberação de reservas, entrada dinâmica,
métricas consolidadas, cron, aceite no navegador e publicação ainda são necessários.

## Ciclo de vida e exclusões atuais

A migração 0300 mantém a evidência de inscrição imutável e registra seu
cancelamento e a liberação de identidades separadamente. Cancelar um lote exige
visibilidade atual de todo o público elegível e gestão sobre todos os executores,
inclusive quando o criador da versão e o executor são pessoas diferentes.
Inscrições canceladas não reiniciam; nova entrada da mesma pessoa exige outra
versão. Uma entrega em andamento, incerta ou pendente de projeção continua em
quarentena, mesmo depois de cancelar o lote.

O encerramento humano exige a conclusão da tarefa real; o encerramento do agente
usa a inscrição SDR da conversa exata entregue por esta sequência. Reservas
concluídas deixam de bloquear outras versões. Antes de cada ação, uma nova
verificação comercial interrompe o contato se surgiu negócio aberto ou relação
de cliente conforme os filtros salvos, sem expor os registros comerciais ocultos.

Tarefas e handoff usam `techsales.tasks`; chamadas humanas usam
`techsales.activities`. As três chaves de atribuição de tarefas entram no
catálogo sem concessão automática. Atribuir outro responsável exige essa ação
antes da reserva, além de criação e vínculo ativo no workspace.

## Entrada dinâmica

A migração 0301 adiciona uma assinatura explícita por versão imutável. A ativação
registra o responsável e a autorização para contatos futuros; pausar a entrada
não cancela execuções já inscritas. Novos candidatos são reavaliados em ciclos
de 15 minutos, com limite de 5.000 correspondências e leases exclusivos.

O catálogo, a normalização, os operadores e o compilador de filtros são os
mesmos das campanhas WhatsApp. A leitura ocorre com o sujeito ativo, sem
BYPASSRLS, incluindo a projeção protegida dos campos. Campos personalizados
precisam continuar ativos. Perder acesso à base gera erro, nunca público vazio.

A inscrição e o início são uma transação única. O mesmo registro não reentra na
mesma versão. Candidatos bloqueados são reavaliados mesmo se o contato não
mudou: opt-in, negócio fechado/perdido e mudanças de vínculo podem alterar a
eligibilidade. Prévia totalmente bloqueada é revertida, sem acumular cópias de
snapshots sem execução. Público acima do limite pausa sem iniciar lote parcial.

Consentimento, leases e fingerprints não são consultáveis pelo navegador.
Contagens históricas exigem o próprio responsável ou administrador ativo; sem
verificação concluída, os números são desconhecidos, não zero. O tick ainda
precisa ser conectado ao cron na etapa final; este lote não ativa produção.

### Identidade das conversas (0302)

Respostas de e-mail usam apenas a mesma caixa atual, destinatário efetivo e histórico acessível ao responsável. Trocar o e-mail não reutiliza a conversa antiga. Conversas WhatsApp de outra pessoa bloqueiam o envio; conflito surgido depois da aceitação mantém o recibo e exige reconciliação, sem reenviar nem sobrescrever vínculos.

### Chamadas automáticas (0303)

Uma etapa automática utiliza a configuração Vapi do workspace e um roteiro ativo e visível. Exige permissões atuais de telefonia, roteiro e criação da atividade. Cada etapa representa uma chamada; novas tentativas ficam explícitas no fluxo, com esperas próprias. O transporte faz uma única tentativa, com prazo limitado e sem seguir redirecionamentos. Resultado desconhecido fica em quarentena.

O recibo é gravado antes da projeção da atividade. A chamada tem vínculo com o Lead ou Contato original e permanece aguardando retorno confirmado da telefonia. O webhook autenticado confere efeito, remetente, destinatário e ID da chamada; eventos duplicados ou atrasados não reabrem uma execução cancelada. Eventos de sequência não passam pela retomada de campanhas legadas. A conclusão manual pela operação da sequência é bloqueada para chamadas automáticas. Testes locais usam recibos sintéticos; não comprovam a configuração nem a entrega real da operadora.

Referência técnica: https://docs.vapi.ai/server-url/events e https://docs.vapi.ai/api-reference/calls/create.

### Indicadores e histórico (0304)

Agregados são executados pelo cliente autenticado, com SECURITY INVOKER e as mesmas políticas de leitura das execuções. O painel informa cobertura do escopo atual e distingue aceitação pelo provedor de entrega/leitura, sem consultar recibos ou alvos privados. Erro não vira zero. O histórico retorna no máximo 50 eventos. Sinais de conversão são registrados a partir do contexto verificado na transição; nomes de encerramento definidos pelo usuário não contam como resposta ou reunião.

### Agendamento e coexistência

O endpoint existente de sequências utiliza CRON_SECRET antes de qualquer trabalho. A ordem é: recuperar fatos de chamadas aceitas; verificar uma inscrição dinâmica; executar até cinco destinatários com orçamento de 20 segundos e dois consumidores; manter o processamento legado. Cada responsável é validado novamente em sua execução. Falhas de uma frente não impedem tentar as demais, e erros retornam apenas nomes estáveis de etapas. Logs/HTTP trazem contagens, sem IDs de destinatários ou recibos privados. O agendamento existente de dois em dois minutos foi confirmado por consulta de metadados, sem alterar seu segredo.

A exclusão de outras sequências também é reavaliada antes da ação caso uma inscrição legada ou SDR tenha sido iniciada após o snapshot (0305). A escolha explícita de permitir concorrência é preservada; opt-out e quarentena de envio permanecem obrigatórios.

### Sugestões do público compartilhado (0306)

O seletor de valores mantém a mesma interface das campanhas WhatsApp, mas a consulta aceita leitura de Sequências ou de Campanhas, sem conceder acesso às operações de campanha. O cliente autenticado, workspace ativo, permissão da entidade, lista branca e campos protegidos continuam obrigatórios. O RPC usa as visões compartilhadas de campos e rejeita campos mascarados, internos e personalizados inativos; não consulta valores pelo cliente de serviço. O aceite visual revelou essa dependência indevida de Campanhas e motivou a correção.
