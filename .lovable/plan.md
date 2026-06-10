# Roadmap de Releases — Pronto para Comercializar

Organizei o trabalho em **6 releases sequenciais**. Cada release é fechado, testável e entregável independentemente. Vou executar **um por vez**, aguardando seu OK antes de iniciar o próximo.

---

## Release 1 — Estabilidade Crítica (bloqueadores)
**Objetivo:** zerar erros runtime visíveis ao usuário.

- Corrigir hydration mismatch no `__root__` (`<Suspense>` vs `<main>` no SSR).
- Adicionar `errorComponent` e `notFoundComponent` em todas as rotas com loader que ainda não têm.
- Garantir `defaultErrorComponent` no router e wrapper SSR (`src/server.ts`) cobrindo erros catastróficos (já parcialmente feito — revisar).
- Smoke test E2E navegando pelas rotas principais autenticadas e públicas.

**Critério de aceite:** sem erros no console em `/dashboard`, `/login`, `/quote/:token`, `/deals`, `/settings`. Suite Playwright `navigation-smoke` verde.

---

## Release 2 — Segurança & Compliance
**Objetivo:** passar em scan de segurança e atender LGPD básico.

- Rodar `security--run_security_scan` e fechar todos os findings críticos/altos.
- Auditar GRANTs e RLS em todas as tabelas `public` (lista de 160+ tabelas).
- Validar assinatura HMAC em todos `/api/public/hooks/*` (Twilio, pagamentos BR, Meta WhatsApp, Zapier).
- Habilitar HIBP no Auth + exigir verificação de e-mail.
- Implementar endpoints LGPD: exportação de dados do titular + exclusão de conta (server functions + UI em Settings).
- Atualizar `security-memory` com posturas aceitas.

**Critério de aceite:** scan sem críticos; checklist LGPD documentado em `/privacy` com link para "Exportar meus dados" e "Excluir minha conta".

---

## Release 3 — Cobertura de Testes
**Objetivo:** rede de segurança para regressões.

- E2E Playwright para: cotações (criar, enviar, aceitar), faturamento, fluxo de convite + aceite, isolamento de workspace em todas as entidades.
- Testes unitários para `permissions.server.ts`, `menu-config.ts`, helpers de billing.
- CI roda E2E + unit em cada PR (configurar workflow).

**Critério de aceite:** ≥70% das jornadas críticas cobertas; CI verde.

---

## Release 4 — Pagamentos & Billing
**Objetivo:** clientes conseguem assinar e pagar.

- Stripe go-live: documentar wizard (claim → onboard → install → readiness).
- Definir planos finais (Free/Pro/Business) com `plan_entitlements` consistentes.
- Enforcement de quotas (`usage_counters` + `credit_limits`) em pontos de uso.
- Página `/settings/billing` mostrando plano atual, uso, upgrade/downgrade.
- Webhook de cobrança BR (Asaas/Pagar.me/MP) testado end-to-end em sandbox.
- Geração de NFS-e nos pagamentos confirmados (já existe tabela `nfse_invoices` — fechar fluxo).

**Critério de aceite:** assinatura completa do zero ao pagamento em sandbox + emissão de NF.

---

## Release 5 — Operação & Observabilidade
**Objetivo:** rodar em produção com segurança.

- Alertas: erros 5xx, falhas de cron, queue DLQ, edge function errors → notificação para admin.
- Painel `/admin/status` mostrando saúde de cron, queues, integrações.
- Backups documentados + plano de recuperação (RPO/RTO).
- E-mail transacional com domínio próprio (SPF/DKIM/DMARC) usando Lovable Email.
- Custom domain `crm.wktechnology.com.br` validado com SSL.
- Documentação de usuário final (Help Center via `kb_articles`).

**Critério de aceite:** alertas chegando, domínio próprio enviando e-mails, KB com ≥10 artigos essenciais.

---

## Release 6 — Comercial & Go-to-Market
**Objetivo:** material legal e comercial para vender.

- Contrato de assinatura (Termos de Uso comerciais separados dos atuais).
- Política de reembolso e cancelamento.
- DPA (Data Processing Agreement) para clientes B2B.
- Landing page de vendas (preços, features, CTA).
- Onboarding guiado no primeiro login (checklist de setup).

**Critério de aceite:** novo usuário consegue assinar, configurar workspace e usar o produto sem suporte humano.

---

## Detalhes Técnicos

- Cada release vira um conjunto de commits agrupados; ao fim, publicação para `wktechnology.lovable.app` e validação no `crm.wktechnology.com.br`.
- Migrações de DB sempre com GRANT + RLS na mesma migration.
- Server functions protegidas via `requireSupabaseAuth`; webhooks em `/api/public/*` com verificação de assinatura.
- Sem mudanças em `src/integrations/supabase/*` auto-gerados.

---

**Próximo passo:** confirme que aprova o roadmap (ou peça ajustes). Quando aprovar, começo pelo **Release 1 — Estabilidade Crítica**.
