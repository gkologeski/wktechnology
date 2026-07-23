## Objetivo

Adicionar em TechContract um fluxo de importação de contratos a partir de `.pdf` ou `.docx`, que extrai automaticamente os dados-chave via IA e abre um diálogo de revisão antes de criar o contrato. Complementar a tabela `public.contracts` com os campos que faltam para representar as cláusulas típicas encontrados nos 4 contratos anexos.

## Levantamento de variáveis (a partir dos 4 anexos)

Contratos analisados:
- CITEL × CMK KOLOGESKI (Outsourcing, R$ ~/mês, PIX dia 12, IGPM anual, ForSign)
- GM KOLOGESKI × CW SOFTWARES (Prestação de serviços, R$ 13.000/mês por 160h, PIX dia 12, IPCA, ForSign, comarca Florianópolis)
- CITEL × CMK KOLOGESKI — João Victor (Outsourcing, R$ 16.100/mês por 160h, PIX dia 8, IGPM, DocuSign)
- CITEL × CW KOLOGESKI — Luiz Fernando (Outsourcing, R$ 14.000/mês por 160h, PIX dia 19, IGPM, comarca Ribeirão Preto)

### Já existentes em `public.contracts`

`title`, `role`, `status`, `counterparty_company_id`, `parent_contract_id`, `starts_at`, `ends_at`, `auto_renew`, `notice_days`, `total_value`, `currency`, `readjustment_index`, `readjustment_period`, `payment_terms (jsonb)`, `body_html`, `metadata (jsonb)`.

### Campos novos identificados

Financeiro / cobrança:
- `monthly_value numeric(14,2)` — valor mensal fixo (distinto de `total_value` para contratos por escopo fechado).
- `hours_per_month integer` — carga mensal contratada (ex.: 160).
- `payment_day smallint` — dia do mês do pagamento (1–31).
- `payment_method text` — `pix`, `ted`, `boleto`, `transferencia`, `outros`.
- `late_fee_percent numeric(6,3)` — multa moratória (ex.: 2,0).
- `late_interest_monthly_percent numeric(6,3)` — juros ao mês (ex.: 1,0).
- `expense_reimbursement_days smallint` — prazo de reembolso (ex.: 5).

Rescisão / cláusula penal:
- `penalty_percent numeric(6,3)` — multa compensatória (ex.: 20).
- `cure_period_days smallint` — prazo para sanar infração (ex.: 10).
- `trial_period_days smallint` — carência sem multa (ex.: 90).
- `unilateral_termination_notice_days smallint` — aviso para resilição unilateral (ex.: 7). `notice_days` fica para renovação; este é específico do rompimento.

Escopo / execução:
- `service_type text` — `outsourcing`, `desenvolvimento`, `manutencao`, `consultoria`, `licenciamento`, `outros`.
- `service_scope text` — resumo do objeto (livre).
- `service_location text` — `remoto`, `presencial`, `hibrido`.

Legal:
- `governing_law text` — ex.: `Brasil`.
- `jurisdiction text` — foro (ex.: `Florianópolis/SC`, `Ribeirão Preto/SP`).
- `confidentiality_term_months smallint` — prazo do NDA (0 = vigência do contrato).

Parte contratante interna:
- `contracting_legal_entity_id uuid` — FK para `public.legal_entities` (nossa parte). Hoje só existe `counterparty_company_id` para a contraparte.

Assinatura eletrônica (metadados do provedor):
- `signature_provider text` — `forsign`, `docusign`, `clicksign`, `manual`, `outros`.
- `signature_document_id text` — ID do documento no provedor.
- `signature_operation_id text` — ID da operação/envelope.

Origem do documento:
- `source_file_path text` — caminho no bucket (bucket novo `contract-imports`) do arquivo importado.
- `imported_from text` — `pdf`, `docx`, `manual`.
- `import_confidence numeric(4,3)` — confiança média da extração (0–1) reportada pela IA.

Testemunhas ficam em `metadata->witnesses` (JSON de objetos `{name, cpf, rg, role}`) — sem migração dedicada porque volume é baixo e a estrutura é livre.

Todos os campos novos são `NULL`-friendly, com defaults conservadores para não quebrar contratos existentes.

## Fluxo de importação (UI)

Nova ação **Importar contrato** em `/contracts` (botão no `PageHeader`, ao lado de "Novo contrato"). Abre um wizard de 3 passos:

1. **Upload** — dropzone aceitando `.pdf` (até 15 MB) e `.docx` (até 10 MB). Barra de progresso durante o parse.
2. **Revisão** — formulário pré-preenchido com todos os campos extraídos, cada um com um selo "IA" e a confiança da extração; usuário edita livremente. Prévia do texto (`body_html`) em painel lateral.
3. **Confirmação** — resumo e botão "Criar contrato". Ao confirmar, cria em `contracts` como `status='draft'` e navega para `/contracts/$id`.

