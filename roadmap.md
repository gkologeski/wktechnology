# LIMPA-NUMERO-ITENS (P, 20–30 min)

- [x] Confirmar falha e corrigir o rascunho vazio nos controles de quantidade, desconto, imposto e percentual de cobrança; preservar gravações e permissões existentes.
- [x] 20 testes passaram, ESLint sem erros, permissions:check sem achados, Ajuda 256/256 e compilação automática OK. Playwright autenticou na tela de negócios e validou Backspace 10→1→vazio→0 nos componentes reais com persistência isolada em memória, sem pageerror. Não valida gravação em negócio real.
- [x] Auditoria de código: ficha `/deals/$id` e etapa de itens do QuoteWizard usam o mesmo editor corrigido; quantidade/imposto/percentual usam LabeledNumber; desconto percentual usa DiscountField. Preço/base/desconto em valor já repassam vazio→null→0 via CurrencyCommitInput; faturas preservam null e serviços/contratos convertem vazio para zero, sem rascunho intermediário. use-line-items (autosave/Concluído/restauração), line-item-draft (limpeza conserva edições posteriores), line-item-write (RLS/retry), billing-model e recompute_deal_value SQL não recuperam dígitos e foram preservados. Prévia da cotação lê o snapshot, sem campo editável; nenhum job usa o rascunho local.
- [x] Ajuda atualizar-negocio v5 e catálogo preparados, hash de autorização atualizado; nenhum schema, grant, policy, configuração ou registro comercial alterado. Um teste novo de campos (5 casos) e um caso adicional de concorrência do rascunho; nenhum arquivo removido. Revisão corrigiu formatação e narrowing apenas no teste.
- [ ] CI integral/publicação e aplicação editorial da Ajuda aguardam liberação do usuário; perf:check falhou por verificação/build desatualizados ou incompletos. verify/build manuais não executados, pois compilação/tipos são automáticos. Validação manual: apagar todo o número em um item de negócio editável, sair do campo, Concluído e reabrir; deve permanecer zero, sem rascunho de dígito antigo. Não reparar valores históricos automaticamente.

# ENDERECO-CNPJ-PRESTADORA (P, 30–45 min)

- [x] Endereço estruturado no cadastro e consulta real por CNPJ/CEP com confirmação antes de substituir dados; campos ausentes são preservados.
- [x] Permissões e isolamento preservados, Ajuda/catálogo/contratos atualizados; 35 testes, permissions:check, lint dirigido e compilação automática aprovados. Playwright autenticado validou consulta GM, confirmação/cancelamento, CEP, criação/edição e leitura; cadastro temporário e vínculo de grupo removidos.
- [ ] Publicação e aplicação editorial da Ajuda aguardam revisão do usuário. Perf global bloqueado por artefatos incompletos/desatualizados; verify/build globais não executados manualmente (compilação e tipos automáticos OK).

# REVISAO-VISUAL-PROPOSTA — pré-visualização visual na Revisão (P, 20–30 min)

- [x] Exibir páginas visuais renderizadas em iframe sandbox na etapa Revisão do assistente de proposta, com botão Ver em tela cheia e dados reais do rascunho.
- [x] Manter texto rico inalterado, estados de carregamento/erro sem dados fictícios, Ajuda v6 e contratos de permissão atualizados.
- [x] Validado via 23 testes unitários, permissions:check (0 achados), help:coverage (256/256), eslint (0 erros) e Playwright autenticado na proposta Brooks (desktop, tela cheia, texto rico e mobile); sem publicar.

# LOGO-CADASTRADO — propostas e cotações (P, 20–30 min)

- [x] Aceitar logos raster inline seguros e priorizar imagem manual; novos uploads até 512 px, sem ampliar originais menores.
- [x] 43 testes, permissions:check, Ajuda 256/256 e lint dirigido aprovados; navegador autenticado exibiu o logo NEXID, sem favicon, e codificou novo envio em 512×160 px.
- [x] Diff revisado; sem publicar ou alterar cadastros/modelos reais. Ajuda v4/v11 preparada para aplicação editorial após revisão; PDF público não testado. Perf global bloqueado por artefatos de verificação desatualizados/incompletos.

# RECONCILIA-INBOX (G, previsão inicial 1–3 h)

- [x] Restaurar pelo CLI o teste exclusivo do draft; preservar a consolidação posterior do Codex nos arquivos compartilhados, sem reverter UI/Ajuda/contratos/harness.
- [x] Conferir journal: todas as entradas do draft já incorporadas, sem renumeração ou SQL aplicado; lock do draft O e zero workflows Inbox ativos/publicados.
- [x] Regressões dirigidas: 198 testes passaram; 17 casos opt-in não executados. Diff sem erros.
- [ ] Gate global de permissões: dois findings herdados em tipos gerados; contratos permanecem reservados ao Codex. Nenhum aceite/publicação/ativação autorizado nesta entrega.

# VINCULA-NEGOCIOS (M, 2–3 h)

- [x] Banco: negócios adicionais na solicitação, validação e gravação (draft)
- [x] Tela Vínculos/Revisão e conferência da origem
- [x] Ajuda v17, contratos de permissão, testes
- [ ] Teste visual na prévia (draft sem dados de exemplo)
- [ ] Aceitar draft / publicar (depende de revisão do usuário)

# DESCARTA-LEGADO (M, previsão 1–2 h)

- [x] Auditar estados e vínculos; preservar contratos e evidências, com descarte append-only.
- [x] Preparar descarte auditável somente de legados pendentes em rascunho, com confirmação, motivo, revisão e idempotência; migrations 0454/0455 aplicadas, nenhum contrato real descartado.
- [x] Interface e Ajuda preparadas; 121 testes passaram (91 PostgreSQL), lint sem erros/6 avisos, Ajuda 256/256, compilação automática OK.
- [ ] Fechar contrato de permissões de listagem e ações em lote: permissions:check ainda falha em contratos agrupados/barra em lote/contracts.functions.ts; não certificado para publicação.
- [ ] Validar fluxo na prévia autenticada: localhost não respondeu mesmo após reinício supervisionado; nenhum descarte real executado. perf:check bloqueado por artefato de build ausente.
- [x] Registrar aplicação, validações e pendências; não publicar sem autorização. Ajuda oficial no banco ainda não atualizada.

# Pacote 2 — consolidação dos gatilhos multicanal

Catálogo de 13 eventos Gmail/chat/LinkedIn, seleção por conta/canal, produtores/provas, continuidade, recuperação Gmail, UI e Ajuda estão consolidados na revisão local. Nenhuma regra externa é ativada automaticamente. Permissões, perfis restritos e WhatsApp legado permanecem exigências de liberação. Gates, CI e SHA público são comprovados no fluxo de entrega, sem usar checkpoints intermediários como certificação.

Referência atual: [Gatilhos multicanal — contrato de entrega](docs/architecture/workflow-inbox-channels-release.md).

## Histórico dos checkpoints do pacote 2

Os registros abaixo descrevem cada etapa no momento em que foi produzida; as pendências e bloqueios antigos não são o estado consolidado da revisão.

