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
