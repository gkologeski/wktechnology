# Auditoria Fase 2 — Core, compartilhado, settings, plataforma e rotas públicas

## Natureza e limites
Auditoria estática, somente leitura. Entregáveis em `/tmp`; nenhum arquivo de projeto, banco, permissão ou publicação alterado. Código fonte local é a evidência; não houve consulta a dados de clientes, captura de segredos, chamada a integrações ou validação do ambiente publicado. Leitura dos componentes diretos e funções importadas não equivale a auditoria exaustiva de todas as dependências/RLS em execução.

## Entregáveis e formato
- `/tmp/help-core-articles.json`: 133 artigos completos novos em lista de objetos `metadata` + `body_markdown`, sem campos extras de proveniência no esquema. Todos são rascunhos (`is_published=false`), `audience=internal`, `version=1`. Não são seed aplicado.
- `/tmp/help-core-existing-articles.json`: 4 artigos existentes que correspondem exatamente a rotas do recorte; corpo preservado e metadados normalizados. Arquivo comparativo separado, não reinserir como conteúdo novo.
- O banco e o script oficial usam `body_md`; o JSON solicitado usa `body_markdown`. A futura conversão precisa mapear esse campo, gravar o frontmatter em `docs/help/<módulo>/` e gerar migration idempotente, sem alterar migrations antigas.
- Nenhum howto afirma comprovação de entrega externa. Marcadores screenshot usam dados fictícios; não foram adicionados a `pendencias-midia.md` por restrição somente leitura.

## Contagens
- Artigos versionados lidos: 278: {'ats': 39, 'contracts': 52, 'crm': 96, 'people': 21, 'finance': 35, 'projects': 35}. Não existe diretório de artigos Core/platform nesta cópia.
- Inventário: Core contém 83 rotas únicas (o cabeçalho fala 84 telas e inclui duplicação de `/settings` e `/` layout/redirect); plataforma 9; públicas 38. Catálogo de recursos abaixo da tabela não foi contado como rota.
- Novos por módulo: {'core': 81, 'contracts': 4, 'crm': 22, 'finance': 4, 'platform': 14, 'people': 1, 'ats': 7}. Apenas `core` e `platform` são áreas transversais; os rascunhos verticais ficam classificados no respectivo módulo, não como novos módulos.
- Artigos de base por Core/platform: visão geral, primeiros 15 minutos, campos/estados, permissões, erros comuns e FAQ (6 por área).
- Fontes diretas registradas: 332 arquivos. O comparativo é de arquivos locais, não prova de presença/ausência no banco publicado.

## Critérios e decisões editoriais
- Não criar artigo para layout, redirect, endpoint ou protótipo. `/settings` tem um artigo de perfil, não um para o layout. `/settings/workspace-team` redireciona para Membros. `/` redireciona para `/home`.
- `/qa/test-cases`: excluída da publicação por ser ferramenta interna de QA sem certificação de tela oficial para treinamento; o arquivo não contém gate explícito de plataforma. Não inferir autorização só pela seção do inventário.
- Rotas públicas oficiais com interface recebem guia interno, no módulo responsável. Nenhum artigo foi marcado `client` ou promete consulta pública da Ajuda.
- Reservados endpoints `/lovable/email/*`, `/mcp` e `/sitemap.xml` não são howtos de tela. Não documentar payloads/contratos sem escopo e confirmação próprios.
- Os guias gerados são base editorial por tela. A regra “um howto por funcionalidade” ainda exige decomposição dos fluxos complexos (importações, branding, matriz de permissões, integrações, ações destrutivas e lifecycle). Não alegar cobertura funcional integral só por cobrir a rota.