Cancelar em qualquer passo descarta a extração e o arquivo enviado.

## Fluxo de extração (server)

Novo módulo `src/lib/contracts/import.functions.ts`:

- `parseContractDocx` — recebe HTML/texto extraído no cliente com `mammoth/mammoth.browser` (já dependência do projeto). Sem upload de binário para o servidor.
- `parseContractPdf` — recebe o PDF em base64 e envia inline para o Lovable AI Gateway (`google/gemini-2.5-flash`) usando `inline_data` com `application/pdf`. Fallback: se falhar (arquivo escaneado grande), pede ao usuário para exportar o PDF em texto ou usar a versão `.docx`.
- Prompt estruturado que devolve **apenas** JSON conforme schema Zod. Sanitiza saída, valida com Zod, coerção de números pt-BR (`R$ 13.000,00` → 13000), datas ISO, enums restritos.
- Retorno: `{ fields: { ...campos... }, confidence: 0..1, body_html: string, warnings: string[] }`.

Persistência do arquivo original (opcional, escolha do usuário no passo 3): upload para bucket privado novo `contract-imports` (RLS por `owner_id`) e grava o path em `source_file_path`.

Segurança:
- Ambas as server functions usam `requireSupabaseAuth` e validam permissão `contracts.create` via `assertAnyPermission`.
- Nenhum PDF é logado; apenas o caminho no bucket e o resultado JSON.

## Alterações na UI existente

- `src/routes/_authenticated/contracts.$id.tsx` — adicionar seções `SectionHeader` para agrupar os novos campos:
  - **Financeiro / cobrança**: `monthly_value`, `hours_per_month`, `payment_day`, `payment_method`, `late_fee_percent`, `late_interest_monthly_percent`, `expense_reimbursement_days`.
  - **Rescisão / cláusula penal**: `penalty_percent`, `cure_period_days`, `trial_period_days`, `unilateral_termination_notice_days`.
  - **Escopo**: `service_type`, `service_scope`, `service_location`.
  - **Legal / assinatura**: `governing_law`, `jurisdiction`, `confidentiality_term_months`, `signature_provider`, `signature_document_id`, `signature_operation_id`.
  - **Parte contratante**: novo `LegalEntitySelect` (já existe) preenchendo `contracting_legal_entity_id`.
- `src/lib/contracts.functions.ts` — expandir `updateContract` para aceitar os novos campos e `getContract` para retorná-los.
- `docs/techhire-design-system.md` — sem mudança.

## Migração SQL (uma única)

- `ALTER TABLE public.contracts ADD COLUMN ...` para cada campo listado (todos nullable).
- Índices leves: `payment_day`, `service_type`, `signature_provider` — apenas se úteis para filtro; **não incluir** por padrão para reduzir custo.
- GRANTs já existentes cobrem as colunas novas (não requer novo GRANT).
- RLS existente cobre; nenhum policy novo.
- Novo bucket `contract-imports` (privado) via `supabase--storage_create_bucket`.
- RLS em `storage.objects` para `contract-imports`: SELECT/INSERT/DELETE quando `owner = auth.uid()`.

## Componentes / arquivos a criar

- `src/components/contracts/import-contract-dialog.tsx` — wizard 3 passos.
- `src/components/contracts/import-review-form.tsx` — formulário do passo 2 (usa `FormSection` do design system).
- `src/lib/contracts/import.functions.ts` — server fns de parsing.
- `src/lib/contracts/import.server.ts` — helper isolado do AI Gateway + Zod schemas (não importado do cliente).
- `src/lib/contracts/import-schemas.ts` — Zod schema client-safe compartilhado.

## Validações que farei ao terminar

1. `tsgo` sem erros.
2. Playwright: fluxo /contracts → Importar → upload de um dos 4 PDFs anexos → conferir pré-preenchimento coerente com o levantamento acima → salvar → validar redirecionamento para `/contracts/$id` com campos gravados.
3. `supabase--read_query` verificando que colunas novas gravaram valores plausíveis.

## Riscos / pendências assumidas

- **Extração via IA nunca é 100%.** Por isso o passo 2 (revisão) é obrigatório. Nenhum contrato é criado sem confirmação humana.
- **PDF escaneado sem OCR**: Gemini faz OCR razoável, mas se falhar exibimos aviso pedindo a versão editável (.docx).
- **Testemunhas** ficam em `metadata->witnesses` para não inflar o schema; se depois quiser tabela dedicada, faz-se em fase seguinte.
- **`total_value` versus `monthly_value`**: manteremos ambos; para contratos por horas mensais o valor total é derivado (`monthly_value * meses`) e mostrado apenas informativo até o encerramento.

## Fora de escopo (não incluído)

- Reajuste automático anual (recorrência).
- Geração de contrato a partir de template (é o inverso; já existe fluxo separado).
- Assinatura eletrônica in-app.
- Reprocessar contratos já criados no sistema.