# INBOX-EXECUCAO — pacote 2 (G, previsão 6–10 h)

- [x] GMAIL-RECUPERA (G, previsão 2–3 h): 0449–0451 só draft; fila privada/backfill integral, claims ≤25, auditoria/SQLSTATE/backoff, projeção atômica e recuperação pelo sync antes da descoberta; History não promove aceite. 138 testes dirigidos (28 reais), 0 erros lint/2 avisos; build automático OK. Sem segundo envio/UI/Ajuda/harness/contratos locais/grants de usuário/publicação/aceite/ativação; lock O. Relatório docs/architecture/gmail-automatic-recovery-2026-11-22.md. Contratos/perf/CI anterior permanecem com Codex conforme tarefas abaixo.

- [x] INBOX-FECHAMENTO backend (G, previsão 2–3 h): 0447/0448 somente draft, occurred_at privado e chave determinística de retomada com OID/ACL/dependências preservados; Gmail conversation_id com thread/RLS/view+create/conta própria e headers canônicos/retry estável; chat_scope_insert exatamente 0122 (team-only negado). 124 testes dirigidos (17 GoTrue/RLS) + 123 Gmail locais; UI/Ajuda/harness/contratos locais intocados; sem aceitar/publicar/ativar. Relatório docs/architecture/inbox-functional-closing-2026-11-22.md.
- [ ] INBOX-FECHAMENTO certificação: seis testes novos de root→child/worker, parent/payload 42501 atômico, revogação/versão/cutoff preparados para CI local; tentativa aqui bloqueada por Docker ENOENT. Parent forjado e 17 regressões backend/RLS passaram no draft sem ativar workflows. Gate de permissões segue falhando; matriz 13+worker informada pelo Codex não reexecutada aqui e não certifica a nova retomada.

- [x] INBOX-ACEITE (G, previsão 3–5 h), correções de transporte: aceite Gmail antes de leitura e conciliação append-only (0445/0446 só draft), fingerprint integral Gmail/Unipile, retry legado conservador e recuperação SDR LinkedIn sem reenvio. 123 Gmail + 56 LinkedIn locais; 195 checks de leitura/referência/privacidade em 13 chaves × 5 JWT; 73 Vitest; lint 0 erros/28 avisos; build automático OK. UI/Ajuda/contratos locais intocados; sem grants/ativação/aceite/publicação; lock O. Relatório docs/architecture/inbox-acceptance-review-2026-11-22.md.
- [ ] Certificação INBOX-ACEITE: executar `checkThirteenCurrentProofs` na união CI autorizada com workflows e ocorrências reais; provas positivas de negócio/worker/dispatch e orquestração integral SDR/sequências não certificadas aqui. Gate de permissões falha; compositores com request_id ficam com Codex, legado sem ID continua conservador.

- [x] INBOX-RESPOSTA (M/G, 2–4 h): INSERT real/RLS do chat, recibo AFTER INSERT imutável, comparação só de respostas elegíveis e barreira histórica negativa durável; 0442–0444 somente draft. Revisão INBOX-FECHAMENTO: expansão team em 0442 foi indevida e será revertida aditivamente para 0122; resultado team anterior não certifica preservação do escopo publicado. Demais evidências anteriores: 87 Gmail + 60 guard + 69 Vitest; Playwright enviou pela tela e confirmou 1 ocorrência. Sem novos grants/UI/Ajuda/ativação/aceite/publicação/produção; lock O. Relatório docs/architecture/inbox-response-review-2026-11-22.md.
- [ ] Certificação INBOX-RESPOSTA na união CI/Codex: contratos das migrations/adaptador/handler não fechados (gate falha); perf sem build.json; preservar cenários positivos/negações no worker para 13 chaves antes de liberação.

- [ ] INBOX-PRODUTORES (G, 4–6 h): 0439–0441 aplicadas somente no draft; transportes Gmail humano/SDR e Unipile central integrados, criação Gmail incremental e provas atuais acrescentadas. 62 unitários + 60 guard + 9 chat passaram. Falha Gmail corrigida na fixture autorizada em INBOX-RESPOSTA: cadeia positiva e 87 verificações passaram. Faltam provar Unipile/SDR/sequências e todas as 13 chaves/cinco perfis no worker/CI. Gate falha; contratos não fechados. Evidências Codex recebidas (21 execução, 5 isolamento, 28×5 origens) não foram reexecutadas aqui. Lock/gates/quotas/consentimento/UI/Ajuda/baseline intactos; sem novos grants/ativação/aceite/publicação/produção. Relatório: docs/architecture/inbox-producers-2026-11-22.md.

- [ ] INBOX-GUARD (G, 6–10 h): corrigir gate Workflows+canal com filtro ausente/vazio e rascunho inicial real; provar ciclo criar/editar/publicar/ativar/pausar/reativar, entidade/descarte/atomicidade, cinco JWT. Completar produtores das 13 chaves com recibo privado canônico de envio; Docker do sandbox não bloqueia implementação, CI portátil roda no ambiente do Codex. Sem grants novos, UI/Ajuda/baseline intocados, lock do draft mantido.
- [ ] Revisão 22/11: teste de ativação bloqueada e comparação do catálogo antes/depois de retirar só disponibilidade preparados; 12 casos da suíte não executaram por Docker ENOENT. ESLint passou, consulta EXPLAIN válida e lock do draft O. Primeira resposta exige recibo privado canônico confirmado e retry reconciliado, nunca direction/status do cliente; implementação ainda pendente.
- [ ] Provar três dispatches reais, agendamento, retomadas, concorrência/reuso legado e cinco perfis no próprio dispatch. 0432–0434 aplicadas só no draft; 22 checks reais repetidos 3 vezes após corrigir deadlock (15 recusas RPC nos cinco JWT + legado concorrente), 45 unitários; 16 testes portáveis preparados, não executados por Docker ENOENT. Autorização em 22/11: fixtures publicadas somente na cópia descartável da CI, sem lock nessa cópia; lock do draft intacto. Aceite positivo pendente; relatório docs/architecture/inbox-execution-runtime-review.md.
- [ ] Comprovar equivalência antiga/WhatsApp e OIDs/dependências, sem alterar baseline.
- [ ] Implementar produtores reais das 13 chaves (atribuição/status/primeira resposta confirmada), idempotência e testes portáveis PostgreSQL/PostgREST para CI.
- [ ] Contratos somente após controles e cinco cenários executados; gate segue falhando, baseline intacto. Lock mantido; UI/Ajuda intocadas; sem aceitar/publicar/SQL em produção. CI portátil será executada pelo Codex; Docker ausente neste sandbox não é bloqueador da implementação. Provas completas dos novos produtores/worker e contratos ainda impedem certificação; falha Gmail da fixture foi corrigida.

# CANAIS-ATENDIMENTO — pacote 2 no rascunho (G, previsão 6–8 h)

