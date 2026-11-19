# Pacote 4 · Lote B — ENTREGA-FISCAL (preparado, não aplicado)

Base: lote A `e8f12a00c` (em revisão; interface preservada). Migração **preparada** em
`docs/architecture/prepared-migrations/0382_hiring_execution_deliveries_fiscal.sql`, fora do journal Drizzle.
Não aplicada, não publicada. Tipos gerados não regenerados (SHA256 `55285afb…dca5` inalterado); baseline não regenerado.
`docs/architecture/hiring-package4-implementation.md` não existe no repositório; foi usada a auditoria do lote A.

## Auditoria dos pontos de adaptação

| Ponto                                          | Situação                                                                 | Lote B                                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hiring_execution_starts` (0381)               | Registro imutável do início                                              | Âncora de toda entrega/documento (`start_id`); sem alteração                                                                                       |
| Prova atual                                    | `hiring_execution_activation_ok` (hash do contrato + assinatura íntegra) | `hiring_ops_proof_problem` exige início, revisão da solicitação igual à do início, `ready` e prova íntegra antes de qualquer escrita               |
| `projects` / `project_milestones`              | Campos de faturamento (`billable`, `bill_amount`, `financial_entry_id`)  | Apenas referenciados por id; visibilidade sob RLS do chamador via função de propriedade do `techerp_request_writer` (sem BYPASSRLS); nenhum UPDATE |
| `contract_attachments` / buckets de assinatura | Anexos assinados congelados                                              | Não usados: bucket privado próprio `hiring-fiscal-documents` e trilha própria                                                                      |
| Serviços vendidos / financeiro                 | `services`, `financial_*`                                                | Não tocados (teste verifica ausência no SQL)                                                                                                       |
| `hiring_preparation_approval_subject`          | Membro ativo + chave efetiva (deny prevalece)                            | Reutilizado em `hiring_ops_subject`                                                                                                                |

## Implementado

- 10 chaves novas (catálogo + `permission-contracts.json`, sem concessão a cargos):
  `{techpeople.hiring_requests|techcontracts.supplier_requests}.{deliveries.manage, deliveries.approve, fiscal_documents.create, fiscal_documents.view, fiscal_documents.approve}.workspace`.
- Entregas: `hiring_execution_deliveries` + versões/submissões/decisões imutáveis. Cada versão guarda critérios, período (dentro do início), responsável, projeto/marco e `content_hash` (inclui hash do contrato e revisão). Aceite/rejeição só pelo responsável nomeado da versão, nunca por quem registrou/submeteu, sobre versão + hash exatos, com motivo e operação idempotente. Alterar cria nova versão (motivo obrigatório), reabre e exige novo aceite; histórico preservado.
- Documentos fiscais: reserva → upload pela sessão do usuário (política de INSERT só no caminho reservado, 1 h) → servidor detecta o tipo pelos bytes, calcula SHA-256, relê o objeto e só então registra. Limite 10 MB; PDF/XML/PNG/JPEG. CNPJ do tomador = entidade WK; emitente = CNPJ canônico (empresa fornecedora; PJ: empresa vinculada ou CNPJ da pessoa); CLT = evidência de folha emitida pela WK sem tomador; freelance = modalidade explícita (NFS-e/RPA/recibo), sem política inferida. Valor > 0, moeda ISO, número, emissão entre o início e hoje. Duplicidade por bytes e por emitente+tipo+número. Registro imutável após `registered`; somente `registered → verified/rejected` pela conferência do Financeiro (outra pessoa, hash exato), com trilha de eventos (reservado, registrado, baixado, conferido).
- Privacidade: nenhuma tabela nova tem GRANT para `authenticated`; leitura só por RPC. Valores/CNPJs/arquivos apenas com `fiscal_documents.view`. Download autenticado pela política de SELECT do storage e re-hash no servidor.
- "Ver como" somente leitura: todas as escritas recusam `is_read_only_view()`.
- UI: `OperationsHistory` no centro e `OperationsPanel` na lateral da ficha, componentes existentes (White Label), `IsoDatePicker`.
- Ajuda v9 dos dois guias preparada (docs + catálogo oficial); **não aplicada**.

## Testes executados

- `src/lib/hiring/requests/deliveries-postgres.test.ts` — 48/48 em PostgreSQL descartável com as funções reais (0373–0380, 0381 e 0382 preparadas): 30 testes de cinco cenários (permitido, sem chave, deny, outro workspace, inativo) para salvar, submeter, decidir, enviar, baixar e conferir; mais versão/histórico, hash/versão obsoletos, responsável nomeado/autoaceite, assinatura quebrada, projeto/marco canônicos sem tocar faturamento, concorrência/idempotência, "ver como", privacidade de valores/arquivos, política de storage, tipo/tamanho/hash, CNPJs, CLT, freelance, fornecedor, duplicidade, conferência do Financeiro e ausência de efeitos financeiros. Mutação manual (remover checagem de responsável e de quem enviou) fez os testes correspondentes falharem.
- `operations-presentation.test.ts` 2/2; `execution-presentation.test.ts` 2/2; `hardcode-guard` e `date-field-guard` passaram.
- `bun run permissions:check` — único achado restante é `src/integrations/supabase/types.ts` (pré-existente, mesmo do lote A).
- `bun run help:coverage` 254/254; `bun run typecheck` sem erros.
- Não executados: `verify:changed`/`verify` completos (por instrução), Playwright/teste visual, upload real em storage.

## Limitações e pendências

- Migração não aplicada; preflight em schema real, CI e revisão independente pendentes.
- O bucket privado `hiring-fiscal-documents` (10 MB) **não foi criado**: criação é ação real e fica para a aplicação revisada.
- O banco não recalcula o SHA-256 dos bytes (verificação no servidor por releitura); upload interrompido deixa reserva `pending_upload` sem efeito, que expira para escrita em 1 h.
- Conferência é humana; nenhuma autenticação junto à prefeitura/SEFAZ é feita ou afirmada.
- Política de storage usa `metadata->>'size'` quando disponível; validar no preflight o formato real do Supabase Storage.
- Sem cancelamento de entrega neste lote; sem vínculo obrigatório entre NF e entrega aceita (regra do lote C).
- Títulos, provisão, contas a pagar e pagamentos: lote C.
