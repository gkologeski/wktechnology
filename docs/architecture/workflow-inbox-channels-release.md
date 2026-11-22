# Pacote 2 — gatilhos multicanal da Inbox

## Resultado consolidado

O construtor de Workflows e a NOTIFICA-CENTRAL compartilham 13 eventos explícitos, com filtro por conta/canal e acesso atual à origem. A chave `shared.message.received` continua exclusiva de WhatsApp; as 24 escolhas operacionais anteriores e os 22 aliases legados conservam sua ordem e significado.

| Canal                    | Eventos                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| Gmail                    | Mensagem recebida, conversa criada, responsável alterado, primeira resposta                  |
| Chat do site             | Mensagem recebida, conversa criada, responsável alterado, status alterado, primeira resposta |
| LinkedIn pessoal/Unipile | Mensagem recebida, conversa criada, status alterado, primeira resposta                       |

Não há status de atendimento Gmail nem atribuição LinkedIn. A origem `inbox_channel_occurrences` é somente leitura. O registro original é aberto na Inbox, sob as permissões normais; corpo, assunto, anexos, credenciais, conteúdo bruto do provedor e provas privadas não são variáveis dos eventos.

## Fronteiras e compatibilidade

- Autor exige Workflows e canal, inclusive sem filtro de contas. Rascunho novo nasce desativado, com configuração viva vazia e rascunho válido; publicar e ativar são ações distintas.
- Executor e cada destinatário são revalidados por workspace, membership ativo, permissões efetivas, deny, escopo de registro e conta atual. Destinatário não recebe administração da conexão nem acesso a Workflows. Responsável vem da conversa atual, sem fallback automático para gestor ou CEO. LinkedIn começa com executor explícito, editável, sempre sujeito à conta pessoal.
- Metadados das contas são limitados a ID e rótulo; cache é separado por usuário/workspace/canal. Conta indisponível não é removida silenciosamente; retirar o último filtro exige confirmação.
- Gmail exige fila incremental persistida antes do cursor; widget exige visitante/sessão e pedido idempotente; Unipile exige envelope assinado, proveniência e identidade canônica. Bootstrap, histórico, self, espelhos e reabertura técnica não geram novo recebimento/transição humana.
- Primeira resposta exige aceite privado confirmado e inbound elegível. Abertura sem inbound, erro/incerto e espelho não contam. Histórico prévio é uma barreira negativa durável. A ocorrência é única por conversa e o dispatch revalida sua prova.
- Chat humano permanece INSERT autenticado/RLS, com escopo publicado own/workspace; team-only não foi habilitado. Gmail resolve a thread pelo usuário, exige view+create e conta própria conectada; IDs e cabeçalhos de resposta são conferidos no provedor.
- UUIDs de composição mantêm a tentativa durante retry e permitem um novo envio intencional de conteúdo idêntico após confirmação. A chave privada compara também destinatários, assunto, anexos e contexto. Aceite confirmado não vira segundo POST por falha de registro.
- Recuperação Gmail roda pelo sync autorizado, em fila privada completa, lotes limitados, lease, backoff e auditoria SQLSTATE. Conta em erro valida primeiro o provedor e a fila canônica restaura connected antes da recuperação. O mecanismo não envia ao provedor nem promove reserva incerta/histórico. Campanhas/exportações não foram alteradas por esse lote.
- Retomadas preservam a data privada da raiz, chave própria determinística e hash, ancestrais, versão, permissões e cutoff. Reativar não revive eventos antigos.

## Banco e liberação

Migrations aditivas 0406–0451 constroem produtores, provas, filas e adaptadores. 0409 fecha a disponibilidade durante a preparação; 0452 retira somente esse gatilho após verificar pré-requisitos e fronteiras privadas. Não habilita regras de usuários. O teste executa o SQL final em uma cópia Docker identificada e compara todos os demais controles: roles, memberships, ownership/ACL/configuração/corpo de funções, grants/RLS de relações, políticas e triggers.

Os bridges técnicos possuem alterações específicas e revisadas de ACL/ownership; isso não é identidade byte a byte de todo o catálogo. Schema CREATE temporário é revogado na transação e o acesso ao auth do sujeito técnico é revertido. Nenhum cargo/workspace real recebe concessões automáticas. As decisões de 28 origens legadas são comparadas para cinco sujeitos; alguns fixtures legados são vazios, portanto essa comparação não comprova um registro positivo de cada entidade.

A 0459 remove os privilégios de tabela herdados dos defaults do Supabase em `inbox_channel_occurrences` e concede a `authenticated` somente as 13 colunas de metadados revisadas. O teste reproduz esses defaults antes da criação da origem e comprova a negação de escrita, TRUNCATE e campos internos, mantendo os produtores e os cinco perfis. Três avaliadores RLS privados têm owner/ACL `authenticated` deliberados: sua chamada direta é protegida pela ausência de USAGE no schema privado; o checklist operacional fixa também assinatura, corpo, configuração e owner, sem alterar sua semântica.

Aplicar a sequência na ordem, com transações, somente após CI da revisão aprovada; não aceitar o draft isolado por cima da revisão local. A publicação deve servir o SHA conferido em `/build-info.json` nos dois domínios. A Ajuda oficial usa o catálogo versionado aplicado pela sessão autorizada no sistema.

## Verificação

`bun run permissions:check` precede os demais gates. Fechamento exige `bun run verify`, `bun run build`, `bun run perf:check` e CI da revisão exata; nenhum limite, timeout ou baseline de permissão é relaxado.

Na CI, os testes são distribuídos em dois executores, mantendo o banco descartável e o isolamento de cada suíte. Cada executor roda permissões antes de tipos, lint e sua parcela dos testes. Um resultado parcial nunca certifica a entrega: o job obrigatório agrega somente os dois resultados válidos, vinculados ao SHA do evento, fingerprint, execução e tentativa, com inventário completo e sem arquivos duplicados. O tempo global inclui desde a primeira verificação de permissões até a conclusão real da agregação; build e desempenho continuam obrigatórios no job final.

As suítes obrigatórias incluem `inbox-execution-postgres`, `inbox-resume-postgres`, `inbox-dispatch-caller-postgres` e `gmail-recovery-postgres`: produtores reais das 13 chaves, worker/provas atuais, três dispatches, cinco perfis, revogação/cutoff, concorrência, reuso de aviso legado, retomada válida/forjada, mesma thread Gmail e recuperação sem resend. Elas usam bancos próprios, PostgREST real e JWTs sintéticos verificados. Provedores de teste são callbacks locais; não representam envios externos reais. A revisão do draft também possui evidências GoTrue separadas, sem substituir a CI portátil.

Não carregar QA no seed oficial, ativar notificações externas ou enviar mensagens reais para produzir evidência de teste. Metadados e telas são validados novamente após publicar; perfis restritos conservam os controles testados.

## Operação e reversão

Cada regra continua configurável e desativada até a publicação/ativação autorizadas. Em incidente, pausar somente as regras novas afetadas e restaurar a revisão do aplicativo pelo fluxo de entrega. Não excluir os recibos, provas ou filas, não reabrir grants para contornar falhas e não reenviar tentativas incertas. Migrations antigas são imutáveis; qualquer correção de banco é aditiva.

Os relatórios de checkpoints deste pacote são históricos, não o estado atual da publicação. O estado público é comprovado pela CI/PR e pelo build-info, com evidências locais fora do produto.
