# Pacote 4 — Lote C2 (PARCELA-CONCILIA): contas a pagar canônicas, conciliação e integridade de fontes

Status: **preparado e testado localmente**. Migração `0384` **não aplicada**, nada publicado, nenhum título/pagamento real.
Base: `7c6d5e085` (C1). Revisões locais A/B (fora deste sandbox) não foram sobrescritas; interfaces B/C1 preservadas (C2 só lê `hiring_econ_compute`, `hiring_econ_proof_problem`, `hiring_ops_proof_problem`, `hiring_econ_private_ok`).

## SQL — `docs/architecture/prepared-migrations/0384_hiring_payables_reconciliation.sql`
- 8 chaves novas (sem grants): `{techpeople.hiring_requests|techcontracts.supplier_requests}.payables.{view,manage,reconcile}.workspace` e `techcontracts.supplier_requests.client_acceptance.{manage,approve}.workspace`. Também exigem `techfinance.entries.{view,create,update}.workspace` e acesso ao contrato (e à pessoa).
- Tabelas privadas e imutáveis: `hiring_payable_schedules`, `hiring_payable_installments` (FK real ao título, `external_ref` único), `hiring_payable_source_claims` (`claim_key` único = contrato + fonte canônica [+ competência no mensal], FKs reais a apontamento, fechamento, decisão de entrega, versão, aceite do cliente, plano/versão/hash), `hiring_payable_reconciliations`, `hiring_fiscal_document_allocations`, `hiring_client_acceptances`.
- `hiring_payable_generate`: plano aprovado atual + prova atual (assinatura/revisão/alçada/CNPJ) + hash da prévia; seleção explícita; linhas pendentes recusadas; mensal só após o mês encerrado; horas só com fechamento vigente; entrega após aceite real; parcelas explícitas que fecham exatamente; documento conferido (NFS-e/NF-e PJ/fornecedor, documento freelance, evidência de folha CLT), tomador = CNPJ WK, emissor = contratado (fornecedor/PJ), moeda, vínculo à entrega e reserva de saldo sob lock; detecção de legado **antes**; cria `financial_entries` payable/open/origin `contract`/`origin_id` = contrato, `paid_amount` 0. Replay exato idempotente; UUID com dados diferentes = erro.
- `hiring_payable_reconcile` (somente Financeiro configurado): vincula título legado compatível (direção, entidade, moeda, competência, valor exato, contratado) às fontes selecionadas com documento, ou registra "não relacionado"; incompatível bloqueia e lista os critérios; títulos pagos preservados.
- Legado detectado: títulos do contrato, marcador `[people_payroll:<pessoa>]`, contraparte com contrato/serviço/projeto e recorrências ativas equivalentes.
- Guardas: `financial_entries` (inserção em contrato governado só com parcela confiável — GUC não é prova; lastro imutável; sem cancelar/excluir/mover para o contrato; folha legada não duplica competência já gerada), `financial_recurrences` (recusa contrato governado), `project_time_entries`/`project_period_closings`/`hiring_execution_deliveries` congelados quando reivindicados; `invoice_id`/`financial_entry_id` de venda continuam livres. Contratos antigos (sem início governado) intactos.
- `also_client_acceptance`: `hiring_preparation_validate` (0374) agora aceita "pronta" somente com finalidade Cliente e projeto/negócio/contrato comercial; aceite nomeado do cliente sobre a versão exata aceita pela WK, apontando o vínculo da solicitação, conferido pelo Financeiro configurado ≠ registrante; obrigatório na geração; nessa condição só componentes por entrega geram obrigação.
- `hiring_payable_context`: leitura privada (valores só para quem tem as chaves e acesso ao contrato/pessoa).

## UI / Ajuda
- `payables-panel.tsx`: lateral (competência, fontes com pendências, parcelas, documento, justificativa, conciliação, aceite do cliente) e histórico central (parcelas, status, pago, "abrir título" em `/finance/entries/$id`, conciliações, aceites). Aviso da condição especial atualizado no formulário.
- Ajuda v11 nos dois guias + catálogo oficial regenerado (não aplicado ao banco).

