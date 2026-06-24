
# Plano: ATS como Módulo Independente do ERP

## 1. Visão geral

Hoje o ATS vive como sub-rotas dentro do CRM TechSales (`/ats/*` debaixo do mesmo shell, mesmo menu, mesma marca). Vamos transformá-lo num **módulo de primeira classe** do ERP, com:

- Domínio próprio: `ats.wktechnology.com.br` (irmão de `crm.wktechnology.com.br`).
- Shell / app próprio: cabeçalho, menu lateral, breadcrumbs e ícones específicos do ATS.
- Identidade visual herdada do white-label do workspace, mas com nome/cor/logo configuráveis por módulo.
- Configurações de plataforma (white-label, idioma, residência de dados, planos, billing, segurança, auditoria, equipe) **promovidas para o nível ERP**, compartilhadas entre CRM, ATS e futuros módulos (Projetos, Financeiro).

O CRM continua intacto em `crm.wktechnology.com.br` — nenhuma rota do CRM muda de lugar nesta fase.

## 2. Arquitetura de domínios e shell

```text
wktechnology.com.br                → site/marketing (futuro)
crm.wktechnology.com.br            → módulo CRM (TechSales)  [hoje]
ats.wktechnology.com.br            → módulo ATS              [novo]
app.wktechnology.com.br            → hub / launcher de módulos (opcional, fase 2)
```

Estratégia técnica:

- **Mesma aplicação TanStack Start** servida em todos os hosts (uma build, um deploy).
- Um **detector de módulo** roda em `__root.tsx` (e middleware de SSR) lendo `window.location.hostname` / `request.headers.host` e definindo `activeModule = 'crm' | 'ats' | 'hub'`.
- O shell renderizado (`AppShell`, menu, branding, rota inicial) é escolhido por `activeModule`.
- Rotas exclusivas de um módulo ficam acessíveis apenas no host correspondente; tentar abrir `/ats/jobs` em `crm.wktechnology.com.br` redireciona para `https://ats.wktechnology.com.br/jobs` (e vice-versa). Rotas compartilhadas (`/settings/*`, `/login`, `/accept-invite/*`) funcionam em qualquer host.
- Login único: sessão Supabase compartilhada via cookie de domínio `.wktechnology.com.br` (já é o padrão do Supabase quando os subdomínios pertencem ao mesmo apex). Usuário loga uma vez e navega entre módulos sem novo login.

DNS / Lovable:

- Adicionar `ats.wktechnology.com.br` em **Project Settings → Domains** (mesmo projeto).
- Configurar como secundário; manter `crm.wktechnology.com.br` como Primary do CRM (ou promover um hub depois).

## 3. Reestruturação de rotas

Hoje:
```text
src/routes/_authenticated/ats.tsx              (layout)
src/routes/_authenticated/ats.index.tsx
src/routes/_authenticated/ats.jobs.tsx
src/routes/_authenticated/ats.jobs.$id.tsx
src/routes/_authenticated/ats.candidates.tsx
```

Depois (sem prefixo `ats.` — o módulo é definido pelo host):
```text
src/routes/_authenticated/(ats)/jobs.tsx
src/routes/_authenticated/(ats)/jobs.$id.tsx
src/routes/_authenticated/(ats)/candidates.tsx
src/routes/_authenticated/(ats)/pipelines.tsx
src/routes/_authenticated/(ats)/dashboard.tsx          (home do ATS)
src/routes/_authenticated/(ats)/reports.tsx
src/routes/_authenticated/(ats)/career-page.tsx        (config da página pública)
```

- O grupo `(ats)` é organizacional (não aparece na URL). URLs no host ATS: `/jobs`, `/candidates`, `/dashboard`.
- Um **guard de módulo** em cada rota (via `beforeLoad`) checa `activeModule === 'ats'`; se não, redireciona para o host correto.
- Para evitar quebrar links/bookmarks existentes do `/ats/*`, ficam **redirects** das rotas antigas para o novo host (`/ats/jobs` → `https://ats.wktechnology.com.br/jobs`).

