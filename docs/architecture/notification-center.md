# NOTIFICA-CENTRAL — pacote 3: central e preferências

## Escopo

Base local: `0f7fc770b` (catálogo e destinatários). Entrega local na branch
`codex/notifica-central-center`, sem push, merge, aplicação em produção ou publicação.
A migração 0392 deve ser aplicada antes de publicar o código dependente dela numa
implantação posteriormente autorizada. As migrações anteriores permanecem imutáveis.

O pacote entrega `/notifications` como área pessoal no shell ERP e integra o sino
à mesma fronteira. A identidade visual vem dos componentes e tokens do White Label;
não há cores, fontes ou logotipos de um workspace fixados no código. A configuração
global anterior em `/settings/notifications` permanece como base de compatibilidade.

Não cria outro motor de eventos ou scheduler. Regras, modelos, ledger multicanal,
envio de resumo externo, opt-in WhatsApp e piloto pertencem às próximas entregas.

## Recurso × ação × escopo

| Superfície                  | Ação                     | Controle                                                                                             |
| --------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Central, contador e detalhe | Ler                      | Sessão, workspace selecionado, membership ativo, próprio destinatário e RLS atual da origem          |
| Histórico sem contexto      | Ler                      | Mesma identidade/membership; somente metadados pessoais e conteúdo neutro, sem destino presumido     |
| Leitura / não lida          | Atualizar                | Mesmos controles; lote limitado a IDs explícitos e cutoff da consulta; sessão somente leitura negada |
| Adiar / cancelar            | Atualizar estado pessoal | Mesmos controles; somente 0, 60 ou 1440 minutos; nenhuma alteração da obrigação                      |
| Preferências no workspace   | Ler / atualizar próprias | Ator derivado da sessão, workspace ativo e membership; CAS e bloqueio de escrita somente leitura     |
| Proveniência                | Criar internamente       | Trigger privado para novos avisos, tabela de origem literal e workspace real                         |
| Despacho do Workflow        | Criar                    | Fronteira de serviço do pacote 2, agora consultando o overlay do workspace/evento                    |

São operações pessoais: não exigem uma nova chave de negócio para abrir a própria
central. Isso não remove as permissões de origem nem autoriza ler caixas de terceiros.
Não são concedidas permissões a cargos ou workspaces. A negação de uma permissão de
origem continua sendo comprovada por testes reais; não se usa um teste de sessão vazia
como evidência de membro inativo.

## Contexto, histórico e acesso direto

`notification_workspace_context` registra uma prova somente para novos INSERTs,
quando a entidade é reconhecida e pertence ao workspace declarado. Não há backfill,
nem dedução por título, link, dono ou default antigo de workspace. A prova registra
origem; não concede acesso. Listagem e leitura direta revalidam o acesso atual sob RLS.

Avisos sem prova permanecem preservados, separados no histórico pessoal e com texto
neutro. O payload antigo não é retornado nem usado para busca nessa visão; procurar
por texto não pode revelar conteúdo mascarado pela existência de um resultado.

A política restritiva na tabela fecha a leitura direta e o realtime para contexto
não confirmado, workspace não selecionado e origem sem acesso. Mutações diretas da
tabela são revogadas para o cliente autenticado; leitura e adiamento passam por RPCs.
As tabelas novas são privadas. As consultas da central usam um helper privado de leitura do ator atual, com papel
sem BYPASSRLS e sem gravar sessões ou alterar claims, compatível com GET readonly
do PostgREST. O dispatcher de terceiros mantém os bridges do pacote 2, que restauram
claims e recusam contexto aninhado.

## Paginação, leitura e adiamento

Lista por `(created_at, id)`, 30 itens por página e cutoff retornado pelo servidor.
O cursor da API nova exige o mesmo cutoff. No endpoint legado, um cliente antigo
que envia somente cursor usa sua data como corte conservador e continua consultando
apenas itens mais antigos. Filtros são limitados e validados nas bordas e no SQL.
O contador usa a mesma identidade, scope, categoria e busca, ignora cursor/estado
de leitura e é limitado a 100 elegíveis; a UI apresenta `99+` sem afirmar total exato.

“Marcar visíveis” envia no máximo 100 IDs carregados e o cutoff da página. Não há
UPDATE irrestrito de toda a caixa. O SQL valida o lote inteiro antes de atualizar;
falha não vira sucesso visual. Marcar novamente como lida preserva o instante original.
Ler ou adiar não aprova, não conclui tarefa e não prorroga prazo. Adiamentos vencidos
voltam à lista pelo predicado de tempo, sem produzir outra ocorrência ou scheduler.

Os endpoints legados de listagem e leitura individual passam pela fronteira nova.
O endpoint antigo de marcação em massa exige IDs/cutoff explícitos; clientes antigos
sem esse contexto recebem orientação de usar a central, em vez de marcar itens não
vistos. As funções globais de preferências preservam seu contrato de patch/CAS.

## Preferências e rotina

`notification_user_preferences` guarda overlay por `(workspace_id, user_id)`, revisão
e atualização. A ordem é padrão → perfil global legado → grupo do workspace → evento
legado exato. `false` explícito é preservado. Patches não materializam os defaults;
`null` remove um override de grupo/canal e restaura a herança. Campos futuros já
armazenados são preservados, mas campos desconhecidos recebidos são rejeitados.
Eventos `planned` do catálogo não são produtores ou destinos ativos de preferência.