## Lacunas, dúvidas e divergências
1. **Chave única versus menu OR.** `min_permission` suporta uma chave; menus aceitam `need` e `permissionAny` com várias chaves, e o gate de URL usa `.view` com escopos próprios. Fixar a primeira chave pode esconder ajuda de um usuário legítimo. Foram usadas somente chaves verificadas no catálogo quando extraídas de `adminAny`; casos ambíguos ficam nulos e TODOS os artigos ficam despublicados. Resolver política de equivalência/alternativas antes de publicar.
2. **Telefones.** Menu usa `system.language`, gate `/settings/phones` usa `system.phone_normalization`. Não copiar chave errada para o artigo; corrigir alinhamento em entrega própria após análise de servidor/RPC.
3. **Marketplace.** Menu usa `system.marketplace`; gate usa `system.integrations`. Confirmar qual fronteira é normativa antes de preencher `min_permission`.
4. **IA.** Menu agrupa sob Integrações, mas `/settings/integrations/ai` e `/settings/ai-panel` usam `system.ai_settings`. Documentar o gate específico, não presumir chave genérica suficiente.
5. **Política de acesso.** `settings.access-policy.tsx` limita o switch principal por `canManage`, porém botões de adicionar/remover e switches de MFA/SSO não têm a mesma proteção visual. `security.functions.ts` usa middleware view também nas mutações e delega a `shared_security_settings`; precisa confirmar a autorização de escrita no RPC antes de concluir vulnerabilidade. Não afirmar que a UI prova enforcement total de IP/MFA/SSO.
6. **Allow-list.** `isIpAllowed` permite lista vazia e trata qualquer entrada com `/` pelo prefixo dos três primeiros octetos. Não é implementação CIDR genérica. Confirmar locais de chamada e cobertura de login antes de anunciar bloqueio por faixas.
7. **Residência.** Seleção BR/US/EU é preferência; não há evidência de migração física na tela. Não prometer soberania, prazo ou transferência efetiva.
8. **SSO.** Tela informativa orienta configuração via administração Lovable Cloud. Badges não comprovam JIT/mapeamento ativo. SCIM tem emissão/revogação de token, mas compatibilidade e enforcement dos endpoints precisam de validação separada.
9. **Quotas.** `PLAN_LIMITS` é display-only; texto de alerta em 80% não prova bloqueio nem cobrança. Não congelar valores comerciais nos artigos.
10. **Sandbox.** Existe criação e lifecycle na interface; anonimização, clonagem completa e bloqueio de integrações não foram certificados. Evitar instruções que levem a uso inseguro de dados reais.
11. **Cláusulas.** `/settings/clauses` usa `proposals.functions`; responsabilidade editorial de contracts é provisória e tem `[CONFIRMAR]`. Modelos de proposta são próprios e não são cláusulas contratuais.
12. **Classificação.** Settings não define módulo: NFS-e/pagamentos/recorrências/Conta Azul são finance; assinatura é contracts; scoring, metas, pipelines comerciais, voz, pesquisas e modelos comerciais são crm. Catálogos compartilhados não devem ser apresentados como catálogos nativos de ATS.
13. **Ajuda e bypass.** Guia arquitetural descreve leitura estrita; `canReadHelpArticle` retorna true primeiro para quem pode editar e `canReadHelpModule` primeiro para platform admin. Editor vê rascunhos e outros públicos, comportamento diferente de leitura comum. Confirmar alinhamento com servidor/RLS; não apresentar o guia como teste de banco. Arquitetura cita migration 0305, mas o arquivo local é `0306_help_center.sql`.
14. **Cobertura automatizada.** `MODULE_ROUTES` só inclui crm, ats, people e contracts, não Core/platform/projects/finance. Gate atual não certifica este recorte. Falta incluir inventário validado em entrega de implementação, sem regenerar baseline de permissões.
15. **Escopo de testes.** Não houve execução de testes com escrita nem build/typecheck, porque não houve alteração do projeto. JSON validado estruturalmente por script local em /tmp; nenhum teste de acesso direto/API/RLS foi executado. Revisão funcional e de autorização é condição de publicação.
16. **Materiais remanescentes.** Comparativo de artigos existentes por rota segue abaixo; ausência por route_pattern exato pode ser cobertura textual em outro artigo. Não confundir ausência de fonte Markdown com ausência no banco.