- [ ] INBOX-CENTRAL (G, 4–6 h): 0422–0431 aplicadas só no draft; Gmail existing-on-retry e atendente Inbox-own sem configuração/central comprovados em 11 checks GoTrue/PostgREST; 16 unitários + 29 Gmail + 9 widget + 6 Unipile. Falta aceite positivo dos três dispatches/retomadas/cutoff, resolvedor agendado, concorrência legada, equivalência antiga e contratos (gate: 46 findings). Relatório: docs/architecture/inbox-central-runtime-review.md. SQL/runtime somente; lock mantido; sem aceite/publicação/produção; UI/Ajuda/transições depois.
- [ ] INBOX-REVISAO (M, 2–3 h): correções preparadas/aplicadas apenas no draft (0415–0421); 66 unitários + 29 Gmail + 9 widget + 6 Unipile passaram, Ajuda v14 preparada/256 telas (aplicação editorial pendente); falta aceite JWT/dispatch/cutoff/Playwright e 33 contratos antes dos gates. Fixtures fora do seed oficial, fail-closed explícito e filtros conscientes. Relatório: docs/architecture/inbox-additional-review.md. Sem aceite/publicação/produção; lock mantido.
- [x] GMAIL-FILA (M): fila antes do cursor, 13 testes unitários e 29 verificações PostgREST/SQL locais; 0410 aplicada só no draft. Gate global mantém 22 lacunas anteriores; Ajuda v3 preparada. Relatório: docs/architecture/gmail-durable-queue-review.md. Sem aceite/publicação.
- [ ] CANAIS-ATENDIMENTO integral (G, 6–8 h): produtores widget/Unipile/atendimento → provas e autorização/dispatch → UI/Central/Ajuda/contratos → JWT/PostgreSQL/regressões. Lock permanece até todos os gates reais; não aceitar/publicar.
- [x] Reparar os OIDs 0405 das duas funções de visibilidade em complemento aditivo 0411, com asserção transacional de OIDs/dependências. Equivalência RLS de todas as fontes antigas ainda pendente.
- [x] Produtores widget/Unipile: RPCs transacionais e integração das rotas, recibos/proveniência privados e imutáveis (0412–0414 somente draft); 37 testes unitários e 9 verificações locais do widget. Playwright não completou a abertura da sessão. Gate ainda falha com 26 achados; pacote integral não concluído.
- [ ] Núcleo de ocorrências explícitas Gmail/chat/LinkedIn com provas privadas e compatibilidade WhatsApp.
- [ ] Produtores duráveis, transições reais e primeira resposta comprovada.
- [ ] Filtros autorizados no editor/central e Ajuda oficial.
- [ ] Contratos, testes locais, gates e relatório verificável; não aceitar/publicar nem tocar produção.

# SEGURANCA-PENDENCIAS (G, previsão 4–6 h)

- [x] Aplicar as 16 proteções pendentes selecionadas e e-mail em massa, sem publicação nem alterações no banco.
- [x] Contratos atuais, 74 testes direcionados e lint sem erros; compilação automática OK. Relatório: docs/security/security-pending-2026-11-21.md.
- [ ] Aceite completo em navegador/CI: prévia localhost sem resposta; perf sem .verification/build.json; Docker indisponível. Não executar envios reais para simular evidências.

# INTEGRIDADE-FORMALIZA — correções de 7d65e33ab (G, previsão 4–6 h)

- [x] Trilha privada persistida/restrita, motivo externo SQL após OTP; Jurídico preparador pode revisar, sem autoaprovar demanda.
- [x] Instrumento pendente/concluído protegido; evidência nativa/ForSign e próxima etapa sem execução; cartão/anexos/prévia corrigidos.
- [x] 77 testes, incluindo 30 SQL com funções reais dos assinadores; Ajuda v7/catálogo/contratos preparados; sem aplicar/publicar/0375/types.
- [ ] Preflight schema integral/CI/aceite visual na união local: aplicação proibida e Playwright timeout. Relatório docs/architecture/hiring-formalization-integrity.md.

# FORMALIZA-SOLICITA — pacote 3, lote 2 (porte G, previsão 6–10 h)

- [x] Auditar lote 1: 23/23 testes repetidos; gate global segue com dois findings preexistentes de tipos WhatsApp. Minutas aceitam origem sem deal/proposal; preparação e assinadores exigem adaptador explícito para compra.
- [x] Identidade definida pelo usuário: token expirável/revogável + código de uso único por e-mail canônico; colaborador pode aceitar seu próprio instrumento; nenhum envio real em testes. Correção local do lote 1 não será sobrescrita.
- [x] Código funcional preparado: origem atual, contrato client/minuta, OTP canônico, jurídico/Financeiro e gates de assinadores; ambos aprovadores revalidados, lote 1 preservado.
- [x] Migrações 0376–0378 somente revisáveis; quatro permissões, invalidação/notificações; ficha/Ajuda v6/catálogo preparados; 42 testes direcionados passam, Ajuda 254/254, lint 0 erros. Sem aplicar/publicar/pacote 4.
- [ ] Revisão e validação integral na união local: bloqueada por aplicação proibida e prévia sem resposta; CI/schema integral/assinadores completos/variantes fornecedor e colaboradores permanecem pendentes. Relatório: docs/architecture/hiring-formalization-package3-batch2.md; não tratar como pedido integralmente validado.

# APROVA-SOLICITA — pacote 3, lote 1 (porte G, previsão 3–5 h)

- [x] Preparar aprovações por revisão/valor e alçada canônica, sem modificar configuração, permissões concedidas ou registros reais.
- [x] Integrar ações, pendências e notificação interna idempotente na ficha existente; preservar wizard e White Label. Navegador não validado: prévia sem resposta.
- [x] 23 testes locais (18 SQL reais + 5 boundary); Ajuda 254/254; ESLint 0 erros/2 avisos; contratos do lote sem findings. Relatório em docs/architecture/hiring-preparation-package3-batch1.md. Gate global bloqueado pelos dois findings preexistentes de tipos WhatsApp; perf sem build.json; verify:changed apenas dry-run.
- [ ] Validação autenticada após revisão/aplicação: bloqueada intencionalmente pela proibição de aplicar migração. Não publicar.

# SOLICITA-PREPARA — pacote 2 (porte G, previsão 3–5 h)

- [x] Código do complemento aprovado preparado e 27 testes locais passaram (M/G, 1–2 h): wizard Demanda → Vínculos → Condições → Revisão; modalidade, necessidade de seleção, liberação e valor isolado por permissão específica; ficha com histórico central e resumo à direita. Sem absorver commit local 1cf5c5a49, alterar WhatsApp, aplicar migração ou publicar.

- [x] Auditar contratos de autorização e entidades canônicas; plano anterior não localizado, escopo literal deste pedido aplicado.
- [x] Migração local preparada, 14 provas SQL reais aprovadas; não aplicada em produção.
- [x] Código de listagem/criação/edição e histórico preparado nas duas entradas, seletores limitados; 19 testes direcionados passaram.
- [x] Menus, breadcrumbs, Ajuda v1/catálogo e contratos preparados; Ajuda 254/254, verify:changed aprovado. Evidências em docs/architecture/hiring-preparation-package2.md; sem publicação.
- [ ] Aceite transacional/visual com JWT real: bloqueado por prévia sem resposta e migração não aplicada por decisão do usuário. Gate global tem 13 achados antigos WhatsApp; perf:check sem build.json. Aplicação de migração/Ajuda e CI aguardam revisão independente.

