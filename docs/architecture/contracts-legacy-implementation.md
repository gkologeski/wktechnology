# LEGADO-REGULARIZA — contratos legados no importador e na ficha

Base: `50f3300ae`. Revisão local em `codex/legacy-contracts-hardening`. Pacote 5 (Segurança) e publicação do protótipo de 18/11 vêm depois; não confundir com a antiga etapa 5 ATS.

## Auditoria (somente leitura)

- `import.functions.ts › createContractFromImport` sempre grava `status=draft`; `contract_process_guard` impede status manual.
- Produção (contagem, sem dados copiados): 66 contratos com `source_file_path`, 18 em rascunho, todos com `imported_from`; há casos sem contraparte, sem entidade WK e um ano `0025`.
- `contract-next-step.ts` e `ContractSignatureCard` tratam todo contrato como novo; `contract_accepted_draft_guard` (0356) exige proposta + minuta aceita ao vincular negócio a contrato `provider`.
- Origem importada, `metadata` ou `imported_from` NÃO comprovam assinatura.
- Efeitos colaterais de status: `contracts_release_service_billing_trg` libera cobranças de serviços com `billing_hold` quando o contrato passa a "assinado"; `enqueue_workflow_event` publica `updated` (hoje a única automação ligada a contratos escuta etapa de negócio).

## Lotes

| Lote | Escopo | Estado |
| --- | --- | --- |
| A | Núcleo SQL 0385, modelos, servidor, testes | preparado (este) |
| B | Server functions finas, painel na ficha (trilha central, ações à direita), próximo passo e cartão de assinatura cientes de legado; reforços do núcleo A | preparado |
| C | Importador (marcar legado pendente pela mesma RPC, sem classificar automaticamente) e Ajuda | pendente |
| D | Inventário assistido dos 18 rascunhos importados (ação humana, sem lote automático) | pendente |
| Financeiro | Liberação de cobrança de legado: fluxo próprio do Financeiro | fora deste pacote |

## Lote A — decisões

- Migração `drizzle/migrations/0385_contract_legacy_regularization.sql`, fora do journal, não aplicada.
- Classificação vive só em `contract_legacy_records` / `_evidence` / `_events` (sem grants ao Data API; leitura e escrita por RPC definer).
- Chaves novas, sem grants automáticos: `techcontracts.legacy_contracts.view|create|approve.workspace`. Toda ação exige workspace ativo, membro ativo no workspace ativo, acesso real ao contrato (`work_context_access` view; update para escrita), chave própria com deny prevalecendo, e recusa "ver como" somente leitura.
- Origens protegidas recusadas: `hiring_request_origin`, proposta/cotação/minuta aceita, qualquer assinatura em curso ou concluída (campos de assinatura, pacotes, entregas e-sign, ForSign, evidência de contratação), status diferente de rascunho, ou sem arquivo importado.
- Mesmo contrato preservado: id, `source_file_path`, `body_html`, partes e vínculos. A regularização só define status, `signed_at`, vigência e renovação, guardando os valores anteriores na trilha.
- Evidência: PDF privado separado no bucket existente `contract-signature-evidence` (escrita só pelo servidor), caminho `legacy-contracts/<w>/<c>/<id>.pdf`; nunca sobrescreve o DOCX/PDF importado. Reserva pelo usuário → servidor grava, relê e calcula SHA-256 → `contract_legacy_evidence_attest` (somente service_role) revalida autor e autoridade. Hash é integridade, não autenticação jurídica.
- Regularização: revisão esperada, replay exato (mesmo `operation_id` + mesmo conteúdo) e conflito para reuso divergente; impressão digital do documento invalida ações se o contrato mudar após o reconhecimento (rebase explícito supera evidências antigas).
- Situações: em vigor → `active`, encerrado → `ended`, rescindido → `terminated` (status canônico, sem segundo ledger). Datas plausíveis (≥ 1990, fim ≥ início, assinatura ≤ hoje), data da assinatura humana confirmada explicitamente, renovação automática exige conferência.
- Vigência futura é bloqueada: não há status `scheduled`. Adicioná-lo exige inventário dos consumidores do enum (cobrança, dashboards, workflows, ATS) antes — decisão pendente.
- Sem efeitos financeiros: recusa contratos com serviço em `billing_hold`; nenhum serviço, título, pagamento, proposta, minuta, assinatura ou grant é criado.
- Guarda comercial: `contract_accepted_draft_guard` passa a aceitar vínculo de negócio somente para legado regularizado e validado (evidência usada), mantendo proposta, papel e tipo inalterados. Pendente não contorna.
- Após regularizar, documento e termos conferidos ficam imutáveis (mudanças por aditivo); trilha não pode ser alterada nem apagada.
- Compras antigas não viram solicitação de contratação retroativa.

## Validações executadas (lote A)