## Matriz de rotas e artigos existentes
| Grupo inventário | Rota | Decisão nesta entrega | Artigos existentes por rota exata |
|---|---|---|---|
| core | `/` | sem artigo: layout/redirecionamento | — |
| core | `/auth/extension-link` | novo rascunho | — |
| core | `/catalog/contracting-presets` | novo rascunho | — |
| core | `/catalog/services` | novo rascunho | — |
| core | `/files` | novo rascunho | — |
| core | `/home` | novo rascunho | — |
| core | `/home/print` | novo rascunho | — |
| core | `/modules` | novo rascunho | — |
| core | `/onboarding/$entity` | novo rascunho | — |
| core | `/settings` | novo rascunho | — |
| core | `/settings/access-policy` | novo rascunho | — |
| core | `/settings/ads-sync` | novo rascunho | — |
| core | `/settings/ai-panel` | novo rascunho | — |
| core | `/settings/api-keys` | novo rascunho | — |
| core | `/settings/audit-export` | novo rascunho | — |
| core | `/settings/audit-log` | novo rascunho | — |
| core | `/settings/billing` | novo rascunho | — |
| core | `/settings/branding` | novo rascunho | — |
| core | `/settings/channels` | novo rascunho | — |
| core | `/settings/clauses` | novo rascunho vertical: contracts | — |
| core | `/settings/custom-objects` | novo rascunho | — |
| core | `/settings/custom-properties` | novo rascunho | — |
| core | `/settings/data-residency` | novo rascunho | — |
| core | `/settings/email-templates` | novo rascunho vertical: crm | — |
| core | `/settings/enrichment` | novo rascunho vertical: crm | crm/enriquecer-cadastros |
| core | `/settings/esign` | novo rascunho vertical: contracts | contracts/gerenciar-documentos-assinatura |
| core | `/settings/exports` | novo rascunho | — |
| core | `/settings/forms` | novo rascunho vertical: crm | — |
| core | `/settings/goals` | novo rascunho vertical: crm | — |
| core | `/settings/hubspot-users` | novo rascunho | — |
| core | `/settings/import` | novo rascunho | — |
| core | `/settings/import-csv` | novo rascunho | — |
| core | `/settings/integrations` | novo rascunho | — |
| core | `/settings/integrations/$slug` | novo rascunho | — |
| core | `/settings/integrations/ai` | novo rascunho | — |
| core | `/settings/integrations/contaazul` | novo rascunho vertical: finance | finance/integracoes |
| core | `/settings/integrations/linkedin` | novo rascunho | — |
| core | `/settings/language` | novo rascunho | — |
| core | `/settings/lead-sources` | novo rascunho vertical: crm | — |
| core | `/settings/legal-entities` | novo rascunho | — |
| core | `/settings/legal-entity-groups` | novo rascunho | — |
| core | `/settings/marketplace` | novo rascunho | — |
| core | `/settings/marketplace/$slug` | novo rascunho | — |
| core | `/settings/media` | novo rascunho | — |
| core | `/settings/meeting-reminders` | novo rascunho vertical: crm | — |
| core | `/settings/mobile` | novo rascunho | — |
| core | `/settings/my-permissions` | novo rascunho | — |
| core | `/settings/my-tickets` | novo rascunho | — |
| core | `/settings/nfse` | novo rascunho vertical: finance | — |
| core | `/settings/notifications` | novo rascunho | — |
| core | `/settings/notifications/slack` | novo rascunho | — |
| core | `/settings/onboarding-templates` | novo rascunho | — |
| core | `/settings/payments` | novo rascunho vertical: finance | — |
| core | `/settings/permissions` | novo rascunho | — |
| core | `/settings/phones` | novo rascunho | — |
| core | `/settings/pipelines` | novo rascunho vertical: crm | — |
| core | `/settings/playbooks` | novo rascunho vertical: crm | — |
| core | `/settings/privacy` | novo rascunho | — |
| core | `/settings/property-groups` | novo rascunho | — |
| core | `/settings/proposal-templates` | novo rascunho vertical: crm | — |
| core | `/settings/quote-templates` | novo rascunho vertical: crm | — |
| core | `/settings/rbac-diagnostics` | novo rascunho | — |
| core | `/settings/record-layouts` | novo rascunho | — |
| core | `/settings/recurring` | novo rascunho vertical: finance | — |
| core | `/settings/scim` | novo rascunho | — |
| core | `/settings/scoring` | novo rascunho vertical: crm | — |
| core | `/settings/security` | novo rascunho | — |
| core | `/settings/segments` | novo rascunho vertical: crm | — |
| core | `/settings/snippets` | novo rascunho | — |
| core | `/settings/sso` | novo rascunho | — |
| core | `/settings/subscriptions` | novo rascunho | — |
| core | `/settings/surveys` | novo rascunho vertical: crm | — |
| core | `/settings/teams` | novo rascunho | — |
| core | `/settings/user-groups` | novo rascunho | — |
| core | `/settings/video` | novo rascunho vertical: crm | — |
| core | `/settings/voice-agent` | novo rascunho vertical: crm | — |
| core | `/settings/webhooks` | novo rascunho | — |
| core | `/settings/whatsapp` | novo rascunho | — |
| core | `/settings/widget` | novo rascunho | — |
| core | `/settings/workflow-subscriptions` | novo rascunho | — |
| core | `/settings/workspace-team` | sem artigo: layout/redirecionamento | — |
| core | `/settings/zapier` | novo rascunho | — |
| core | `/workspace/modules` | novo rascunho | — |
| platform | `/admin/bug-reports` | novo rascunho | — |
| platform | `/admin/workspaces` | novo rascunho | — |
| platform | `/admin/workspaces/$id` | novo rascunho | — |
| platform | `/qa/test-cases` | excluído: ferramenta QA interna, não certificada oficial nem protegida como plataforma no arquivo da rota | — |
| platform | `/settings/platform/alerts` | novo rascunho | — |
| platform | `/settings/platform/quotas` | novo rascunho | — |
| platform | `/settings/platform/sandbox` | novo rascunho | — |
| platform | `/settings/platform/security` | novo rascunho | — |
| platform | `/settings/platform/status` | novo rascunho | — |
| public | `/accept-employment/$token` | novo rascunho vertical: people | — |
| public | `/accept-invite` | novo rascunho | — |
| public | `/accept-invite/$token` | novo rascunho | — |
| public | `/book/$slug` | novo rascunho vertical: crm | — |
| public | `/careers` | novo rascunho vertical: ats | — |
| public | `/careers/$slug` | novo rascunho vertical: ats | — |
| public | `/dpa` | novo rascunho | — |
| public | `/interview/$token` | novo rascunho vertical: ats | — |
| public | `/kb` | novo rascunho | — |
| public | `/kb/$slug` | novo rascunho | — |
| public | `/login` | novo rascunho | — |
| public | `/lovable/email/auth/preview` | sem tela TSX: endpoint/handler, não gerar howto de interface | — |
| public | `/lovable/email/auth/webhook` | sem tela TSX: endpoint/handler, não gerar howto de interface | — |
| public | `/lovable/email/events` | sem tela TSX: endpoint/handler, não gerar howto de interface | — |
| public | `/lovable/email/transactional/preview` | sem tela TSX: endpoint/handler, não gerar howto de interface | — |
| public | `/lp/$slug` | novo rascunho vertical: crm | — |
| public | `/mcp` | sem tela TSX: endpoint/handler, não gerar howto de interface | — |
| public | `/meet/$token` | novo rascunho vertical: crm | — |
| public | `/offer/$token` | novo rascunho vertical: ats | — |
| public | `/portal/$token` | novo rascunho vertical: crm | — |
| public | `/privacy` | novo rascunho | — |
| public | `/proposal/$token` | novo rascunho vertical: crm | — |
| public | `/quote/$token` | novo rascunho vertical: crm | — |
| public | `/refer/$slug` | novo rascunho vertical: ats | — |
| public | `/refund` | novo rascunho | — |
| public | `/reset-password` | novo rascunho | — |
| public | `/role-profile/$token` | novo rascunho vertical: ats | — |
| public | `/sales` | novo rascunho | — |
| public | `/schedule/$token` | novo rascunho vertical: ats | — |
| public | `/sign/$token` | novo rascunho vertical: contracts | contracts/assinar-por-link |
| public | `/signup` | novo rascunho | — |
| public | `/sitemap.xml` | sem tela TSX: endpoint/handler, não gerar howto de interface | — |
| public | `/survey/$token` | novo rascunho vertical: crm | — |
| public | `/terms` | novo rascunho | — |
| public | `/unipile-connected` | novo rascunho | — |
| public | `/unsubscribe` | novo rascunho | — |
| public | `/verify/$hash` | novo rascunho vertical: contracts | — |
| public | `/widget/$workspaceId` | novo rascunho | — |