Página pública de vagas continua em `/jobs/:slug` (sem auth), também respondida pelo host `ats.wktechnology.com.br`.

## 4. Shell, menu e branding do ATS

Criar:

- `src/components/shell/ats-shell.tsx` — espelha o `AppShell` do CRM mas com:
  - Logo "TechHire" (ou nome a definir) + cor primária do ATS.
  - Menu lateral: Dashboard, Vagas, Candidatos, Pipelines, Entrevistas, Relatórios, Configurações.
  - Breadcrumbs e título com prefixo do módulo.
- `src/lib/modules/active-module.ts` — detecta módulo por host (cliente + servidor) e expõe `useActiveModule()`.
- `src/lib/modules/registry.ts` — registro central: `{ id, name, host, color, logo, defaultRoute, menu }` para CRM e ATS.
- "Module switcher" no canto superior do shell (popover com CRM, ATS, +futuros), navegando entre subdomínios.

White-label por módulo:

- Estender `workspace_branding` (ou criar `module_branding`) com `module_id` para guardar logo, cor primária, nome do produto e favicon por módulo. Default herda do workspace.

## 5. Configurações compartilhadas (ERP-level)

Promover do "CRM" para "ERP/Workspace":

| Área                          | Rota atual                              | Comportamento novo                                                                 |
| ----------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| White-label / branding        | `/settings/branding`                    | Tabs: "Geral (workspace)" + uma tab por módulo ativo                               |
| Idioma                        | `/settings/language`                    | Padrão do workspace + override por usuário                                         |
| Residência de dados           | `/settings/data-residency`              | Aplica a todos os módulos                                                          |
| Planos & cobrança             | `/settings/billing`, `/settings/plans`  | Plano por módulo (CRM Bronze + ATS Prata, etc.), fatura unificada por workspace    |
| Segurança / SSO / SCIM        | `/settings/security`, `/settings/sso`   | Compartilhado                                                                      |
| Equipe / papéis / permissões  | `/settings/workspace-team`, `/settings/roles` | Compartilhado, com permissões granulares por módulo                          |
| Auditoria                     | `/settings/audit-log`                   | Filtro por módulo                                                                  |
| API keys / Webhooks           | `/settings/api-keys`, `/settings/webhooks` | Compartilhado; escopo opcional por módulo                                       |
| Integrações                   | `/integrations`                         | Compartilhado; cada integração declara módulos suportados                          |

Configurações **específicas de módulo** ficam dentro do módulo:

- CRM: pipelines de negócios, lead sources, sequences, dunning, e-mail/WhatsApp templates de vendas, scoring etc. permanecem em `/settings/*` mas só aparecem no menu quando `activeModule === 'crm'`.
- ATS: pipelines de candidatos, templates de e-mail de recrutamento, scorecards, página de carreiras, conectores LinkedIn — ficam em `/settings/ats/*` e só aparecem no shell do ATS.

Reformulação do índice de Configurações (`/settings`): agrupado por "Workspace (ERP)" vs "Módulo CRM" vs "Módulo ATS".

## 6. Modelo de dados

Novas tabelas / mudanças:

- `modules` (catálogo: `id`, `name`, `host_suffix`, `default_color`). Seed: `crm`, `ats`.
- `workspace_modules` (`workspace_id`, `module_id`, `enabled`, `plan_id`, `activated_at`). Substitui flags ad-hoc.
- `module_branding` (`workspace_id`, `module_id`, `logo_url`, `primary_color`, `product_name`, `favicon_url`).
- `plan_entitlements`: passa a ter `module_id` (entitlements escopadas por módulo).
- `user_roles` / `access_profile_permissions`: incluir `module_id` para permissões cross-módulo (um usuário pode ser admin do ATS e leitor do CRM).
- `audit_logs`: adicionar coluna `module_id` (nullable; backfill `crm` para registros existentes).

RLS continua por `workspace_id`/`owner_id`; o módulo é apenas um eixo organizacional + permissões.