- `bun run permissions:check`: sem achados.
- `bun run typecheck`: sem erros.
- `bunx vitest run src/lib/contracts/legacy-postgres.test.ts src/lib/contracts/legacy-types.test.ts`: 37/37 em PostgreSQL 17 descartável nativo (cinco cenários para reconhecer, reservar, atestar, regularizar e consultar; acesso real ao contrato; ver-como; acesso direto e classificação forjada; origens protegidas; replay/conflito; concorrência; revisão/hash/documento alterado; arquivo privado/atestado forjado; datas; ausência de efeitos financeiros; imutabilidade e guarda comercial).
- Não executados: `verify`, `verify:changed`, build, Playwright, aplicação em banco real.

## Limites conhecidos

- O fixture usa tabelas sintéticas mínimas para assinatura/serviços e um stub de `service_release_signature_billing` que registra qualquer liberação; os demais gatilhos reais de `contracts` (hiring, handoff, workflow, auditoria) não foram carregados no teste e precisam de revisão no preflight.
- Escopo de equipe (`.team`) vale no caminho do usuário; no atestado de serviço só são revalidadas as chaves `.workspace`/`.own`.
- As funções definer precisam ser criadas pelo papel dono que contorna `contract_process_guard` (postgres no Supabase), como nas migrações anteriores.
- `contract-next-step` e `ContractSignatureCard` ainda não reconhecem legado (lote B).

## Lote B — entregue

- `legacy.functions.ts` (finos, `requireSupabaseAuth`) → `legacy.server.ts` com o cliente do usuário. Upload: valida PDF real, reserva pela RPC do usuário e só então grava/relê/atesta com o serviço no caminho devolvido; replay não reatesta. Download: RPC `open` do usuário e URL assinada de 60 s.
- Leitura distingue negação (sem chave) de falha: falha mostra erro e oculta aprovação/assinatura; nunca vira "não legado".
- Ficha: painel "Contrato legado" no topo da Visão geral (trilha central, ações à direita). Reconhecer só quando elegível, com motivo; pendente lista campos faltantes (edição normal do contrato), pede nova revisão quando o documento mudou, e o formulário de regularização exige PDF conferido, situação, data da assinatura com confirmação humana, vigência, renovação conferida, referência e justificativa. Vigência futura fica pendente com explicação. Regularizado mostra situação, evidência (prévia privada), trilha e "alterações por aditivo".
- Próximo passo: pendente/desconhecido nunca oferece aprovação/assinatura; regularizado mantém o fluxo do status canônico sem exigência comercial retroativa. Aba de aprovações e cartão de assinatura ficam ocultos/informativos para legado.
- Núcleo A reforçado (0385 ainda não aplicada): imutabilidade de todos os termos conferidos (valores, moeda, pagamento, identificadores, assinatura, aviso, reajuste, multas); pendente ou regularizado não aceita assinatura, proposta ou origem nova; inserção em pacotes de assinatura, entregas e-sign e ForSign bloqueada para legado; reserva trava contrato antes do registro (mesma ordem de rebase/regularização).
- Testes: `legacy-postgres.test.ts` 40/40, `legacy.server.test.ts`, `legacy-view.test.ts`, `contract-next-step.test.ts` e regressão `deal-contracting-journey.test.ts` (75/75 no total). `permissions:check` sem achados; typecheck sem erros.
- Não validado: tela no navegador (a prévia local não respondeu durante o lote), integração real dos demais gatilhos de `contracts` (o banco descartável usa versões simplificadas de assinatura/serviços/cobrança), usuários sem a chave de leitura continuam vendo o fluxo comum na tela (o banco bloqueia nova assinatura de legado).

## Lote B — correção (elegibilidade e banco de teste)

- O teste PostgreSQL usa a mesma inicialização dos testes de execução de contratação: nix PG17 quando há, no Mac PG16 local por socket com `TECHERP_NATIVE_PG=1` e, se não houver nenhum dos dois, Docker PG17 fixado por digest (CI). Nunca lê URL configurada. Encerramento seguro e 2 conexões aquecidas antes dos testes de corrida; timeouts e asserções não mudaram.
- Elegibilidade: qualquer contrato importado de arquivo (rascunho, ativo, encerrado ou rescindido) pode ser reconhecido, sem precisar voltar para rascunho. Continua barrado o que tem origem governada (solicitação de contratação, proposta/cotação/minuta aceita) ou assinatura nativa em curso/concluída (provedor, documento/operação, PDF assinado nativo, pacotes, envios, ForSign, evidência de contratação, status `awaiting_signature`). `signed_at` sozinho (ativação manual antiga) não prova nem impede; o valor fica guardado em `prior_signed_at`/`prior_status` e na trilha.
- Pendente preserva status e assinatura atuais: a guarda recusa mudança de `status`/`signed_at` mesmo do dono da tabela. Só a regularização a faz, por uma marca transacional privada (tabela sem GRANT), não por GUC/`current_user`. Corrige a falha da guarda anterior, que liberava qualquer chamada vinda de função privilegiada.
- Limite: regularizar um ativo como encerrado/rescindido muda o status canônico; os gatilhos reais de encerramento (serviços, workflows) não estão no banco descartável e precisam ser conferidos no preflight. Não houve contratos reais alterados.

## Lote B — referências de assinatura extraídas

