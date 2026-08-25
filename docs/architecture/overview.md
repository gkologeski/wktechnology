# Visão geral do produto e dos fluxos

## 1. Arquitetura em duas camadas

- **Core ERP** — entidades e configurações compartilhadas: Empresas, Contatos,
  Produtos, Catálogo de Serviços, Usuários/Times, Permissões, Pipelines,
  Arquivos, Workflows, Integrações, Branding.
- **Módulos verticais** — TechSales (`crm`), TechHire (`ats`), TechPeople
  (`people`), TechContracts (`contracts`), TechService (`service`), TechFinance
  (`finance`), TechProjects (`projects`).

Cada módulo consome o Core e adiciona menu, telas e regras próprias. O menu
lateral é montado como `CORE_SIDEBAR_GROUPS → <MODULE>_SIDEBAR_GROUPS →
configs escopadas` (`src/lib/menu-config*.ts`), filtrado por RBAC.

### Módulo ativo

`src/lib/modules/active-module.ts::useActiveModule` resolve nesta ordem:

1. host de produção com subdomínio (`ats.wktechnology.com.br`) — vence sempre;
2. `localStorage.activeModule` — preferência do usuário;
3. `detectModuleFromPath(pathname)`;
4. default `crm`.

Abrir uma URL de outro módulo **não** troca o módulo ativo: o app exibe um
banner de contexto cruzado (`src/components/cross-module-banner.tsx`). Troca é
sempre explícita, via `ModuleSwitcher` ou `/home`.

Licenciamento por módulo: `workspace_modules`, `modules`,
`src/lib/modules/licenses.functions.ts`, `plans` / `plan_entitlements` /
`has_entitlement`.

## 2. Rotas principais por módulo

Todas sob `src/routes/_authenticated/`.

**Core / geral** — `/home`, `/dashboard`, `/dashboards`, `/analytics`,
`/reports`, `/files`, `/inbox` (`email`, `chat`, `whatsapp`),
`/communications`, `/meetings`, `/notes`, `/tasks`, `/tasks/queues`,
`/surveys`, `/forms`, `/landing-pages`, `/marketplace`, `/integrations`,
`/modules`, `/workspace`, `/settings/**` (≈90 telas), `/admin/**` (plataforma).

**TechSales** — `/leads`, `/leads/$id`, `/leads/import-hubspot`, `/contacts`,
`/companies`, `/deals`, `/proposals`, `/prospecting` (índice, campanhas, filas
com modo _play_), `/agents/sdr`, `/campaigns/email`, `/campaigns/whatsapp`,
`/catalog/products`, `/catalog/services`.

**TechHire** (`(ats)/`) — `/ats-dashboard`, `/jobs`, `/jobs/$id`,
`/candidates`, `/candidates/$id`, `/pipelines`, `/scorecards`,
`/interview-kits`, `/scheduling`, `/offers`, `/stage-emails`, `/briefing`,
`/insights`, `/copilot`, `/notetaker`, `/match-scores`, `/dei-analytics`,
`/fraud-flags`, `/compliance`, `/sourcing/*` (index, sequences, pools,
referrals, inbox, multi-posting, analytics), `/hunting/*` (search, captures,
templates, install, observability).

**TechPeople** — `/people`, `/people/$id`, `/people/documents`,
`/people/benefits`, `/people/incidents`, `/people/onboarding`,
`/people/offboarding`, `/people/psychosocial`, `/people/my-team`,
`/people/billing`, `/people/contract-margin`, `/people/analytics`,
`/people/import-forms`, `/catalog/job-profiles`.

**TechContracts** — `/contracts`, `/contracts/$id`, `/contracts/links`,
`/contracts/templates`, `/catalog/contracting-presets`, `/settings/clauses`,
`/settings/esign`.

**TechService** — `/tickets`, `/tickets/$id`, `/settings/sla`,
`/settings/macros`, `/settings/kb`, `/settings/playbooks`, `/my-bug-reports`,
`/admin/bug-reports`.

**TechFinance** — `/finance`, `/finance/payable`, `/finance/receivable`,
`/finance/entries/$id`, `/finance/recurrences`, `/finance/nfse`, `/invoices`,
`/finance/banking`, `/finance/banking/reconciliation`,
`/finance/bank-accounts`, `/finance/categories`, `/finance/cost-centers`,
`/finance/legal-entities`, `/finance/legal-entity-groups`, `/finance/dre`,
`/finance/cash-flow`, `/finance/audit`.

**TechProjects** — `/projects`, `/projects/$id`, `/projects/$id/entrega`,
`/projects/lists/$id`, `/projects/tasks`, `/projects/spaces`,
`/projects/my-work`, `/projects/timesheet`.

