# Inventário do Design System — área autenticada

Gerado automaticamente por `bun run audit:design-system`. Total: **253 arquivos de rota**.

Todas as rotas recebem o canvas, a tipografia, os controles e as superfícies globais pelo layout autenticado. Os indicadores abaixo identificam adoção explícita e pendências locais.

| Área | Rotas | Product shell explícito | Cabeçalho oficial | Legado local a revisar |
| --- | ---: | ---: | ---: | ---: |
| (ats) | 29 | 0 | 27 | 0 |
| admin | 8 | 0 | 3 | 3 |
| agents | 1 | 0 | 0 | 0 |
| analytics | 1 | 0 | 1 | 1 |
| ats | 4 | 0 | 0 | 0 |
| auth | 1 | 0 | 1 | 0 |
| campaigns | 2 | 0 | 0 | 0 |
| catalog | 4 | 0 | 0 | 0 |
| communications | 1 | 0 | 0 | 0 |
| companies | 2 | 0 | 0 | 1 |
| compliance | 1 | 0 | 1 | 0 |
| contacts | 2 | 0 | 0 | 1 |
| contracts | 5 | 0 | 3 | 4 |
| dashboard | 1 | 0 | 1 | 0 |
| dashboards | 1 | 0 | 1 | 1 |
| deals | 2 | 1 | 1 | 0 |
| dei-analytics | 1 | 0 | 0 | 0 |
| files | 1 | 0 | 0 | 0 |
| finance | 16 | 0 | 12 | 12 |
| forms | 1 | 0 | 0 | 0 |
| fraud-flags | 1 | 0 | 0 | 0 |
| home | 3 | 0 | 1 | 0 |
| inbox | 4 | 0 | 2 | 2 |
| integrations | 4 | 0 | 0 | 0 |
| invoices | 1 | 0 | 1 | 1 |
| landing-pages | 2 | 0 | 0 | 0 |
| leads | 3 | 0 | 0 | 1 |
| marketplace | 3 | 0 | 0 | 0 |
| match-scores | 1 | 0 | 0 | 0 |
| meetings | 1 | 0 | 0 | 0 |
| modules | 1 | 0 | 1 | 0 |
| my-bug-reports | 1 | 0 | 0 | 0 |
| notes | 1 | 0 | 0 | 0 |
| onboarding | 1 | 0 | 1 | 1 |
| people | 14 | 0 | 14 | 14 |
| projects | 9 | 0 | 9 | 9 |
| projects_ | 1 | 0 | 1 | 1 |
| proposals | 3 | 0 | 0 | 0 |
| prospecting | 5 | 0 | 2 | 1 |
| qa | 1 | 0 | 1 | 1 |
| reports | 1 | 0 | 1 | 1 |
| services | 2 | 0 | 1 | 1 |
| settings | 97 | 0 | 22 | 20 |
| surveys | 1 | 0 | 0 | 0 |
| tasks | 4 | 0 | 0 | 0 |
| tickets | 2 | 0 | 1 | 2 |
| workspace | 2 | 0 | 0 | 0 |

## Rotas com legado local

