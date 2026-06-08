## Objetivo

Separar **operação** de **administração**: a sidebar de trabalho fica enxuta e colapsável, e Configurações passa a viver atrás da engrenagem no header (estilo HubSpot), com dropdown de atalhos rápidos.

## 1. Nova sidebar de trabalho (`src/components/app-sidebar.tsx`)

- Remover completamente o grupo **Configurar** da sidebar.
- Manter os 3 grupos colapsáveis: **Trabalhar**, **Analisar**, **Engajar** (mesma taxonomia atual).
- Limpar itens que só fazem sentido em configurações (ex.: "Listas" que aponta para `/settings/segments`, "Tipos de assinatura", "Macros", "Templates de email", "Base de conhecimento", "Widget de chat", "Formulários", "Scripts de voz", "Agente de voz", "Sequências", "Portal do cliente", "Metas", "Exports agendados") → movidos para o dropdown da engrenagem.
- Rodapé: manter dropdown de conta (avatar) + bloco super-admin condicional. Remover atalhos de Perfil/Email/Segurança do dropdown da conta (vão para Configurações).
- Modo colapsável: `collapsible="icon"` (igual hoje) — sidebar mais estreita com tooltips.

Estrutura final da sidebar:

```text
[Logo] [WorkspaceSwitcher]
─ Trabalhar
  Painel, Leads, Contatos, Empresas, Negócios, Tickets,
  Tarefas, Reuniões, Propostas, Faturas,
  Inbox unificada, Inbox Email, Inbox WhatsApp, Chat ao vivo,
  Comunicações, Notas
─ Analisar
  Dashboards, Relatórios, Analytics
─ Engajar
  Campanhas WhatsApp, Campanhas Email, Landing Pages,
  Prospecting, Prospecção por voz, Agente SDR, Pesquisas
─ [rodapé] Super-admin (se aplicável) · Avatar
```

## 2. Header global (`src/routes/_authenticated.tsx`)

Substituir o header atual (`SidebarTrigger` + sino) por uma barra completa estilo HubSpot:

```text
[☰] [🔍 Buscar ou perguntar  ⌘K]  ····  [+] [⚙] [🔔] [Avatar▾]
```

Componentes:

- **SidebarTrigger** (mantém colapso da sidebar).
- **GlobalSearch**: input que abre o `CopilotCmdK` já existente (atalho ⌘K). Reaproveita o trigger pelo evento de teclado; o input no header só chama `cmdk.open()`.
- **QuickCreateMenu** (novo `src/components/quick-create-menu.tsx`): botão `+` com dropdown → Novo lead / contato / empresa / negócio / tarefa / reunião / nota. Reaproveita os diálogos existentes (`create-lead-dialog`, `create-contact-dialog`, `create-deal-dialog`, etc.).
- **SettingsMenu** (novo `src/components/settings-menu.tsx`): botão engrenagem com dropdown agrupado de atalhos + "Todas as configurações" → `/settings`. Conteúdo do dropdown:

  ```text
  Minha conta
    Perfil · Conexão de email · Segurança (2FA) · Meus chamados
  Workspace
    White-label · Idioma · Calendários · Cobrança
  Estrutura CRM
    Pipelines · Propriedades · Produtos · Objetos custom
  Pessoas & Acesso
    Usuários · Equipes · Permissões
  Automação & Engajamento
    Workflows · Sequências · Templates de email · Macros · Base de conhecimento
  Integrações
    Marketplace · Integrações · WhatsApp · Sync HubSpot
  ─────────
  Todas as configurações  →
  ```

  Itens respeitam `useMyRole` / `useMyTools` (admin/manager).

- **NotificationsBell** (mantém o existente).
- **AccountMenu** (novo `src/components/account-menu.tsx`): avatar com dropdown → email do usuário, link "Planos e cobrança", Sair. (Move o conteúdo de conta que estava no rodapé da sidebar.)

## 3. Página de configurações (`src/routes/_authenticated/settings.tsx`)

- Já existe com sidebar interna de seções — manter. Vira a "home" do menu de configurações quando o usuário clica em "Todas as configurações" ou em qualquer atalho.
- Adicionar breadcrumb no topo: `Configurações / <seção>`.

## 4. Cuidados técnicos

- `CopilotCmdK` continua montado no layout autenticado; o input do header só dispara o atalho (mantém uma fonte de verdade).
- Manter `ChatTrigger` e `BugReportButton` flutuantes como hoje.
- Manter validação de permissão (`ADMIN_ONLY` / `MANAGER_PLUS`) — apenas mover URLs de settings da sidebar para o dropdown da engrenagem. O guard em `_authenticated.tsx` continua bloqueando o acesso direto.
- Acessibilidade: cada botão do header com `aria-label`; dropdown com `DropdownMenuLabel` para os grupos; engrenagem ganha `title="Configurações"`.
- Responsivo: em telas <768px o header esconde o input de busca (vira só ícone 🔍) e o `+` continua visível.

## Arquivos tocados

- editar `src/components/app-sidebar.tsx` (remover grupo Configurar e itens que viram settings)
- editar `src/routes/_authenticated.tsx` (novo header)
- criar `src/components/quick-create-menu.tsx`
- criar `src/components/settings-menu.tsx`
- criar `src/components/account-menu.tsx`
- criar `src/components/global-search-trigger.tsx` (input do header que abre o CopilotCmdK)
- editar `src/routes/_authenticated/settings.tsx` (breadcrumb opcional)

## Fora do escopo

- Não muda paleta, tipografia, tokens de cor ou rotas existentes.
- Não mexe em RLS, server functions ou dados.
- Os diálogos de criação já existem — só são acoplados ao novo `+`.