# CNPJ-ATIVO — conclusão e publicação (porte G, previsão 3–5 h)

- [x] Correção pontual dos totais: migration 0317 aplicada sem alterar dados/RLS, contexto e visibilidade preservados; 11 testes unitários e cenários SQL isolados aprovados. Navegador autenticado mostrou sete empresas, totais completos e edição de Fluxo. permissions:check sem achados, Ajuda 248/248, build automático OK. perf:check indisponível por ausência de .verification/build.json.
- [ ] Publicar a correção pontual e conferir a versão pública; isso não certifica as pendências gerais de vínculo universal abaixo.
- [ ] Auditar controles e completar seleção de CNPJs ativos preservando históricos.
- [ ] Completar vínculo por origem/padrão nos registros operacionais, sem substituir vínculos existentes.
- [ ] Regularizar contratos de permissão, testes e artigos da Ajuda sem regenerar baseline.
- [ ] Validar fluxo autenticado, segurança e publicação; conferir versão pública.

# FLUXO-MODELOS — revisão dos alertas (porte P, 25–40 min)

- [x] Conferir os alertas no código atual; workflows já corrigidos no pacote FLUXO-VISIVEL.
- [x] Preservar escolhas de variáveis extras ao salvar campanha pausada, sem substituir público ou iniciar disparos.
- [x] 25 testes direcionados, permissions:check e cobertura Ajuda 246/246 aprovados; lint 0 erros/8 avisos existentes, build automático OK, hash do contrato conferido. Navegador autenticado mostrou cinco workflows e histórico com 20 execuções, sem pageerror; campanhas renderizadas. Ajuda versão 5 aplicada com autorização editorial e leitura de confirmação. Alerta de workflows obsoleto; persistência corrigida e testada no handler sem editar campanhas reais. Não publicado; salvar/reabrir campanha real não executado para evitar mudanças nos destinatários.

# FLUXO-VISIVEL — carregamento de workflows (porte P, 20–30 min)

- [x] Separar lista e histórico; exibir falha recuperável sem confundir com ausência de workflows.
- [x] Limitar consultas ao workspace ativo e workflows visíveis, preservando RLS; histórico usa índice existente por workflow.
- [x] 27 testes, permissions:check, cobertura 246/246 e navegador autenticado aprovados; Ajuda versão 4 aplicada e conferida. Build automático OK; lint sem erros (3 avisos). Sem alteração de automações, RLS, grants ou schema; não publicado. Perf:check indisponível por ausência de .verification/build.json.

# Roadmap — Complementos sem disparos (06/11/2026, porte G, previsão 4–6 h)

- [x] Auditar integração: etapa 6B e artigo People versão 2 já presentes; não duplicar ou reaplicar migrations.
- [x] Remover dependência DNS indisponível dos avatares sem alterar logos manuais.
- [x] Paralelizar alertas financeiros e exibir falhas sem confundi-las com lista vazia; navegador confirmou 21 alertas.
- [x] Conferir novos números pelo fluxo oficial sem revelar credenciais ou enviar mensagens: ambas as WABAs recusadas pela Meta (400/100), sem cadastro persistido.
- [x] Validar distribuição em testes isolados, sem criar Leads/Contatos reais: testes de regras, autorização e guarda de submissão aprovados.
- [x] Conferir trilhas e reconciliação com sessão autorizada: sete trilhas com seis artigos e painel Lotes assistidos renderizados.
- [ ] Quiz completo e capturas higienizadas definitivas: ainda não executados; não usar dados comerciais para fabricar evidências.
- [ ] Validar permissões, testes e cobertura; publicar e conferir a versão servida.
- [ ] Revisão final por lideranças e eventos assinados dos novos números: dependem de responsáveis externos.
- [ ] Desempenho global/SQL: perf:check bloqueado por .verification/build.json ausente; Docker não disponível para PostgreSQL descartável. Validação automática atual: build OK; 69 testes direcionados, ESLint e permissions:check aprovados; ajuda 246/246.

# Roadmap — Ajuda Fase 3: trilhas, quiz e selo (porte M)

- [x] Trilhas por papel, progresso próprio, quiz de 5 perguntas por módulo e selo; tabelas com RLS do próprio usuário
- [x] Artigo da Ajuda, cobertura 246/246, permissions:check, testes e publicação
- [x] Catálogo oficial aplicado no app pela sessão do editor (216 novos, 3 atualizados, 206 preservados; 425 artigos); trilhas com 6 artigos cada

# Roadmap — Fase 2 integral da Ajuda (porte G, 12–18 horas)

- [x] Auditar e redigir TechProjects, TechFinance, Core e Administração; preservar 208 artigos existentes
- [x] Revisar fatos, permissões, vínculos, cobertura 244/244 e divergências sem alterar funcionalidades
- [x] Disponibilizar 424 artigos neste rascunho e validar aplicação editorial, repetição, leitura/busca autenticadas
- [x] Executar auditoria de acesso inalterada, permissões, lint dirigido e testes da Ajuda; suíte global: 2556 aprovados, 7 arquivos bloqueados por Docker ausente
- [ ] Validação SQL completa/CI e fluxos complexos: bloqueado, ambiente sem Docker; auditoria funcional por rota não certifica cada operação
- [ ] Capturas operacionais definitivas e revisão de permissões alternativas: sem exemplos operacionais preparados; min_permission escalar preservado
- [x] Rascunho aceito, catálogo aplicado e app publicado

# Roadmap — Ajuda do TechContracts (porte G, 4–6 horas)

- [x] Auditar telas oficiais, funcionalidades, permissões e divergências sem alterar operação
- [x] Escrever 52 artigos: visão geral, início, referência, permissões, erros, FAQ e howtos
- [x] Registrar conteúdo em nova migration idempotente; cobertura 11/11
- [x] Validar permissions:check, 13 testes da Ajuda, ESLint, drizzle-kit check e leitura autenticada
- [x] Registrar evidências e imagens pendentes em docs/help; auditoria mantém os 39 apontamentos anteriores
- [ ] Capturas definitivas para treinamento (aguarda preparação de exemplos sem dados pessoais)
- [ ] Aceite/publicação e revisão operacional da equipe (aguardam usuário)

# Roadmap — Contratação etapa 6 (registro consolidado)

- [x] Prévia versionada, aprovação gestor → CEO e execução por origem para renovação, substituição e encerramento.
- [x] Controle de documentos, vigência, acesso por datas, escopo e bloqueio dos atalhos legados.
- [x] Plano financeiro separado com seleção explícita de compromissos futuros; pagos, cobranças, medições e competências trabalhadas protegidos.
- [x] Conciliação assistida em lotes e reversão que preserva edições posteriores.
- [x] Migração preliminar preservada; adoção aditiva 0321/0328 aplicada sem operações reais; complementos 0329/0330 validados.
- [x] Verificação global integrada: 2.744 testes, tipos e lint sem erros.
- [ ] Aceite visual transacional com sessão real: não executado; cenários operacionais exercitados em PostgreSQL descartável.