O gateway do passo `Enviar notificação` aplica `inapp` efetivo de `legacy.workflow`
antes de gravar. Os demais produtores legados continuam com suas regras próprias;
o sino consulta as preferências efetivas antes de interromper. Não se promete que um
controle pessoal apague ou interrompa todas as gravações de produtores existentes.

Silêncio suprime pop-up, som e animação do sino, mantendo a central e seus prazos.
Usa fuso IANA e minutos locais: início inclusivo, fim exclusivo; admite cruzar a
meia-noite e não usa offset fixo. Início e fim iguais são inválidos quando habilitado.
O resumo diário/semanal organiza os itens carregados na central, sem envio externo.

## Navegação, cache e falhas

Cache e referências de realtime incluem usuário e workspace. Trocar contexto
remonta a área e descarta seleção, cursores e rascunhos anteriores. Um request traz
o workspace esperado e o servidor o compara ao contexto autenticado. O payload do
realtime não é usado diretamente para mostrar texto: a UI reconsulta o gateway.
Sem preferências carregadas ou em falha de autorização, o sino permanece silencioso.

Destinos passam pelo helper compartilhado com rotas internas comprovadas. Protocolos
externos, caminhos desconhecidos, travessia, barras invertidas e parâmetros de
redirecionamento são recusados. A rota de destino mantém suas permissões próprias.
Sem dados de prazo, prioridade, canal ou motivo, o detalhe não inventa essas informações.

## Validação e limites do aceite

Validar componentes, isolamento de contexto, conflitos CAS, silêncio/DST, herança,
filtros, links e ações com falhas. PostgreSQL e HTTP/JWT locais devem executar as
funções reais, políticas representativas, cinco cenários de origem e bloqueios de
acesso direto, além de paginação, cutoff, estado, histórico e deduplicação do pacote 2.

O navegador local com fixtures pode comprovar interação, layout e White Label dos
componentes reais. Ele não representa login GoTrue, dados de produção ou aceite após
implantação. O relatório final separa esses alcances. Ajuda atualizada nas fontes e
catálogo; aplicação editorial autenticada permanece para a entrega autorizada.

## Compatibilidade de produtores

Menções, atribuições, comentários e lembretes de atividade passam a gravar o workspace
explícito e a atividade como origem, mesmo quando ela está associada a um negócio.
Os avisos no app não copiam assunto/comentário privados; a leitura da atividade é
revalidada após a entrega. E-mails legados preservam seu caminho anterior. Aprovações
genéricas de Workflow preservam o título/nota no registro de decisão e enviam somente
aviso neutro, ligado à origem real; abrir a origem não decide nem substitui a etapa.

Aliases canônicos de vaga, minutas e revisão SDR usam suas políticas atuais, incluindo
permissões e nomeações próprias, sem presumir acesso ao contrato pai ou à configuração
do Workflow. Avisos de plataforma sem origem comprovada permanecem no histórico neutro.

## Evolução no pacote 8

Os doze eventos canônicos comerciais, contratuais e de projetos disponíveis para regras explícitas mantêm `notifications.type='workflow'`, com `eventKey` proveniente do vínculo privado comprovado. As RPCs de listagem e lookup preservam essa identidade para os metadados, preferências e interrupções. A chave canônica de minuta mantém módulo TechContracts mesmo quando usa o negócio vinculado como origem autorizada. Ausência histórica do campo preserva o alias legado; chave explícita inválida não recebe fallback ruidoso.

Som e tremor desses eventos começam desligados, com habilitação somente por escolha explícita na categoria ou evento do workspace. No app/e-mail herdam o grupo. O catálogo mantém os demais eventos planejados indisponíveis; uma preferência ou um preset não publica nem ativa Workflow. A configuração continua no construtor existente, com rascunho inicialmente desativado.

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


## Configuração pessoal de resumo P12

O agrupamento `CenterSettings.summary` permanece visual e não é migrado para adesão de envio. Resumo pessoal usa configuração privada própria por usuário/workspace, revisão CAS e defaults desativados/sem canais; diário às 08:30, segunda-feira 1 e America/Sao_Paulo são valores iniciais editáveis. Somente comunicações externas iniciais de prioridade `low` explícita e evento canônico comprovado são elegíveis; `people.approval.pending` fica excluído. Central imediata, texto neutro/link central, sem contagens ou snapshots externos e sem fallback automático no resumo.

Acompanhamento opcional está no `delivery.followup` do passo: lembrete de 1–168 horas × 1–3 ocorrências, horizonte máximo de 168 horas, ou uma escalada de 1–168 horas com seletor explícito. Exige inapp original existente/não lido e pendência canônica ainda válida, herda canais/fallback e nunca executa novamente outras ações. São elegíveis somente as 12 chaves fechadas de pendência; aprovação profissional não escala e a NF precisa permanecer registrada aguardando conferência. Política `digest_enabled`/`followups_enabled` começa false e `followup_daily_limit` zero; as mesmas alçadas administrativas e de Workflow continuam obrigatórias. Histórico distingue `occurrence_kind`, `parent_intent_id` e `batch_id`, sem inventar workflow/run para envelope multiorigem.
