# Revisão do menu do TechHire (ATS)

## Problema

`src/lib/menu-config-ats.ts` aponta vários itens para rotas do CRM/Sales (TechSales). Exemplos confirmados navegando o código:

- **Entrevistas** → `/meetings` (página de reuniões do CRM)
- **Página de Carreiras** → `/settings/portal` (portal do cliente — Vender)
- **Inbox** → `/inbox` (inbox unificada do CRM com Email/WhatsApp/Chat)
- **Templates de E-mail** → `/settings/email-templates` (CRM)
- **Notificações** → `/settings/notifications` (CRM)
- **Relatórios / Dashboards** → `/reports`, `/dashboards` (CRM)
- **Workflows** → `/settings/workflows` (CRM)

Além disso o menu **omite páginas ATS reais** que existem em `src/routes/_authenticated/(ats)/`: `scorecards`, `stage-emails`, `insights`.

## Rotas ATS-only realmente existentes

Confirmado por `rg createFileRoute`:

| URL | Arquivo |
|---|---|
| `/jobs`, `/jobs/$id` | `(ats)/jobs(.$id).tsx` |
| `/candidates` | `(ats)/candidates.tsx` |
| `/pipelines` | `(ats)/pipelines.tsx` |
| `/scorecards` | `(ats)/scorecards.tsx` |
| `/stage-emails` | `(ats)/stage-emails.tsx` |
| `/insights` | `(ats)/insights.tsx` |

Não existe rota administrativa nativa para **Entrevistas ATS** nem para **Página de Carreiras** (só existe a pública `/careers/$slug` e `/careers`).

## Mudanças

### 1. `src/lib/menu-config-ats.ts` — reescrever grupos

```ts
[
  {
    label: "Recrutamento",
    items: [
      { title: "Vagas",       url: "/jobs",        icon: Briefcase },
      { title: "Candidatos",  url: "/candidates",  icon: Users },
      { title: "Pipelines",   url: "/pipelines",   icon: GitBranch },
      { title: "Scorecards",  url: "/scorecards",  icon: ClipboardCheck },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { title: "E-mails por etapa", url: "/stage-emails", icon: Mail },
      // Inbox/Templates/Notificações removidos — pertencem ao TechSales
    ],
  },
  {
    label: "Carreiras",
    items: [
      { title: "Página de Carreiras (pública)", url: "/careers", icon: Globe },
      // Link externo para preview da careers page pública do workspace
    ],
  },
  {
    label: "Análise",
    items: [
      { title: "Insights ATS", url: "/insights", icon: BarChart3 },
    ],
  },
  {
    label: "Workspace (ERP)",
    items: [
      { title: "Equipe",              url: "/settings/workspace-team", icon: UsersRound, need: "admin" },
      { title: "Papéis & Permissões", url: "/settings/roles",          icon: ShieldCheck, need: "admin" },
      { title: "Planos & Cobrança",   url: "/settings/billing",        icon: CreditCard, need: "admin" },
      { title: "Idioma",              url: "/settings/language",       icon: Languages },
      { title: "API Keys",            url: "/settings/api-keys",       icon: KeyRound, need: "admin" },
    ],
  },
]
```

### 2. Itens removidos (e por quê)

- **Entrevistas** — não há rota admin de entrevistas; o agendamento já vive dentro do candidato (`scorecard-eval-dialog`). Reintroduzir só quando existir uma página `/interviews` dedicada ao ATS.
- **Inbox** — `/inbox` é do CRM (Email/WhatsApp/Chat). ATS não tem inbox próprio.
- **Templates de E-mail / Notificações** — pertencem ao CRM. ATS usa `/stage-emails`.
- **Relatórios / Dashboards / Workflows / Integrações** — sem equivalente ATS-only hoje; ficam acessíveis via troca de módulo para o TechSales.

### 3. Validação

- `rg "url:" src/lib/menu-config-ats.ts` — todas as URLs devem existir em `src/routes/_authenticated/(ats)/` ou em `settings.*` permitidos.
- Smoke manual: abrir TechHire e clicar em cada item; nenhum deve cair em rota do CRM.

## Fora de escopo

- Criar páginas novas de "Entrevistas ATS" ou "Página de Carreiras (admin)". Se quiser, faço em sequência depois desta limpeza.