Arquitetura e limites: `docs/architecture/hiring-integration-stage6.md`. A publicação e a conferência dos domínios são registradas no relatório de entrega da etapa 6.

# Roadmap — Importação do ClickUp para o TechProjects (porte G)

- [x] Leitura completa do ClickUp (11 workspaces, 16.477 tarefas) e proposta de organização
- [x] Chave do ClickUp removida do campo "lista padrão"
- [x] Projetos repetidos unificados (OS - Citel, OS - Quantity, OS - IXC, OS - InForma) e empresa "In Forma" unificada em "InForma", com cópia para desfazer
- [x] "In Forma Software" do CRM unificada como "InForma" e "Outsourcing -> InForma" juntado em "OS - InForma"
- [x] Tabelas de preparação/vínculo e motor de importação (Dailys como tarefas, Byteway como projeto novo de Consultoria, sem workspaces de teste)
- [x] Tela de revisão, vínculo de responsáveis com TechPeople e "Desfazer importação"
- [x] Permissões novas e testes (permitido, sem chave, negado, outro workspace, inativo)
- [x] Importação aplicada: 16.474 tarefas, 12 projetos e 3 espaços novos (desfazer testado sem efeito real)
- [x] 3 responsáveis do ClickUp cadastrados sem acesso (Adauto Lucas, Eduardo Gonçalves, Thiago Mandrik) e ligados às 84 tarefas
- [x] Ficha do projeto carrega 50 tarefas por coluna com "Carregar mais"; lista de Tarefas paginada e rápida
- [x] Checagem de permissões sem pendências
- [ ] Publicação (aguarda aceite do usuário)

# Roadmap — Reorganização da tela /agents/sdr (porte G, em pacotes)

- [x] Pacote 1: 9 abas viram 3 áreas (Operação, Estúdio, Resultados) com seções, endereço por `?section=`, cabeçalho padrão e "Novo agente" levando ao Playbook (com permissão de criar)
- [x] Pacote 2: Estúdio integrado — barra única do agente aberto (endereço `?agent=`), conversa de teste fixa à direita em todas as seções do Estúdio, Playbook segue o agente aberto
- [x] Botão "Duplicar agente": copia playbook, configuração, ferramentas e persona (como rascunho); cópia desativada, sem número de WhatsApp e não principal
- [x] Duplicação testada de verdade: cópia idêntica (playbook e persona em rascunho), desativada, não principal; cópia de teste apagada em seguida
- [x] Pacote 3: Operação com indicadores (Para revisar, Falhas, Em conversa, Com humano) e "Em atendimento" com nomes, agente, situação/etapa em português, filtros por situação e atalho para a conversa
- [x] Pacote 4: Resultados com totais contados no banco (antes truncados em 500), funil, reuniões reais com anfitrião/horário, reuniões aguardando ação e qualificações
- [x] Conferência no celular e no modo escuro (corrigida rolagem lateral das tabelas no celular)
- [ ] Publicação (aguarda aceite do usuário)

# Roadmap — Lia obedece à persona publicada (refatoração SDR)

- [x] Prompt em seções: contrato técnico, precedência, persona publicada na íntegra, controles, complemento, contexto verificável
- [x] Remover regras fixas, respostas fixas e reescritas editoriais (worker, persona, guards, terceiros)
- [x] Estado explícito da conversa com CAS no commit (0184) + prova isolada com corrida
- [x] Descadastro só explícito; recusa comercial encerra sem bloqueio permanente
- [x] Agenda: até 3 novas opções após recusa (configurável), e-mail escrito pelo cliente
- [x] Automação "pergunta sobre IA" opcional e desligada
- [x] Pipeline único produção/teste com trace; teste com rascunho ou publicada
- [x] Testes com saídas programadas + verify/build + Playwright no estúdio
- [ ] Comparação A/B com IA real além de poucas mensagens no teste (custo/escopo; aguarda decisão do usuário)
- [ ] Publicação do código (aguarda aceite do usuário)

# Roadmap — TechProjects Ciclo 6 (itens 14–15)

- [x] Banco 0179: API sob RLS do dono da chave (papel sem login), idempotência, limite por chave, fila offline idempotente, competência fechada na criação, painel de operação, higiene de privilégios
- [x] Provas: SQL isolada C6 + concorrência; HTTP com GoTrue/PostgREST reais; regressões C1–C5
- [x] Servidor: rotas v1 (projetos, tarefas, apontamentos, OpenAPI), saúde/prontidão, webhooks com guarda SSRF/assinatura/sem redirecionamento, assistente somente leitura
- [x] Telas: fila offline (Minhas Horas + janela de apontamento), assistente no painel, Operação e saúde
- [x] Fluxo integrado não admin (negócio→…→painel) em banco isolado
- [x] Desempenho: 1 milhão de apontamentos / 100 sessões em banco isolado (0180/0181); visão de equipe sob carga mista ainda acima da meta
- [x] Ensaio de backup/restauração em banco descartável + runbook
- [x] Playwright (claro/escuro/celular/teclado/offline), verify e build completos
- [x] Documentação, AGENTS e relatório unificado C1–C6
- [ ] Visão "Equipe" do admin com 1 milhão de apontamentos e 100 sessões mistas: p95 ~9,8 s (meta 2 s) — precisa de consumo por projeto pré-calculado (decisão de arquitetura)
- [ ] Teste no navegador com usuário comum real e chave de API real (só provado em banco isolado; nenhuma conta/chave real criada)
- [ ] Backup gerenciado: conferir no painel o horário do último backup; PITR/RPO 1 h/RTO 4 h/99,9% exigem plano e monitor externo (não contratados)
- [ ] Webhook real: aguarda destino autorizado por administrador
- [ ] Publicação (aguarda aceite do usuário)

# Roadmap — TechProjects Ciclo 4 (itens 10–11)

- [x] Banco: tarifas com vigência, modelo de cobrança (dono por serviço/período), medições, saldo de pacote, vínculo com o Financeiro, guardas entre mecanismos, rentabilidade (0175, correção 0176)
- [x] Provas SQL isoladas (99 + concorrência) e regressões C1 (65) / C2 (83) / C3 (116)
- [x] Servidor: funções de tarifas/medições/rentabilidade; geradores antigos respeitam o dono da cobrança; consolidador antigo de horas desativado
- [x] Telas: Tarifas e custos, Medições do contrato, Medições e rentabilidade do projeto, indicadores da ficha do projeto, origem no Financeiro
- [ ] Cadastrar tarifas, modelos de cobrança e conceder permissões do ciclo 4 (decisão do usuário; nada criado automaticamente)
- [ ] Teste com perfil não admin real e medição real (só provado em banco isolado)
- [ ] Publicação (aguarda aceite do usuário)

# Roadmap — TechProjects Ciclo 3 (itens 7–9)