## Validações executadas
- `payables-postgres.test.ts`: **53/53** em PostgreSQL 17 descartável (cinco cenários por ação: gerar, conciliar, ver, registrar e conferir aceite; replay/alteração; concorrência de origem e de saldo; duplicidade/versão nova do plano; pago/incompatível/não relacionado; documento/moeda/tomador/emissor/tipo/saldo; CLT/freelance; stale hash; período aberto; horas pendentes; fontes congeladas; bypass manual/workflow/GUC/recorrência; contratos antigos; chave TechFinance; privacidade).
- Mutações temporárias (remover checagem de legado e de saldo) fizeram 3 testes falharem; SQL restaurado.
- Regressões: `economics-postgres` 50/50, `deliveries-postgres` e `execution-postgres` passaram; `payables-presentation` + Ajuda 44/44; `help:coverage` 254/254; `tsgo` sem erros; ESLint sem erros nos arquivos do lote.
- `permissions:check`: só o achado preexistente de `src/integrations/supabase/types.ts`.
- Não executados: `preparation-postgres` (exige Docker, indisponível), `verify`/`verify:changed`, build, Playwright, aplicação em banco real.

## Limitações
- Teste do aceite do cliente reaponta a solicitação iniciada direto no banco (`session_replication_role=replica`) porque montar contrato comercial assinado de origem exige o caminho do lote A; a validação "pronta" tem teste próprio.
- Tabela `financial_entries` do teste replica as colunas reais, mas enums como texto e um gatilho substituto para derivar pago de `financial_payments`; guardas financeiros reais de produção precisam ser confirmados no preflight (ordem de gatilhos e RLS).
- Freelance e CLT não verificam emissor (sem CPF canônico); evidência de folha não tem tomador.
- Revisão de preço após obrigação não reabre fontes: exige aditivo/fluxo futuro. Desativar recorrência legada continua no Financeiro.


## Revisão independente para publicação — 19/11/2026

Correções após o lote remoto: conciliação não relacionada vinculada a competência/plano/hash do título ou recorrência; nova conferência após alteração; sondas NOBYPASSRLS para títulos e recorrências; leituras privadas de plano/documento exigidas para operações; bloqueio de títulos precoces por toda origem de solicitação (não somente após início); guarda de folha inclui conciliação vinculada; integridade de alocação/fechamento/entrega preservada com faturamento de venda livre em campos derivados. Comprovação fiscal exige atestado de bytes e revisão da mesma SHA, identidade canônica CLT/PJ/freelance/fornecedor. Aceite do cliente tem replay exato e revalida entrega e formalização atuais. Custo mensal simultâneo ambíguo é desconhecido, não zero. Teste da finalidade cliente agora cria a solicitação correta desde a primeira revisão, sem reescrever demanda já assinada.

O ensaio no schema real encontrou `reconcile` fora do enum `perm_action`. A permissão executável de conciliação usa o recurso `payables_reconciliation` e a ação existente `approve`, sem alterar enum global. Os nomes antigos `payables.reconcile` permanecem apenas no inventário histórico/reservado; não são inseridos no catálogo do banco, concedidos nem aceitos nas RPCs. Nenhum dado de produção foi alterado no ensaio com ROLLBACK.


## Custo da bateria completa

Primeira CI: 3.859 testes passaram e o build passou; o gate de desempenho recusou verify=282,8 s (limite preservado=240 s). Testes de contas a pagar isolados: limpeza tradicional com TRUNCATE e invalidação de planos levava ~55 s; limpeza de dados por DELETE no banco descartável, com triggers restaurados antes de cada cenário, levou 48,8 s com os mesmos 63 cenários. A limpeza privilegiada não é um adaptador de produção e não altera RPC/RLS, apenas os dados sintéticos. O gatilho é restaurado na mesma transação e um cenário confere session_replication_role=origin; testes negativos exercitam todos os controles reais. Aplicado aos quatro novos fixtures. A CI passa a usar os CPUs efetivamente alocados (availableParallelism), sem a reserva implícita de um worker do padrão do Vitest. Nenhum teste, checagem, limite ou evidência foi retirado.