## Fontes de código consultadas

As fontes abaixo foram lidas localmente. Rotas e seus imports diretos fundamentam os guias; a lista não é certificação individual de todas as regras de negócio e políticas SQL.

- `docs/architecture/help-center.md`
- `docs/help/inventario.md`
- `docs/security/permission-key-catalog.json`
- `src/components/access-control/effective-permissions-panel.tsx`
- `src/components/access-control/field-rules-panel.tsx`
- `src/components/access-control/permissions-matrix.tsx`
- `src/components/account-menu.tsx`
- `src/components/activity/activity-windows.tsx`
- `src/components/admin/workspace-lifecycle-dialogs.tsx`
- `src/components/ai/ai-panel-page.tsx`
- `src/components/app-sidebar.tsx`
- `src/components/billing/module-plans-section.tsx`
- `src/components/branding/branding-builder.tsx`
- `src/components/branding/invite-email-branding-form.tsx`
- `src/components/branding/module-branding-form.tsx`
- `src/components/bug-report/bug-report-button.tsx`
- `src/components/bug-report/bug-report-dialog.tsx`
- `src/components/bug-report/bug-report-images.tsx`
- `src/components/bug-report/resolution-dialog.tsx`
- `src/components/bug-reports/pages/my-bug-reports-page.tsx`
- `src/components/catalog/contracting-presets-panel.tsx`
- `src/components/catalog/job-profiles-panel.tsx`
- `src/components/chat/chat-trigger.tsx`
- `src/components/cross-module-banner.tsx`
- `src/components/crud-settings.tsx`
- `src/components/date-range-picker.tsx`
- `src/components/deals/deals-board-card.tsx`
- `src/components/filter-builder-dialog.tsx`
- `src/components/finance/legal-entities-page.tsx`
- `src/components/finance/legal-entity-groups-page.tsx`
- `src/components/floating-dock/side-dock.tsx`
- `src/components/focus-queue-bar.tsx`
- `src/components/forms/forms-page.tsx`
- `src/components/global-search-trigger.tsx`
- `src/components/global-search/global-search.tsx`
- `src/components/help/help-button.tsx`
- `src/components/hiring/access-models-panel.tsx`
- `src/components/hr-access.tsx`
- `src/components/integrations/pages/ai-provider-page.tsx`
- `src/components/integrations/pages/contaazul-integration-page.tsx`
- `src/components/integrations/pages/import-hub-page.tsx`
- `src/components/integrations/pages/integration-detail-page.tsx`
- `src/components/integrations/pages/integrations-catalog-page.tsx`
- `src/components/iso-date-picker.tsx`
- `src/components/kanban/kanban-board.tsx`
- `src/components/kanban/view-mode-toggle.tsx`
- `src/components/landing-pages/blocks.tsx`
- `src/components/marketplace/pages/marketplace-detail-page.tsx`
- `src/components/marketplace/pages/marketplace-list-page.tsx`
- `src/components/module-switcher.tsx`
- `src/components/notifications-bell.tsx`
- `src/components/onboarding/onboarding-wizard.tsx`
- `src/components/page-header.tsx`
- `src/components/phone/phone-country-provider.tsx`
- `src/components/phone/phone-legacy-review-dialog.tsx`
- `src/components/phone/phone-review-record-link.tsx`
- `src/components/pipelines/stage-substatuses-editor.tsx`
- `src/components/platform/pages/platform-alerts-page.tsx`
- `src/components/platform/pages/platform-quotas-page.tsx`
- `src/components/platform/pages/platform-sandbox-page.tsx`
- `src/components/platform/pages/platform-security-scans-page.tsx`
- `src/components/platform/pages/platform-status-page.tsx`
- `src/components/proposals/proposal-document.tsx`
- `src/components/prospecting/pages/enrichment-history-page.tsx`
- `src/components/prospecting/pages/playbooks-page.tsx`
- `src/components/prospecting/pages/scoring-page.tsx`
- `src/components/prospecting/pages/voice-agent-page.tsx`
- `src/components/quick-create-menu.tsx`
- `src/components/quote-templates/template-editor.tsx`
- `src/components/quote-templates/visual-editor.tsx`
- `src/components/rich-html-editor.tsx`
- `src/components/route-breadcrumbs.tsx`
- `src/components/sales-access.tsx`
- `src/components/service-channels/account-editor.tsx`
- `src/components/service-channels/connection-configuration.tsx`
- `src/components/service-channels/whatsapp-configuration.tsx`
- `src/components/service-channels/widget-configuration.tsx`
- `src/components/settings-menu.tsx`
- `src/components/snippets/snippet-form-dialog.tsx`
- `src/components/surveys/surveys-page.tsx`
- `src/components/teams/deactivate-member-dialog.tsx`
- `src/components/teams/unlinked-accounts-card.tsx`
- `src/components/timer-widget.tsx`
- `src/components/view-as/view-as-banner.tsx`
- `src/components/view-as/view-as-switcher.tsx`
- `src/components/whatsapp/meeting-reminders-page.tsx`
- `src/components/word-editor-lazy.tsx`
- `src/components/workspace-menu.tsx`
- `src/components/workspace-outlet.tsx`
- `src/components/workspace-settings-access.tsx`
- `src/hooks/use-idle-list-preload.ts`
- `src/hooks/use-module-access.ts`
- `src/hooks/use-module-licenses.ts`
- `src/hooks/use-persisted-date-range.ts`
- `src/hooks/use-workspace-members.ts`
- `src/integrations/supabase/client.ts`
- `src/lib/access-control/action-matrix.ts`
- `src/lib/access-control/admin-permission-keys.ts`
- `src/lib/access-control/permissions.functions.ts`
- `src/lib/access-control/rbac-diagnostics.functions.ts`
- `src/lib/access-control/sales-route-map.ts`
- `src/lib/access-control/shared-permission.middleware.ts`
- `src/lib/access-control/use-permissions.tsx`
- `src/lib/access-control/use-shared-action.ts`
- `src/lib/access-control/use-work-capabilities.ts`
- `src/lib/ads-sync.functions.ts`
- `src/lib/api-keys.functions.ts`
- `src/lib/app-url.ts`
- `src/lib/ats/public-offer.functions.ts`
- `src/lib/ats/public.functions.ts`
- `src/lib/ats/self-schedule.functions.ts`
- `src/lib/audit-export.functions.ts`
- `src/lib/audit.functions.ts`
- `src/lib/auth.tsx`
- `src/lib/billing.functions.ts`
- `src/lib/bug-report-analysis.functions.ts`
- `src/lib/bug-report-taxonomy.ts`
- `src/lib/bug-reports-notify.functions.ts`
- `src/lib/bug-reports.functions.ts`
- `src/lib/contracting-presets-shared.ts`
- `src/lib/contracting-presets.functions.ts`
- `src/lib/crm.ts`
- `src/lib/csv-import-rows.ts`
- `src/lib/csv-import.functions.ts`
- `src/lib/custom-objects.functions.ts`
- `src/lib/custom-properties.functions.ts`
- `src/lib/db/delete-guarded.ts`
- `src/lib/email-address.ts`
- `src/lib/email-templates.functions.ts`
- `src/lib/entitlements.ts`
- `src/lib/esign.functions.ts`
- `src/lib/files.functions.ts`
- `src/lib/filters.ts`
- `src/lib/goals.functions.ts`
- `src/lib/help/help-access.ts`
- `src/lib/help/help-route-match.ts`
- `src/lib/hiring/employment.functions.ts`
- `src/lib/home/dashboard-export.ts`
- `src/lib/home/dashboard.functions.ts`
- `src/lib/hosts.ts`
- `src/lib/i18n.tsx`
- `src/lib/integrations/hubspot-owners.functions.ts`
- `src/lib/iso-date.ts`
- `src/lib/job-profiles-shared.ts`
- `src/lib/kb.functions.ts`
- `src/lib/landing-pages.functions.ts`
- `src/lib/lead-sources.ts`
- `src/lib/leads/lead-relations.ts`
- `src/lib/lgpd.functions.ts`
- `src/lib/line-item-display.ts`
- `src/lib/media.functions.ts`
- `src/lib/meetings-public.functions.ts`
- `src/lib/meetings.functions.ts`
- `src/lib/menu-audit.ts`
- `src/lib/menu-config-core.ts`
- `src/lib/menu-config.ts`
- `src/lib/message-tokens-catalog.ts`
- `src/lib/modules/active-module.ts`
- `src/lib/modules/registry.ts`
- `src/lib/notifications.functions.ts`
- `src/lib/onboarding/onboarding.functions.ts`
- `src/lib/payments-settings.functions.ts`
- `src/lib/phone/phone-country-context.ts`
- `src/lib/phone/phone-review.ts`
- `src/lib/phone/phone-settings.functions.ts`
- `src/lib/platform-admin.functions.ts`
- `src/lib/platform-domains.ts`
- `src/lib/portal.functions.ts`
- `src/lib/property-groups.functions.ts`
- `src/lib/proposals.functions.ts`
- `src/lib/proposals/proposal-document-types.ts`
- `src/lib/proposals/proposal-document.functions.ts`
- `src/lib/proposals/proposal-template-html.ts`
- `src/lib/proposals/proposal-templates.functions.ts`
- `src/lib/prospecting/sdr/channel-accounts.functions.ts`
- `src/lib/push.functions.ts`
- `src/lib/pwa.ts`
- `src/lib/quote-template-blocks.ts`
- `src/lib/quote-template-renderer.ts`
- `src/lib/quote-templates.functions.ts`
- `src/lib/quotes.functions.ts`
- `src/lib/record-layouts.functions.ts`
- `src/lib/recurring.functions.ts`
- `src/lib/reports.functions.ts`
- `src/lib/role-profiles/schema.ts`
- `src/lib/scheduled-exports.functions.ts`
- `src/lib/scim.functions.ts`
- `src/lib/security.functions.ts`
- `src/lib/segments.functions.ts`
- `src/lib/slack.functions.ts`
- `src/lib/snippets.functions.ts`
- `src/lib/surveys.functions.ts`
- `src/lib/teams.functions.ts`
- `src/lib/unipile/accounts.functions.ts`
- `src/lib/use-entitlements.ts`
- `src/lib/use-my-role.ts`
- `src/lib/use-platform-admin.ts`
- `src/lib/user-groups.functions.ts`
- `src/lib/utils.ts`
- `src/lib/view-as-client.ts`
- `src/lib/webhooks.functions.ts`
- `src/lib/workflow-subscriptions.functions.ts`
- `src/lib/workspace-invites.functions.ts`
- `src/lib/workspace/modules.functions.ts`
- `src/lib/zapier.functions.ts`
- `src/routes/_authenticated.tsx`
- `src/routes/_authenticated/admin.bug-reports.tsx`
- `src/routes/_authenticated/admin.workspaces.$id.tsx`
- `src/routes/_authenticated/admin.workspaces.tsx`
- `src/routes/_authenticated/auth/extension-link.tsx`
- `src/routes/_authenticated/catalog.contracting-presets.tsx`
- `src/routes/_authenticated/catalog.services.tsx`
- `src/routes/_authenticated/files.tsx`
- `src/routes/_authenticated/home.index.tsx`
- `src/routes/_authenticated/home.print.tsx`
- `src/routes/_authenticated/modules.index.tsx`
- `src/routes/_authenticated/onboarding.$entity.tsx`
- `src/routes/_authenticated/qa.test-cases.tsx`
- `src/routes/_authenticated/settings.access-policy.tsx`
- `src/routes/_authenticated/settings.ads-sync.tsx`
- `src/routes/_authenticated/settings.ai-panel.tsx`
- `src/routes/_authenticated/settings.api-keys.tsx`
- `src/routes/_authenticated/settings.audit-export.tsx`
- `src/routes/_authenticated/settings.audit-log.tsx`
- `src/routes/_authenticated/settings.billing.tsx`
- `src/routes/_authenticated/settings.branding.tsx`
- `src/routes/_authenticated/settings.channels.tsx`
- `src/routes/_authenticated/settings.clauses.tsx`
- `src/routes/_authenticated/settings.custom-objects.tsx`
- `src/routes/_authenticated/settings.custom-properties.tsx`
- `src/routes/_authenticated/settings.data-residency.tsx`
- `src/routes/_authenticated/settings.email-templates.tsx`
- `src/routes/_authenticated/settings.enrichment.tsx`
- `src/routes/_authenticated/settings.esign.tsx`
- `src/routes/_authenticated/settings.exports.tsx`
- `src/routes/_authenticated/settings.forms.tsx`
- `src/routes/_authenticated/settings.goals.tsx`
- `src/routes/_authenticated/settings.hubspot-users.tsx`
- `src/routes/_authenticated/settings.import-csv.tsx`
- `src/routes/_authenticated/settings.import.tsx`
- `src/routes/_authenticated/settings.index.tsx`
- `src/routes/_authenticated/settings.integrations.$slug.tsx`
- `src/routes/_authenticated/settings.integrations.ai.tsx`
- `src/routes/_authenticated/settings.integrations.contaazul.tsx`
- `src/routes/_authenticated/settings.integrations.index.tsx`
- `src/routes/_authenticated/settings.integrations.linkedin.tsx`
- `src/routes/_authenticated/settings.language.tsx`
- `src/routes/_authenticated/settings.lead-sources.tsx`
- `src/routes/_authenticated/settings.legal-entities.tsx`
- `src/routes/_authenticated/settings.legal-entity-groups.tsx`
- `src/routes/_authenticated/settings.marketplace.$slug.tsx`
- `src/routes/_authenticated/settings.marketplace.index.tsx`
- `src/routes/_authenticated/settings.media.tsx`
- `src/routes/_authenticated/settings.meeting-reminders.tsx`
- `src/routes/_authenticated/settings.mobile.tsx`
- `src/routes/_authenticated/settings.my-permissions.tsx`
- `src/routes/_authenticated/settings.my-tickets.tsx`
- `src/routes/_authenticated/settings.nfse.tsx`
- `src/routes/_authenticated/settings.notifications.slack.tsx`
- `src/routes/_authenticated/settings.notifications.tsx`
- `src/routes/_authenticated/settings.onboarding-templates.tsx`
- `src/routes/_authenticated/settings.payments.tsx`
- `src/routes/_authenticated/settings.permissions.tsx`
- `src/routes/_authenticated/settings.phones.tsx`
- `src/routes/_authenticated/settings.pipelines.tsx`
- `src/routes/_authenticated/settings.platform.alerts.tsx`
- `src/routes/_authenticated/settings.platform.quotas.tsx`
- `src/routes/_authenticated/settings.platform.sandbox.tsx`
- `src/routes/_authenticated/settings.platform.security.tsx`
- `src/routes/_authenticated/settings.platform.status.tsx`
- `src/routes/_authenticated/settings.playbooks.tsx`
- `src/routes/_authenticated/settings.privacy.tsx`
- `src/routes/_authenticated/settings.property-groups.tsx`
- `src/routes/_authenticated/settings.proposal-templates.tsx`
- `src/routes/_authenticated/settings.quote-templates.tsx`
- `src/routes/_authenticated/settings.rbac-diagnostics.tsx`
- `src/routes/_authenticated/settings.record-layouts.tsx`
- `src/routes/_authenticated/settings.recurring.tsx`
- `src/routes/_authenticated/settings.scim.tsx`
- `src/routes/_authenticated/settings.scoring.tsx`
- `src/routes/_authenticated/settings.security.tsx`
- `src/routes/_authenticated/settings.segments.tsx`
- `src/routes/_authenticated/settings.snippets.tsx`
- `src/routes/_authenticated/settings.sso.tsx`
- `src/routes/_authenticated/settings.subscriptions.tsx`
- `src/routes/_authenticated/settings.surveys.tsx`
- `src/routes/_authenticated/settings.teams.tsx`
- `src/routes/_authenticated/settings.tsx`
- `src/routes/_authenticated/settings.user-groups.tsx`
- `src/routes/_authenticated/settings.video.tsx`
- `src/routes/_authenticated/settings.voice-agent.tsx`
- `src/routes/_authenticated/settings.webhooks.tsx`
- `src/routes/_authenticated/settings.whatsapp.tsx`
- `src/routes/_authenticated/settings.widget.tsx`
- `src/routes/_authenticated/settings.workflow-subscriptions.tsx`
- `src/routes/_authenticated/settings.workspace-team.tsx`
- `src/routes/_authenticated/settings.zapier.tsx`
- `src/routes/_authenticated/workspace.modules.tsx`
- `src/routes/accept-employment.$token.tsx`
- `src/routes/accept-invite.$token.tsx`
- `src/routes/accept-invite.index.tsx`
- `src/routes/book.$slug.tsx`
- `src/routes/careers.$slug.tsx`
- `src/routes/careers.index.tsx`
- `src/routes/dpa.tsx`
- `src/routes/index.tsx`
- `src/routes/interview.$token.tsx`
- `src/routes/kb.$slug.tsx`
- `src/routes/kb.index.tsx`
- `src/routes/login.tsx`
- `src/routes/lp.$slug.tsx`
- `src/routes/meet.$token.tsx`
- `src/routes/offer.$token.tsx`
- `src/routes/portal.$token.tsx`
- `src/routes/privacy.tsx`
- `src/routes/proposal.$token.tsx`
- `src/routes/quote.$token.tsx`
- `src/routes/refer.$slug.tsx`
- `src/routes/refund.tsx`
- `src/routes/reset-password.tsx`
- `src/routes/role-profile.$token.tsx`
- `src/routes/sales.tsx`
- `src/routes/schedule.$token.tsx`
- `src/routes/sign.$token.tsx`
- `src/routes/signup.tsx`
- `src/routes/survey.$token.tsx`
- `src/routes/terms.tsx`
- `src/routes/unipile-connected.tsx`
- `src/routes/unsubscribe.tsx`
- `src/routes/verify.$hash.tsx`
- `src/routes/widget.$workspaceId.tsx`
- `tests/help-coverage/module-routes.ts`

## Próxima entrega recomendada (não aplicada)
1. Validar classificação e autorização das rotas com dúvidas.
2. Revisar cada guia em interface com dados sintéticos e decompor operações complexas.
3. Resolver OR de permissões e divergências menu/rota/servidor/RLS antes de publicar.
4. Converter JSON para Markdown e seed no formato oficial; incrementar versões apenas quando substituir artigo já existente.
5. Incluir Core/platform no gate de cobertura e executar testes permitido, sem chave, deny, outro workspace e inativo.
6. Capturar mídia sanitizada, cadastrar pendências e só então publicar os artigos aprovados.

## Validação final dos artefatos
JSON parseado com sucesso; 133 artigos novos com pares módulo/slug únicos; todas as chaves mínimas não nulas existem no catálogo; todos os howtos possuem as quatro seções iniciais e as cinco seções de guia obrigatórias. Todos os novos artigos permanecem despublicados.
