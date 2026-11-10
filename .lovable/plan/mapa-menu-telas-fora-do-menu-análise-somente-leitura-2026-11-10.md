# MAPA-MENU — Telas fora do menu (análise, somente leitura)

## Resultado
- 250 telas autenticadas fixas (sem contar fichas de registro, ex.: /contracts/$id).
- 83 não aparecem nos menus laterais dos módulos.
- Dessas, 78 são abertas por outro ponto (página de Configurações, Admin, links internos).
- 5 não têm nenhum link no sistema (órfãs): /ats/candidates, /ats/jobs (rotas antigas do TechHire), /prospecting/prototype, /sales/prototype (protótipos aprovados), /settings/roles/matrix.

## Fora do menu, mas acessíveis por outro caminho (principais grupos)
- Configurações (só pela página /settings): ads-sync, ai-panel, api-keys, audit-log/export, clauses, data-residency, enrichment, esign, exports, forms, goals, hubspot-sync/users, import-csv, lead-sources, media, meeting-reminders, mobile, my-permissions, nfse, notifications(+slack), payments, playbooks, property-groups, proposal/quote-templates, prospecting(+scripts), record-layouts, recurring, roles, scim, scoring, segments, sso, subscriptions, surveys, video, voice-agent, webhooks, workflow-subscriptions, workspace-team, zapier, access-policy, integrations/ai, integrations/contaazul, marketplace.
- Admin: alerts, quotas, sandbox, security-scans, status.
- Outras: /integrations, /integrations/contaazul, /marketplace, /modules, /workspace/modules, /my-bug-reports, /leads/import-hubspot, /contracts/links, /catalog/job-profiles, /projects/settings(+imports), /qa/test-cases, /sourcing, /hunting/install, /home/access, /home/print, /auth/extension-link, /agents/prototype/1-3.

## Proposta (se aprovar) — Porte P, ~1 h
1. Remover rotas antigas /ats/candidates e /ats/jobs (ou redirecionar para /candidates e /jobs).
2. Remover protótipos já aprovados (/sales/prototype, /prospecting/prototype; agentes só se você quiser).
3. Ligar /settings/roles/matrix a partir de /settings/roles.
4. Decidir se itens frequentes (ex.: Meus chamados, Integrações, Marketplace) entram no menu lateral.
5. Gerar planilha completa tela × menu × acesso em /mnt/documents.

Observação: lista obtida por varredura automática dos arquivos; itens montados dinamicamente podem precisar de conferência manual.