- [x] Banco: política versionada, modelos por serviço, aprovadores/delegação, alocação com vigência/capacidade, apontamento por duração/segundos/fuso, cronômetro com pausas, envio/aprovação versionados, aceite manual, fechamento/reabertura, prévia Jibble sem horário (0173/0174)
- [x] Provas SQL isoladas (116 + concorrência) e regressão C1 (65) / C2 (83)
- [x] Servidor: funções novas e rotas antigas redirecionadas ao fluxo
- [x] Telas: apontamento, Minhas Horas sem 8h presumidas, timesheet, aprovação, ficha do projeto, configurações, conciliação, capacidade na alocação
- [x] WK: modelos dos 6 serviços ativos (sem BPO/sob medida)
- [ ] Reativar o widget do cronômetro no layout (oculto por decisão anterior; aguarda o usuário)
- [ ] Nomear aprovadores nos projetos WK e cadastrar jornadas no TechPeople (decisão do usuário; envios ficam bloqueados até lá)
- [ ] Materializar os 504 candidatos Jibble sem horário (aguarda revisão humana na conciliação)
- [ ] Teste com perfil não admin real e fluxo de envio/aprovação/fechamento com dados reais (só provado em banco isolado)
- [ ] Publicação (aguarda aceite do usuário)

Pendências preservadas: C1 (68 sugestões, divergência Clockify 12 pessoas, 403 em 5 categorias, Jibble não reconciliado); C2 (ganho real e UI não admin não validados; não publicado).

# Roadmap — Cargo e porte derivados (prioridade atual)

- [x] Auditar fontes, gravadores, gatilhos e candidatos agregados
- [x] Implementar catálogo versionado, derivação e precedência no banco (0142/0143)
- [x] Provar INSERT/UPDATE/UPSERT/clear/legado/isolamento/readonly em banco descartável
- [x] Preparar catálogo v2 e classificador corrigidos; provar HRBP/Business Partner, Product Owner, Partner Manager, desenvolvimento de negócios e Diretor Técnico em 92 assertions SQL isoladas
- [x] Confirmar classificador/catalogo v2 ativo; proteções atuais aplicadas em 0144/0145
- [x] Concluir recalculo: 51.144 Contatos, 5.924 Leads, 32.044 Empresas; fontes iguais ao backup linha a linha e por hashes JSON ordenados
- [ ] Comparar hashes independentes (bloqueado: serialização original desconhecida)
- [ ] Remediar datas/espelhos históricos com cadeia auditável; bloqueado por falta de prova de ausência de edições posteriores, não restaurar cegamente
- [x] Integrar fichas, filtros, grids, públicos, exportação e lookup
- [x] Validar testes, lint e sinais completos de compilação; documentar resultados
- [x] Playwright autenticado: lista real e ficha HR Business Partner / Recursos humanos / Especialista
- [ ] Prova isolada REST/JWT completa (não executada nesta continuidade)
- [ ] Publicar app (bloqueado até verificação do usuário)

# Roadmap — Lia: ferramentas e agendamento direto

- [x] Catálogo de habilidades/ferramentas, executor e laço de ferramentas no turno
- [x] Agendamento direto (consulta real, 3 opções, recusa, data específica, reserva com trava, conciliação) e remoção do link /book/
- [x] Aba "Habilidades e ferramentas" + teste simulado + registro
- [x] Rascunho v7 da Lia configurado (anfitrião Guilherme)
- [ ] Publicar v7 da Lia (aguarda revisão do usuário)
- [ ] Agenda Microsoft 365 (sem conexão Microsoft no sistema)
- [ ] Plano multicanal pendente (preservado)

# Roadmap — Correção dos cargos da WK

- [x] Fase 0 — foto do estado atual e reversão (0122)
- [x] Fase 1 — permissões só para membro ativo; cargos só por admin; aprovação de perfis só pelo líder (legado fechado, override admin com motivo); chat ao vivo por permissão e visibilidade (0122 + servidor)
- [ ] Fase 2 — matriz dos 16 cargos (Apontador, perfis de vaga, denies de Visibilidade total, Rep. Externa, Colaborador Externo, Auditor)
- [ ] Fase 3 — tela /settings/permissions com permissão efetiva, origens, dependências e aviso de admin
- [ ] Fase 3b — botão de override administrativo com motivo no quadro de perfis de vaga
- [ ] Fase 4 — provas isoladas dos cargos, aplicação e leitura das permissões efetivas reais
- [ ] Publicação coordenada (decisão humana)

# Roadmap — Ciclo de contratação/desligamento via Workflows

# Roadmap — Três propostas de Agentes de IA

- [x] Estúdio em /agents/prototype/1
- [x] Assistente de criação em /agents/prototype/2
- [x] Central de operação em /agents/prototype/3
- [x] Navegação, wizard, canvas e cliente com estados locais
- [x] Inspeção autenticada, temas, arquétipos e validações direcionadas
- [ ] Escolha/aprovação visual do usuário (sem ativação real)

- [x] Fase 1 — ações de contratação no motor (validada com candidata de teste)
- [x] Fase 2 — diálogo de desfecho de contratação no TechHire (interna/outsourcing/hunting)
- [x] Fase 3 — modelos nativos (Vendedor PJ, Freelancer, Outsourcing, Hunting, Desligamento)
- [x] Fase 4 — desligamento: gatilho Pessoa desligada + encerrar contratos, alocações, acesso e parcelas
- [x] Fase 5 — specs Playwright em tests/e2e + validação real dos cenários

# Roadmap — Papel Representante de Vendas (externa)

- [x] Fase 1 — leitura no banco respeita escopo do cargo (leads, contatos, empresas, negócios, atividades, cotações)
- [x] Fase 2 — leitura vinculada (empresa/contatos ligados aos registros dela)
- [x] Fase 3 — cargo "Representante de Vendas (externa)" só TechSales
- [x] Fase 4 — aviso ao responsável da empresa (notificação); exportação oculta por permissão
- [x] Fase 5 — validação por papel

# Roadmap — Cotação → Proposta → Contrato

- [x] Fase 1 — ligação entre etapas e botões de geração
- [x] Fase 2 — campo Linha de serviço na cotação (seções sugeridas na proposta)
- [ ] Fase 3 — modelos de proposta/contrato por linha
- [x] Fase 4 — itens da cotação viram serviços do contrato
- [ ] Fase 5 — atalho de aditivo para cliente com contrato ativo
- [x] Fase 6 — textos da tela de Propostas
- [ ] Fase 7 — teste real de conversão (aguarda autorização para gravar dados)

# Roadmap — Redesign da Inbox multicanal

- [x] Direção visual aprovada: cockpit multicanal com identidade White Label
- [x] Direção final aprovada: Floating soft panels v3, Sora + Manrope e superfícies fluidas
- [x] Casco compartilhado com canais no topo e painéis amplos para lista, conversa ativa e contexto
- [x] Estados, acessibilidade e responsividade das quatro rotas
- [x] Validação visual e funcional das quatro rotas em desktop, mobile e modo escuro

# Roadmap — Associação de clientes na Inbox

