# Backlog de Pendências — Consolidado

> Documento de referência para avaliação futura. Fontes auditadas:
> `docs/roadmap.md`, `docs/releases-12-21-scope.md`, `docs/hubspot-feature-map.md`, `.lovable/plan.md`.
> Última atualização: 2026-07-21.

## 0. Workflows cross-módulo (entregue 2026-07-21)

Workflows agora suportam gatilhos e ações genéricas (`create_record` / `update_record` / `delete_record`) em 13 entidades além do CRM/ATS: `projects`, `project_tasks`, `project_milestones`, `contracts`, `financial_entries`, `bank_payments`, `quotes`, `proposals`, `products`, `services`, `recurring_plans`, `subscription_invoices`, `customer_invoices`. A função `enqueue_workflow_event` resolve `owner_id` via `workspaces.created_by` quando a tabela alvo não possui a coluna. Detalhes em `.lovable/plan.md` (fases 1-4 do plano de workflows cross-módulo).

## 1. Pendências do roadmap.md

| ID   | Item                                        | Esforço | Estado                                                           |
| ---- | ------------------------------------------- | ------- | ---------------------------------------------------------------- |
| R-01 | Payment link Stripe (Onda 5 item 22)        | M       | ❌ não implementado                                              |
| R-02 | Outlook/Microsoft Calendar (Onda 8 item 35) | M       | 🟡 infra pronta, faltam secrets MICROSOFT_OAUTH_CLIENT_ID/SECRET |

## 2. Releases marcados como "MVP entregue" — refinamentos pendentes

### Release 19 — IA Avançada

- R19-a Copilot Cmd+K com RAG citando fontes clicáveis
- R19-b Agente SDR: opt-out automático em "pare" + handoff humano por flag
- R19-c Forecast ML com intervalo de confiança + explainability top-3 features
- R19-d Lead scoring ML com retreino mensal + score híbrido configurável
- R19-e Voice agent: handoff humano + transferência por intenção

### Release 20 — Marketing Automation

- R20-a Landing pages publicadas em SSR em /lp/$slug com meta tags
- R20-b A/B testing com promoção automática por significância (p<0.05)
- R20-c Atribuição multi-touch com Sankey + 4 modelos
- R20-d Ads sync bidirecional Meta/Google + Lead Ads via webhook

### Release 13 — WhatsApp Meta (fora de escopo declarado)

- R13-a WhatsApp Pay
- R13-b WhatsApp Flows (forms interativos)

## 3. Paridade HubSpot — parciais 🟡 ainda abertos

| ID   | Item                                                 | Esforço |
| ---- | ---------------------------------------------------- | ------- |
| H-01 | Filter builder com OR aninhado real                  | P       |
| H-02 | Record sidebar layout configurável (UI)              | M       |
| H-03 | CSV wizard com dedupe por email/phone                | M       |
| H-04 | Grupos de propriedades configuráveis (drag-and-drop) | P       |

## 4. Paridade HubSpot — itens ❌ não cobertos

| ID   | Item                                                 | Esforço |
| ---- | ---------------------------------------------------- | ------- |
| H-05 | Feed global cross-objeto                             | M       |
| H-06 | Coaching de chamada (whisper)                        | G       |
| H-07 | Caller ID local por região                           | M       |
| H-08 | Approval workflows (ex.: desconto > X%)              | G       |
| H-09 | Conditional / dependent properties                   | M       |
| H-10 | Propriedades calculadas                              | M       |
| H-11 | Validação de propriedade (regex/range)               | P       |
| H-12 | Propriedades multi-currency com conversão automática | M       |
| H-13 | Editor de email drag-and-drop                        | G       |
| H-14 | Bounce / spam handling automático                    | M       |
| H-15 | DKIM / SPF setup wizard                              | M       |
| H-16 | Send time optimization por IA                        | G       |
| H-17 | Preview de email por device                          | P       |
| H-18 | A/B test de assunto de email                         | M       |
| H-19 | Group meeting (vários donos numa sala)               | M       |
| H-20 | Round-robin de agendamento (booking pages)           | M       |
| H-21 | CTAs trackáveis (botão com click tracking)           | M       |
| H-22 | Blog / CMS básico no domínio do cliente              | G       |
| H-23 | Lista de membership cross-objeto                     | G       |
| H-24 | Suppression lists                                    | P       |
| H-25 | Compartilhamento de listas com time (permissões)     | P       |
| H-26 | Custom tabs no record                                | M       |
| H-27 | Temas (dark/light toggle)                            | P       |
| H-28 | Atalhos de teclado globais                           | P       |
| H-29 | Custom code actions em workflows (JS arbitrário)     | G       |
| H-30 | LinkedIn Sales Navigator (sync InMails)              | G       |
| H-31 | Postal/direct mail (log)                             | P       |
| H-32 | Sync com Google Contacts                             | M       |
| H-33 | Sync com Outlook / Exchange (contatos)               | M       |
| H-34 | Dedupe automático com merge                          | M       |
| H-35 | Activity leaderboard                                 | P       |
| H-36 | Connectors Clearbit / ZoomInfo                       | M       |

## 5. Processo sugerido de avaliação (futuro)

Para cada item, marcar um dos status:

- ✅ Entra (vira release)
- ⏸ Backlog (sem data)
- ❌ Descartado (registrar como constraint na memória)
- 🔍 Spike (estudo curto antes de decidir)

Após triagem, agrupar ✅ em Releases 22+ por tema, com esforço alvo de ~2 semanas por release, e gerar `docs/releases-22+.md` no mesmo formato de `releases-12-21-scope.md`.

## 6. Resumo numérico

- Roadmap.md pendentes: **2**
- Refinamentos de MVPs (R19+R20+R13): **11**
- HubSpot parciais 🟡: **4**
- HubSpot ❌ não cobertos: **32**
- **Total para avaliar: 49 itens**

## Congelamento até o fim da Fase 3 (2026-08-25)

Enquanto a Fase 3 do plano de redução de tempo de implementação não terminar
(testes E2E por papel + varredura de `deleteRowGuarded`), novas features amplas
ficam congeladas. Itens de paridade HubSpot permanecem no backlog sem
priorização. Correções de bug e polimento de UI seguem, agrupados em um plano
semanal único (ver `docs/plan-templates.md`).