**Rotas públicas** (raiz de `src/routes/`) — `/`, `/login`, `/signup`,
`/reset-password`, `/accept-invite/$token`, `/careers`, `/careers/$slug`,
`/kb`, `/kb/$slug`, `/lp/$slug`, `/portal/$token`, `/offer/$token`,
`/quote/$token`, `/interview/$token`, `/schedule/$token`, `/book/$slug`,
`/meet/$token`, `/survey/$token`, `/refer/$slug`, `/verify/$hash`,
`/unsubscribe`, `/widget/$workspaceId`, `/wa/$slug`, `/privacy`, `/terms`,
`/dpa`, `/refund`, `/sitemap.xml`, `/mcp`.

## 3. Fluxos ponta a ponta

### 3.1 TechSales — Lead até Contas a Receber

```text
Prospecção (Apollo/hunting)
  → Lead (leads, stage_id em pipelines)
  → Qualificação obrigatória (prospecting_questionnaires + score unificado + ICP)
      ↳ enriquecimento Apollo/BrasilAPI; cria Empresa + Contato automaticamente
  → Oportunidade: workflow abre modal de Negócio (ação open_deal_dialog)
  → Negócio (deals) + itens de linha a partir de service_catalog
  → Proposta (proposals) / Cotação (quotes) em wizard com autosave
  → Assinatura eletrônica (esign_documents / esign_signers)
  → Contrato (contracts, título padronizado "CPS CONTRATANTE X CONTRATADA")
  → Serviço operacional (services) e/ou Projeto (projects)
  → Financeiro (financial_entries, customer_invoices, nfse_invoices)
```

Pontos de atenção:

- Desqualificar um lead atualiza `status` **e** `stage_id` juntos.
- O funil da tela reflete o pipeline configurado (`StageTracker` dinâmico).
- Scoring unificado (alternativas + texto + ICP) em
  `src/lib/prospecting/lead-score.ts`, exibido como percentual no modal.

### 3.2 TechHire — Vaga até contratação

```text
Vaga (ats_jobs, pipeline ats_pipelines "RH - Seleção")
  → Publicação (ats_job_postings, /careers) e sourcing/hunting
  → Candidato (ats_candidates, parsing de CV por IA)
  → Candidatura (ats_applications) movida por etapas no Kanban
  → Entrevistas (ats_interviews, ats_interview_kits) + Scorecards
  → Match score (ats_match_scores) e sinais de fraude (ats_candidate_flags)
  → Oferta (ats_offers) + assinatura eletrônica
  → Contratado → Pessoa (people) via hire-candidate-dialog
      ↳ Alocação (people_allocations) vinculada a contrato de prestação
```

Regras: mover para "Contratado"/"Rejeitado" fecha a candidatura conforme
`src/lib/ats/stages.ts`; visibilidade de vagas é por workspace/RBAC, sem filtro
manual de `owner_id`.

### 3.3 TechContracts — aninhamento

- Contrato de **prestação** pode ter filhos: contratos de **compra** e
  **aditivos**. Serviços do catálogo só podem ser associados a prestação.
- Contrato de **compra** só pode ter **aditivos**.
- Numeração hierárquica exibida como `1`, `1.1`, `1.1.1`
  (`src/components/contracts/contracts-grouped-list.tsx`), aditivos antes de
  contratos de compra, com proteção contra ciclos.
- Regras aplicadas em `src/lib/contracts.functions.ts`.

### 3.4 TechPeople — alocação

Nova alocação lista apenas contratos de **prestação**, ranqueados por
relevância (nome/CPF/CNPJ) via `src/lib/contracts/title-match.ts` e
`scoreContractForPerson`. Cargo/senioridade sincronizam de `job_profiles`.

### 3.5 TechFinance

Lançamentos (`financial_entries`) nascem de contrato, serviço, marco de
projeto, despesa ou manual (`financial_origin_type`), com recorrências
(`financial_recurrences`), pagamentos (`financial_payments`), conciliação
bancária (`bank_statement_transactions`), cobrança/dunning e NFS-e.

## 4. Onde procurar o quê

| Pergunta                      | Comece por                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| "Como essa tela busca dados?" | rota em `src/routes/_authenticated/**` → `useServerFn`/`useQuery` → `src/lib/**.functions.ts` |
| "Quem pode ver isso?"         | `docs/architecture/security-rbac.md` + `pg_policies` da tabela                                |
| "Qual tabela guarda isso?"    | `docs/architecture/data-model.md`                                                             |
| "Isso é automático?"          | `docs/architecture/workflows-automation.md`                                                   |
| "Qual componente usar?"       | `docs/techhire-design-system.md`                                                              |