- [x] Resolver remetentes por telefone ou e-mail dentro do workspace
- [x] Priorizar Contato e usar Lead somente quando nenhum Contato corresponder
- [x] Sinalizar duplicidades sem associação automática e permitir escolha manual
- [x] Aplicar em WhatsApp, Email e Chat ao vivo, preservando associações manuais
- [x] Incluir os três canais e nomes de Leads na Inbox unificada
- [x] Atualizar conversas existentes com correspondências inequívocas

# Roadmap — Notificações da Inbox e timeline

- [x] Notificar mensagens recebidas atribuídas em WhatsApp, E-mail e Chat ao vivo
- [x] Atribuição manual e filtros por responsável nos três canais
- [x] Distribuição automática opcional para os três canais
- [x] Rolagem proporcional das laterais nas fichas de Lead, Contato, Empresa, Negócio e Ticket

# Roadmap — Inbox: janela de 24 horas, avisos e layout

- [x] Bloquear envio livre de WhatsApp fora da janela de 24 horas no servidor
- [x] Sugerir e enviar somente templates Meta aprovados fora da janela
- [x] Avisar somente na primeira mensagem não lida e fora da Inbox
- [x] Corrigir cortes com três painéis fluidos em desktop e mobile
- [ ] Validar código, testes e fluxo visual

# Roadmap — Agentes de IA: paridade ChatSuite (docs/agents/chatsuite-parity.md)

- [x] Catálogo único de blocos com editores próprios, saídas, validação e resumo
- [x] Executor de fluxo com trace, validação de grafo e ferramentas simuladas (testado)
- [x] Três protótipos usando o mesmo contrato; chat de teste roda o executor
- [ ] Persistência multiagente com rascunho/publicado e rollback (migração aditiva)
- [ ] Seletores reais do workspace (agendas, equipes, funis, fontes, conexões)
- [ ] Executor ligado ao inbound de produção, métricas por agente/versão/origem
- [ ] Ingestão de conhecimento (upload, trechos, validade) e perguntas sem resposta
- [ ] HTTP no servidor com cofre; integrações externas (dependem de credenciais)
- [ ] Modelos de fluxo, regras de ativação, supervisor/treinador/regressão

# Roadmap — Perfis de vaga no negócio (TechSales → TechHire)

- [x] Banco: perfis, comercial restrito, versões imutáveis, eventos, anexos privados, links do cliente, propostas, encaminhamentos, modelos, importações
- [x] Aba "Vagas e perfis" com assistente em 6 etapas, ficha, histórico, diff, modelos, duplicar
- [x] Aprovação com mínimos, encaminhamento idempotente com autorização antecipada, sincronização explícita
- [x] Link seguro do cliente (somente campos liberados, revisão interna)
- [x] Importação com IA (texto, URL, DOCX, PDF, imagem, conversas do negócio)
- [x] Testes: unitários, banco com rollback, navegador ponta a ponta
- [ ] Liberar as novas permissões para cargos não administradores (decisão do usuário)
- [ ] Apagar 3 arquivos fictícios de teste no armazenamento privado (exige ação de armazenamento)

# Roadmap — Performance ciclo 1

- [x] Sprint 0 — baseline (docs/architecture/performance-baseline.md)
- [x] Tempo real filtrado por registro, agrupado e reconciliado ao reconectar
- [x] Pré-carregamento seletivo (módulo, permissão, rede, sem competir com navegação)
- [x] Cache zerado na troca de workspace/usuário/Ver como/saída
- [x] Janelas de atividade sob demanda
- [x] Cache do lint (medido 55 s → 3 s)
- [ ] Medir telas restantes (dashboard, Inbox, Projetos, Prospecção, TechHire)
- [ ] Comando real da verificação automática (inacessível no sandbox)
- [ ] Backlog do próximo ciclo (docs/architecture/performance-backlog.md)

# Roadmap — Persona e teste do Agente SDR

- [x] Auditar a tela existente e os padrões atuais do TechERP
- [x] Redesenhar identidade, voz, atendimento, ações e versões sem alterar comportamento
- [x] Redesenhar a conversa de teste segura para desktop e mobile
- [x] Validar visualmente em claro/escuro e desktop/mobile
- [x] Executar tipos, lint direcionado e conferir build automático

- [x] ID 1 (parcial; aguarda decisão sobre Inbox/histórico em cargo restrito): criar conta QA "[TESTE] Validação TechSales" (techerp-permissions-qa@techerp-test.invalid) e validar permissões reais com sessão própria; relatório docs/architecture/task-1-real-user-validation.md
- [ ] Otimização do banco: aguardando decisão do usuário sobre retenção de logs e frequência das tarefas agendadas

# Roadmap — Importador Clockify → TechProjects (WK)

- [x] Migration aditiva: conexão cifrada, execuções, staging, vínculos, mapeamentos, RPC de escrita sem workflows
- [x] Adaptador Clockify somente leitura (allowlist de URLs, 429/Retry-After, Last-Page)
- [x] Motor retomável: inventário → prévia (dry run) → importação em lotes idempotentes com checkpoint/cancelamento
- [x] Segmentação por dia no fuso (meia-noite/DST), segundos preservados, sobreposições e timers abertos em staging
- [x] Mapeamento de usuários/clientes/projetos com revisão manual
- [x] Tela em /projects/settings/imports/clockify + item no menu e na central de importações
- [x] Testes com fixture (sem chamadas reais) e guia de migração
- [x] Teste lista workspaces reais com papel verificado (proprietário/admin/sem admin/não verificado); prévia bloqueada sem admin comprovado; origem escolhida manualmente por ID
- [ ] Conectar Clockify e escolher "WK Technology" por ID confirmado (bloqueado: aguarda o usuário colar a chave na tela; ele se declarou administrador, o teste da chave comprova)
- [ ] Rodar inventário/prévia real (bloqueado: depende do item acima)
- [ ] Importação real (bloqueado: aguarda prévia conferida pelo usuário)
- [ ] Agendar tick em segundo plano (bloqueado: depende de publicação aprovada)

# Roadmap — Importador Jibble → TechProjects (WK)

- [x] Validar endpoints na documentação oficial (OAuth, OData, async 202/303)
- [x] Tabelas multi-provedor `time_import_*` com RLS admin-only e desfazer protegido (0160–0162)
- [x] Cliente somente leitura (allowlist, nextLink, reautenticação, 429/5xx, export assíncrono)
- [x] Reconstrução In/Out/pausa, virada de dia/DST, conciliação com timesheets, duplicidade entre fontes
- [x] Motor retomável (prévia, recálculo, importação, desfazer) + tela + menu + agendador compartilhado
- [x] Testes (urls/cliente/reconstrução/conciliação/mapeamento/motor) e prova de acesso no banco
- [ ] Conectar o Jibble (bloqueado: aguarda o proprietário criar Client ID/Secret e colar na tela)
- [ ] Confirmar papel Owner/Admin e organização pelo ID (bloqueado: depende da conexão)
- [ ] Confirmar com dados reais o formato das pausas (não documentado na coleção pública)
- [ ] Prévia real, revisão de mapeamentos/duplicidades e importação (bloqueado: depende da conexão)
- [ ] Download privado de capturas de tela (não implementado; exige aprovação de armazenamento)
- [ ] Agendar o avanço em segundo plano (exige publicação aprovada)
- [x] Referência do nome da organização Jibble "WK" registrada (só destaca; seleção continua por ID + papel Owner/Admin)