- `/admin/bug-reports` — `src/routes/_authenticated/admin.bug-reports.tsx`
- `/admin/workspaces/$id` — `src/routes/_authenticated/admin.workspaces.$id.tsx`
- `/admin/workspaces` — `src/routes/_authenticated/admin.workspaces.tsx`
- `/analytics` — `src/routes/_authenticated/analytics.tsx`
- `/companies/$id` — `src/routes/_authenticated/companies.$id.tsx`
- `/contacts/$id` — `src/routes/_authenticated/contacts.$id.tsx`
- `/contracts/$id` — `src/routes/_authenticated/contracts.$id.tsx`
- `/contracts` — `src/routes/_authenticated/contracts.index.tsx`
- `/contracts/links` — `src/routes/_authenticated/contracts.links.tsx`
- `/contracts/templates` — `src/routes/_authenticated/contracts.templates.index.tsx`
- `/dashboards` — `src/routes/_authenticated/dashboards.tsx`
- `/finance/audit` — `src/routes/_authenticated/finance.audit.tsx`
- `/finance/bank-accounts` — `src/routes/_authenticated/finance.bank-accounts.tsx`
- `/finance/banking/reconciliation` — `src/routes/_authenticated/finance.banking.reconciliation.tsx`
- `/finance/banking` — `src/routes/_authenticated/finance.banking.tsx`
- `/finance/cash-flow` — `src/routes/_authenticated/finance.cash-flow.tsx`
- `/finance/categories` — `src/routes/_authenticated/finance.categories.tsx`
- `/finance/cost-centers` — `src/routes/_authenticated/finance.cost-centers.tsx`
- `/finance/dre` — `src/routes/_authenticated/finance.dre.tsx`
- `/finance/entries/$id` — `src/routes/_authenticated/finance.entries.$id.tsx`
- `/finance` — `src/routes/_authenticated/finance.index.tsx`
- `/finance/nfse` — `src/routes/_authenticated/finance.nfse.tsx`
- `/finance/recurrences` — `src/routes/_authenticated/finance.recurrences.tsx`
- `/inbox/chat` — `src/routes/_authenticated/inbox.chat.tsx`
- `/inbox` — `src/routes/_authenticated/inbox.index.tsx`
- `/invoices` — `src/routes/_authenticated/invoices.tsx`
- `/leads/$id` — `src/routes/_authenticated/leads.$id.tsx`
- `/onboarding/$entity` — `src/routes/_authenticated/onboarding.$entity.tsx`
- `/people/$id` — `src/routes/_authenticated/people.$id.tsx`
- `/people/analytics` — `src/routes/_authenticated/people.analytics.tsx`
- `/people/benefits` — `src/routes/_authenticated/people.benefits.tsx`
- `/people/billing` — `src/routes/_authenticated/people.billing.tsx`
- `/people/contract-margin` — `src/routes/_authenticated/people.contract-margin.tsx`
- `/people/documents` — `src/routes/_authenticated/people.documents.tsx`
- `/people/import-forms` — `src/routes/_authenticated/people.import-forms.tsx`
- `/people/incidents` — `src/routes/_authenticated/people.incidents.tsx`
- `/people` — `src/routes/_authenticated/people.index.tsx`
- `/people/my-team` — `src/routes/_authenticated/people.my-team.tsx`
- `/people/offboarding` — `src/routes/_authenticated/people.offboarding.tsx`
- `/people/onboarding-templates` — `src/routes/_authenticated/people.onboarding-templates.tsx`
- `/people/onboarding` — `src/routes/_authenticated/people.onboarding.tsx`
- `/people/psychosocial` — `src/routes/_authenticated/people.psychosocial.tsx`
- `/projects/$id` — `src/routes/_authenticated/projects.$id.tsx`
- `/projects/hours-review` — `src/routes/_authenticated/projects.hours-review.tsx`
- `/projects` — `src/routes/_authenticated/projects.index.tsx`
- `/projects/lists/$id` — `src/routes/_authenticated/projects.lists.$id.tsx`
- `/projects/my-hours` — `src/routes/_authenticated/projects.my-hours.tsx`
- `/projects/my-work` — `src/routes/_authenticated/projects.my-work.tsx`
- `/projects/spaces` — `src/routes/_authenticated/projects.spaces.tsx`
- `/projects/tasks` — `src/routes/_authenticated/projects.tasks.tsx`
- `/projects/timesheet` — `src/routes/_authenticated/projects.timesheet.tsx`
- `/projects_/$id/entrega` — `src/routes/_authenticated/projects_.$id.entrega.tsx`
- `/prospecting/campaigns` — `src/routes/_authenticated/prospecting.campaigns.index.tsx`
- `/qa/test-cases` — `src/routes/_authenticated/qa.test-cases.tsx`
- `/reports` — `src/routes/_authenticated/reports.tsx`
- `/services` — `src/routes/_authenticated/services.index.tsx`
- `/settings/ads-sync` — `src/routes/_authenticated/settings.ads-sync.tsx`
- `/settings/billing` — `src/routes/_authenticated/settings.billing.tsx`
- `/settings/charging-templates` — `src/routes/_authenticated/settings.charging-templates.tsx`
- `/settings/dunning` — `src/routes/_authenticated/settings.dunning.tsx`
- `/settings/hubspot-users` — `src/routes/_authenticated/settings.hubspot-users.tsx`
- `/settings/kb` — `src/routes/_authenticated/settings.kb.tsx`
- `/settings/lead-sources` — `src/routes/_authenticated/settings.lead-sources.tsx`
- `/settings/nfse` — `src/routes/_authenticated/settings.nfse.tsx`
- `/settings/notifications/slack` — `src/routes/_authenticated/settings.notifications.slack.tsx`
- `/settings/notifications` — `src/routes/_authenticated/settings.notifications.tsx`
- `/settings/onboarding-templates` — `src/routes/_authenticated/settings.onboarding-templates.tsx`
- `/settings/payments` — `src/routes/_authenticated/settings.payments.tsx`
- `/settings/privacy` — `src/routes/_authenticated/settings.privacy.tsx`
- `/settings/record-layouts` — `src/routes/_authenticated/settings.record-layouts.tsx`
- `/settings/scim` — `src/routes/_authenticated/settings.scim.tsx`
- `/settings/security` — `src/routes/_authenticated/settings.security.tsx`
- `/settings/segments` — `src/routes/_authenticated/settings.segments.tsx`
- `/settings/user-groups` — `src/routes/_authenticated/settings.user-groups.tsx`
- `/settings/widget` — `src/routes/_authenticated/settings.widget.tsx`
- `/settings/zapier` — `src/routes/_authenticated/settings.zapier.tsx`
- `/tickets/$id` — `src/routes/_authenticated/tickets.$id.tsx`
- `/tickets` — `src/routes/_authenticated/tickets.tsx`