- Achado de produção (leitura apenas): 17 dos 18 rascunhos importados têm `signature_provider` + `signature_document_id` preenchidos pelo importador por IA, sem `signed_at`. Nenhum fluxo real do app grava essas colunas (assinatura real usa pacotes, entregas, operações ForSign e evidências próprias).
- `contract_legacy_protected_problem` deixa de tratar essas três colunas como assinatura: são referência documental extraída, nunca prova. Continuam protegidos: pacotes, entregas, operações ForSign, evidência de contratação, PDF assinado nativo e status `awaiting_signature`.
- Os identificadores não são apagados: a guarda impede alterá-los em pendente/regularizado. A regularização continua exigindo PDF atestado pelo servidor e confirmação humana.
- Lote C: o importador novo deve guardar `signature_*` extraídos em metadados documentais, não nas colunas ativas de assinatura; a tela deve mostrar a referência como "a conferir".

## Revisão independente Codex — integração do núcleo

A revisão complementar local usa a 0387 preparada para importar e reconhecer como pendente em uma transação do usuário/RLS, com UUID estável, trava por arquivo, rejeição de replay divergente, validação das partes canônicas e rollback. A 0386 corrige a revalidação da autoridade atual do gestor para novas operações de contratação; não altera inícios históricos.

- A classificação simples pode ser lida pelo leitor autorizado do contrato, sem expor evidência ou trilha privada e sem conceder `legacy.view`. Isso impede oferecer nova assinatura a um legado quando falta a permissão específica de evidências. Falha de consulta bloqueia a ação; cache inclui usuário, workspace e conjunto de permissões.
- O original importado e a identidade são imutáveis mesmo enquanto pendente. A impressão digital SHA-256 inclui todos os termos materiais da linha, incluindo condições financeiras, escopo e colunas futuras; alteração exige reconhecimento/rebase explícito e supera evidências antigas. Títulos de exibição, responsabilidade, timestamps e vínculo ao negócio não são termos documentais.
- A evidência conferida é a última atestada da revisão atual, nunca um upload antigo selecionado silenciosamente. Documento escaneado não exige fabricar texto de minuta editável; o PDF original assinado, partes e conferência humana são obrigatórios.
- Regularizar preserva os serviços e seus `billing_hold`. O gatilho de liberação de cobrança ignora somente a marca privada da transação da regularização; assinaturas normais mantêm o comportamento anterior. Não é uma liberação financeira, nem cria título/pagamento. Nenhum contrato real foi regularizado durante QA.
- Novas aprovações/assinaturas serializam a verificação com o reconhecimento sobre a linha do contrato; histórico de aprovações é preservado.
- Teste local independente: 90 cenários de núcleo/servidor/modelo/próximo passo, PostgreSQL 16 descartável. O fixture carrega os corpos reais de auditoria e encaminhamento e verifica encerramento/rescisão sem nova tarefa de assinatura. As tabelas de assinatura/serviços ainda são mínimas e a liberação financeira é um sentinela de teste; os demais cenários financeiros completos estão nas suítes de contratação. Não equivale a testes de todas as automações do workspace.
- As suítes integradas com contratação governada também recusam reclassificação de profissional/fornecedor como legado; 143 testes aprovados na rodada anterior. Nenhuma migração nova foi aplicada, e a publicação ainda depende da CI completa e do aceite no navegador.

## Lote C — UI de importação e Ajuda (preparado)

- Escolha obrigatória antes de extrair ("Documento em elaboração" × "Contrato legado / já formalizado"), em `import-mode-chooser.tsx` + regras puras `import-mode.ts`. Legado exige motivo (≥5), importar + criar/ver/editar contratos + `legacy_contracts.create`; sem elas a opção fica desabilitada e nomeia o que falta.
- Individual: legado extrai primeiro e só grava após a revisão ("Criar contrato legado pendente"); original obrigatório (não desmarcável), falha de envio aborta sem contrato. Tentativa estável por arquivo (`operation_id` UUID + caminho `uid/<operation_id>-arquivo`), reaproveitada no "Tentar novamente"; sem repetição automática e sem "gravar sem corpo" no legado (no rascunho só por botão explícito). Pending é confirmado lendo o estado de legado; se não confirmado, orienta abrir a ficha e não reimportar.
- Lote: mesmo modo para o lote, travado após iniciar; legado sem pareamento automático compra ↔ prestação; aditivos só com o principal escolhido (existente ou do lote); papel escolhido vai em `manual_role`, o extraído continua extraído.
- Payload enviado: campos atuais + `import_mode`, `legacy_reason`, `operation_id`, `manual_role` (cast documentado até o schema/servidor do lote C/0387 entrarem). A revisão (`buildImportPatch`) nunca grava `signature_*`.
- Dependência: sem a mudança local de `import.functions.ts`/`import-schemas.ts`/0387, o servidor ignora os campos novos e o legado não é reconhecido; a tela detecta e avisa.
- Ajuda: `importar-contrato` v8, `importar-em-lote` v3, `editar-contrato` v9, `consultar-contratos` v3 e novo `regularizar-contrato-legado` v1 (`/contracts/$id`, `legacy_contracts.view`). Catálogo oficial não regenerado.