## 7. Sessão, auth e cross-domain

- Cookies Supabase configurados em `.wktechnology.com.br` (domínio pai), permitindo SSO entre subdomínios.
- `auth-middleware` adiciona `activeModule` ao `context`, derivado do host.
- `login` continua único; após login, redirect para o `defaultRoute` do módulo de onde o usuário veio (ou hub se entrou direto pelo apex).
- Convites (`accept-invite/:token`) podem opcionalmente vincular o usuário a módulos específicos.

## 8. Entrega em fases

**Fase A — Fundação multi-módulo** (sem mudar UX visível)
- Tabelas `modules`, `workspace_modules`, `module_branding`; seeds para CRM e ATS.
- `active-module` detector + registry; `AppShell` consulta registry mas continua renderizando CRM por padrão.
- Adicionar `module_id` em `plan_entitlements`, `audit_logs`, `access_profile_permissions` (com defaults `crm`).

**Fase B — Shell e domínio do ATS** ✅
- ✅ Menu lateral dedicado do ATS (`src/lib/menu-config-ats.ts`).
- ✅ `AppSidebar` troca grupos automaticamente quando `activeModule === 'ats'`.
- ✅ Module switcher no header + branding (cor, nome, ícone) via registry.
- ✅ `ats.wktechnology.com.br` ativo (custom domain).
- ✅ Rotas movidas para grupo `(ats)/` sem prefixo: `/jobs`, `/jobs/$id`, `/candidates`. Redirects mantidos em `/ats/jobs`, `/ats/jobs/:id`, `/ats/candidates`, `/ats`.
- ✅ `detectModuleFromPath` reconhece os novos paths (`/jobs`, `/candidates`) para preview local.
- ⏳ **Pendente**: `cookieOptions.domain = '.wktechnology.com.br'` para SSO cross-subdomain (depende de ajuste no Supabase project, fora do client.ts auto-gen).

**Fase C — Configurações compartilhadas**
- Reorganizar `/settings` em grupos Workspace / CRM / ATS.
- Branding por módulo (tabs).
- Billing/planos por módulo, fatura unificada.
- Permissões por módulo no editor de papéis.

**Fase D — Polimento**
- Hub opcional em `app.wktechnology.com.br` (launcher + notificações cross-módulo).
- Onboarding "qual módulo ativar".
- Documentação interna (runbook) sobre como adicionar um novo módulo (Projetos, Financeiro) reutilizando o mesmo padrão.

## 9. Riscos e cuidados

- **Quebra de links**: manter redirects `/ats/* → ats.host/*` por pelo menos uma release.
- **SEO da página pública de vagas**: definir canonical no host do ATS; sitemap separado.
- **Sessão cross-subdomain**: validar localmente antes — Supabase cookies precisam de `cookieOptions.domain = '.wktechnology.com.br'`.
- **Custos de domínio/SSL**: SSL automático do Lovable cobre o subdomínio; sem custo extra.
- **Permissões legadas**: migration de `module_id` precisa preencher `crm` para tudo que já existe, senão usuários perdem acesso.

## 10. O que NÃO está neste plano (fica para depois)

- Implementação dos novos recursos do ATS (parsing de CV, LinkedIn Easy Apply, scorecards) — continua no roadmap já aprovado, executado **após** esta reestruturação.
- Módulos Projetos e Financeiro — a fundação criada aqui os habilita, mas eles são planos próprios.
- Hub `app.wktechnology.com.br` — opcional, fase D.

---

**Próximo passo se aprovado:** começar pela **Fase A** (migrations de `modules`, `workspace_modules`, `module_branding`, colunas `module_id`) + detector de módulo. Confirmar antes:

1. Nome comercial do módulo ATS (sugestão: **TechHire**)?
2. Cor primária do ATS diferente do CRM, ou herdar do branding do workspace por padrão?
3. Quer já criar o subdomínio `ats.wktechnology.com.br` agora (Fase A) ou só na Fase B?
