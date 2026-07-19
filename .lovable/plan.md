# Consolidação em domínio único

Hoje a aplicação roda em três hosts (`app.`, `ats.`, `crm.` wktechnology.com.br) com um `HostRouterGuard` que faz redirects cross-host. Isso cria complexidade real (SSL/DNS por subdomínio, loops de redirect, cookies de sessão não compartilhados, SEO fragmentado, deep-link cross-módulo quebrado) sem ganho técnico — é um monólito TanStack Start servindo os três.

## Recomendação: um domínio, módulos como prefixo de rota

Padrão usado por Linear, Stripe Dashboard, Attio, Shopify Admin, Atlassian: **um host, módulo como primeiro segmento do path**.

```text
app.wktechnology.com.br/            → ERP Home (seletor de módulos)
app.wktechnology.com.br/ats/...     → TechHire
app.wktechnology.com.br/crm/...     → TechSales
app.wktechnology.com.br/finance/... → TechFinance
app.wktechnology.com.br/settings    → Workspace/config (compartilhado)
```

Ganhos:
- Sessão Supabase única (sem cross-domain cookies / relogin).
- Sem redirects entre hosts → fim dos loops e do `HostRouterGuard`.
- Deep-link de qualquer módulo funciona de qualquer contexto.
- Um certificado, um DNS, um cache de assets.
- Analytics e observabilidade unificados.

Trade-off: URLs mais longas. Aceitável — é o padrão SaaS B2B.

## Escopo da mudança

### 1. Roteamento
- Mover rotas ATS para prefixo `/ats/*` (hoje muitas vivem sem prefixo porque o host já discrimina): `/jobs`, `/candidates`, `/interviews`, etc. → `/ats/jobs`, `/ats/candidates`…
- Manter `/crm/*`, `/finance/*`, `/contracts/*` já prefixados.
- Rotas neutras (`/settings`, `/account`, `/workspace`, `/home`, `/auth`) permanecem sem prefixo.
- Adicionar redirects 301 dos paths antigos sem prefixo para os novos (preserva bookmarks).

### 2. Detecção de módulo ativo
- Reescrever `src/lib/modules/active-module.ts` para priorizar path (não host).
- `detectModuleFromPath` vira única fonte de verdade; `detectModuleFromHost` é removido.
- `localStorage.activeModule` continua como fallback para telas neutras.

### 3. Remoção de infra multi-host
- Deletar `HostRouterGuard` e sua montagem no root.
- Simplificar `src/lib/hosts.ts`: remover `MODULE_HOSTS`, `buildModuleUrl`, `isReachableHost`, `HostRouterGuard`. Manter apenas `getAppUrl()`.
- Atualizar `src/routes/index.tsx` para sempre redirecionar para `/home`.

### 4. Domínios
- `app.wktechnology.com.br` (ou apenas `wktechnology.com.br`) vira o host canônico único.
- `ats.` e `crm.` viram redirect 301 permanente para `app.` preservando path (via config de domínio na Lovable).
- Atualizar `APP_URL`, metadados SSR (`__root.tsx` `og:*`, JSON-LD), sitemap e templates de e-mail para o host único.

### 5. Migração de dados/links
- Buscar no repo por hardcodes de `ats.wktechnology` e `crm.wktechnology` (e-mails transacionais, webhooks públicos, docs, extensão Chrome, PDFs de cotação) e trocar para o host único.
- Endpoints públicos (`/api/public/*`) não mudam — já são path-based.

### 6. Rollout
1. Migração de rotas + redirects (behind flag ou direto, tudo em um deploy).
2. Reconfigurar DNS: `app.` como primário; `ats.` e `crm.` apontando para o mesmo app com header/regra de redirect 301 para `app.` + path.
3. Monitorar 404s e cliques nos redirects por 30 dias, então descomissionar `ats.`/`crm.` no médio prazo (ou manter permanentemente como redirect).

## Alternativas consideradas (e por que não)

- **Manter multi-host + arrumar o guard**: paga o custo de complexidade toda semana (loops, SSL, sessão) sem benefício correspondente.
- **Path-based apenas para módulos novos**: mantém dois modelos coexistindo indefinidamente. Pior dos mundos.
- **Subdomínio por workspace/tenant** (`{tenant}.wktechnology.com.br`): faz sentido para multi-tenant white-label, mas é ortogonal a "um domínio por módulo" — pode ser adotado depois se virar requisito real.

## Detalhes técnicos

- Rotas TanStack: renomear arquivos em `src/routes/_authenticated/` (`jobs.*.tsx` → `ats.jobs.*.tsx` etc.) e ajustar cada `createFileRoute("/…")` para o novo path. `src/routeTree.gen.ts` regenera automaticamente.
- `ATS_ROUTE_PREFIXES` em `src/lib/menu-config-ats.ts` passa a listar paths com `/ats/` prefixado.
- `<Link to>` type-safe: o typecheck do TanStack Router vai apontar toda referência que precisa mudar; usar isso como checklist.
- Redirects legados: um arquivo `src/routes/_authenticated/{jobs,candidates,interviews,...}.$.tsx` com `beforeLoad` fazendo `throw redirect({ to: "/ats/…" })` cobre o histórico.
- `src/routes/api/public/*` fica intocado; webhooks externos continuam válidos.
- Extensão Chrome (`extension/manifest.json` host_permissions) atualizada para o host único.
