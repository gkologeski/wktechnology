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

- Migração `docs/prepared-migrations/0385_contract_legacy_regularization.sql`, fora do journal, não aplicada.
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