# Clockify — catálogos

- [x] 82 tags, 6 grupos e 99 clientes concluídos (0163–0165)
- [ ] Revisar manualmente 5 membros de grupos sem pessoa mapeada (aguarda decisão do usuário)

# Roadmap — TechProjects Ciclo 2 (negócio ganho → entrega)

- [x] Banco: vínculo direto/relacional negócio↔projeto, política por workspace, fila com retry/lease, eventos/revisões, guardas de coerência
- [x] Ação central criar-ou-vincular (trigger de transição, worker no banco, ação de workflow)
- [x] Telas: negócio (Entrega/Preparação), projeto (origem), empresa, contrato, política, central › Negócios
- [x] Histórico: candidatos com explicação, vínculos exatos auditados/reversíveis, prévia e lote, criar faltante
- [x] Prova isolada SQL/RLS + testes + verify/build + Playwright; ativar política WK sem replay
- [ ] Prova ponta a ponta de um ganho real no WK (aguarda o primeiro negócio ganho de verdade; não criei negócio de teste no WK)
- [ ] Publicar (aguarda revisão do usuário)

# Roadmap — Telefones no padrão E.164 (todos os módulos)

- [x] Núcleo único `src/lib/phone/e164.ts` (libphonenumber max) + testes
- [x] Banco 0186: país padrão por workspace, ramal, backup/revisão, guarda opcional
- [x] Campo de telefone compartilhado (país, colagem, ramal, erro PT-BR) e país do workspace
- [x] Trocar entradas nas telas (CRM, ATS, People, Core, públicas, propriedades, edição em massa)
- [x] Servidor: APIs, importações, integrações, workflows, agentes, MCP
- [x] Canais: WhatsApp/voz continuam reconhecendo números antes/depois
- [x] Varredura WK: simulação → aplicar só seguros com backup → revisão
- [x] Tela de revisão/contagens e configuração do país
- [x] Docs/AGENTS
- [x] Testes (1.344), tipos, lint dos arquivos alterados, build e Playwright (desktop claro/escuro, celular, teclado)
- [x] Ligar a guarda do banco (`phone_strict_e164`) após publicação; importações gravam vazio quando o telefone não está no padrão
- [x] Limpeza autorizada: até 4 dígitos em branco (10.671) + 163 padronizações seguras, com backup
- [x] Fila reconcilia varredura e correções (6.416 pendentes reais)
- [x] Revisão por administrador dos 1.252 celulares antigos sem o 9 (tela + proteção no banco + provas)
- [ ] Administradores decidirem os 1.252 itens na tela (decisão humana, um a um)
- [ ] Demais 5.164 pendentes: corrigir na ficha do registro (decisão humana)
- [x] Publicação (23/10/2026)

# Roadmap — Campos de data (skill date-picker-br)

- [x] Inventário salvo (docs/architecture/date-fields.md): 89 controles em 61 arquivos + exceções justificadas
- [x] Controle único: DatePicker/DatePickerPanel + IsoDatePicker; data-hora usa o mesmo painel
- [x] Migração dos 6 módulos, Core, públicos e dinâmicos; "hoje" local nas telas convertidas
- [x] Guarda de regressão + testes (fusos, verão, bissexto, limites, atalhos, data-hora)
- [x] verify, build e navegador (amostra por módulo, teclado, celular, escuro)
- [ ] Formulário público com data no navegador (não há formulário com data cadastrado na WK; coberto por teste)
- [ ] Publicação (aguarda aceite do usuário)

# Roadmap — Indicação ignorada no follow-up (Bruna/DSIN, porte M)

- [x] Indicação por e-mail ou só pelo nome reconhecida e registrada (Lead para revisão ou nota)
- [x] Retomadas suspensas para quem indicou; retomada quase igual à anterior é cancelada
- [x] Ajuste no prompt (classificação da indicação e não repetir retomada)
- [x] Rodrigo Paiola: indicação do Bruno registrada (contato Bruno Silva já existia), sem novas retomadas
- [ ] Publicação (aguarda aceite do usuário)

## PROPOSTA-EMAIL

- [x] Envio da proposta por e-mail + botão copiar link para aprovar (preview)
- [ ] Publicar; atualizar artigo Ajuda v3 no app

## ACEITE-MINUTA

- [x] Entrega 1: substatus "Enviar minuta de contrato"/"Minuta enviada" + workflow rascunho "Proposta aceita → Contratação"
- [ ] Entrega 2: aprovadores jurídicos em Fluxos de aprovação, tela Revisar minuta, permissão nova
- [ ] Entrega 3: envio automático pela conta do responsável, link público Aceitar/Pedir ajustes, gate do Gerar contrato
- [ ] Decidir: workflow "Criar contrato" dispara ao entrar em Contratação (conflita com minuta)

## CONDICOES-PAGAMENTO (plano aprovado 10/11/2026)

- Decisões: contas a receber na ativação do serviço; antigas migram das parcelas atuais.
- [x] Fase 1a: regra pura do cronograma (`src/lib/sales/payment-terms.ts`)
- [x] Fase 1b: colunas (0325) + grants por coluna (0326) + preenchimento das antigas
- [x] Fase 2: etapa na cotação + vencimento da entrada (assinatura ou data)
- [x] Fase 3: proposta (editor, bloco Condições comerciais, PDF pelo texto)
- [x] Fase 4: contrato recebe as condições + cartão na ficha
- [x] Fase 5: contas a receber na ativação do serviço (0327 `service_activate_with_terms`)
- [x] Fase 6: Ajuda `definir-condicoes-de-pagamento` + permissões
- [ ] Validar na tela: proposta → contrato → ativação com dados reais; publicar

- [x] PRAZO-MENSAL: mensalidade recorrente × prazo; prazo mínimo 3 meses e aviso prévio 30 dias editáveis
- [x] MINUTA-BLOQUEIO: bloquear "Criar contrato" até minuta aceita; dispensa do aceite do cliente

- [x] INICIO-EXECUCAO (pacote 4, lote A): início governado + origem profissional direta — preparado/testado; 0381 não aplicada
- [x] ENTREGA-FISCAL (pacote 4, lote B): entregas/aceite versionado + documentos fiscais privados — preparado/testado; 0382 não aplicada; bucket não criado
- [ ] Pacote 4 lote C: contas a pagar, provisão separada, sem pagamento automático
- [x] Pacote 4 lote C1 (PLANO-PROVISAO): plano econômico, cálculo elegível e provisão gerencial — preparado/testado; 0383 não aplicada.
- [x] Pacote 4 lote C2 (PARCELA-CONCILIA): parcelas canônicas, conciliação de legado, aceite do cliente final e integridade de fontes — preparado/testado; 0384 não aplicada.
- [ ] Revisão independente A/B/C1/C2, conciliação com revisões locais e plano completo, CI integral e preflight (Codex).
