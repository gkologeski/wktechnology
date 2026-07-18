
# Roadmap ERP: Core global + módulos verticais

Decisões travadas pelo usuário:
1. Navegação cruzada: manter módulo ativo do usuário com aviso "esta tela é de outro módulo".
2. Serviços de catálogo: nova tabela `service_catalog` (separada de `services` operacional).
3. Bancos: começar por **Inter**, depois Sicoob, depois C6.
4. My Tasks (Projects) e Minhas atividades (Sales): separados por domínio.
5. Configurações específicas de módulo: **apenas atribuir `scope`**, sem mover URLs.

---

## Camada Core ERP

Entidades globais consumidas por todos os módulos:
- Empresas, Contatos, Produtos, Serviços (catálogo), Usuários/Times, Permissões, Pipelines.

## Módulos verticais
TechSales, TechHire, TechContracts, TechServices, TechProjects, TechFinance (e futuros TechSupport/Assets/Docs).

---

## Fase 0 — Documentação
- `docs/erp-core-architecture.md` (camadas, catálogo, política de menus, escopo de settings).
- ADR curta sobre navegação entre módulos.

## Fase 1 — Navegação entre módulos (bug do "some o menu")
- `active-module.ts`: priorizar `localStorage.activeModule`; `detectModuleFromPath` vira fallback.
- `AppSidebar`: nunca renderizar em branco. Se a rota atual não pertence ao módulo ativo, manter o sidebar do módulo ativo e exibir banner discreto "Você está numa tela de <outro módulo>. Voltar para <módulo ativo>".
- `ModuleSwitcher` continua trocando de módulo explicitamente.

## Fase 2 — Catálogo global (Produtos + Serviços)
- Nova tabela `public.service_catalog` (separada da `services` operacional): categoria, unidade (h/PF/mês), tipo (one-off/recorrente/bolsa de horas/SLA), preço base, custo, imposto, SLA default, competências, moeda, ativo. RLS por workspace; grants padrão; escrita gated por permissão `catalog.write`.
- View `public.catalog_items` = UNION `products` + `service_catalog` para pickers.
- Novas rotas: `/catalog/products` (redireciona de `/settings/products`) e `/catalog/services`.
- Grupo "Catálogo" injetado no sidebar dos módulos consumidores (Sales, Contracts, Services, Projects, Finance).

## Fase 3 — Cadastros globais no sidebar
- `src/lib/menu-config-core.ts` com grupo "Cadastros": Empresas, Contatos, Produtos, Serviços.
- `AppSidebar` prepende `CORE_SIDEBAR_GROUPS` ao menu de cada módulo consumidor.

## Fase 4 — TechProjects (ClickUp + Clockify)
### 4.1 Desacoplar
- `/projects/tasks` para `project_tasks`; remover link `/tasks` do menu Projects.

### 4.2 ClickUp
- Hierarquia Space → Folder → List → Task → Subtask (novas tabelas ou extensão de `projects`).
- Views por lista: List, Board, Calendar, Gantt, Timeline, Workload.
- Custom statuses e custom fields por lista; dependências; múltiplos assignees; prioridades; tags; checklists.
- Comentários + menções (reaproveitar `activity_comments` polimórfica).
- Templates; automações via workflow engine existente; docs internos.

### 4.3 Clockify
- Timer global start/stop (widget flutuante), timesheet semanal.
- Billable vs non-billable, taxa por usuário/serviço, aprovação, relatórios.
- Geração de `financial_entries` a partir de horas billable.

### 4.4 My Work
- `/projects/my-work`: tarefas do dia, timer ativo, semana, notificações. **Separado de** "Minhas atividades" do TechSales.

## Fase 5 — TechFinance (ContaAzul + bancos BR)
### 5.1 Paridade ContaAzul
- DRE gerencial, fluxo de caixa 30/60/90, cenários.
- Centro de custo/resultado, plano de contas hierárquico.
- Boletos e cobrança recorrente, NFSe.
- Conciliação por regras, importação OFX/CSV.

### 5.2 Open Finance — Inter primeiro
- Tabela `bank_integrations` + adapter `inter.server.ts`.
- Saldo, extrato incremental, Pix (envio/recebimento/cobrança), boletos, conciliação automática, auditoria em `audit_logs`.
- mTLS/OAuth via secrets.
- Depois: `sicoob.server.ts`, `c6.server.ts` seguindo o mesmo contrato.

### 5.3 Pagamento em lote
- Tela "Pagar contas" → seleção → lote Pix → dupla aprovação acima do threshold → envio → conciliação.

## Fase 6 — Módulos adicionais sugeridos
TechSupport, TechAssets, TechDocs/Wiki, Portal do cliente unificado, e-sign nativo, BI cross-módulo, marketplace de automações, multi-idioma/moeda, PWA mobile.

---

## Fase 7 — Configurações: globais vs específicas (via `scope`)

Auditoria das 77 telas em `src/routes/_authenticated/settings.*.tsx`. Aplicando a regra "impacta mais de um módulo? → global". **Não movemos URLs** — apenas adicionamos `scope` em cada item de `sections` no `settings.tsx` e usamos esse metadado para o sidebar de cada módulo mostrar suas configs específicas + link "Ver todas as configurações do ERP".

### 7.1 Globais (Core ERP)
Todas essas continuam em `/settings/*` e são acessíveis de qualquer módulo:

**Minha conta** — Perfil, Conexão de email, Notificações, Segurança (2FA), Minhas permissões.

**Workspace** — Branding/white-label, Idioma, Mobile/PWA, Planos e cobrança, Residência de dados, Exportações, Privacidade.

**Estrutura de dados** — Custom properties, Grupos de propriedades, Custom objects, Record layouts, **Pipelines** (Deals, Tickets, ATS, Contracts, Projects), Segmentos.

**Automação** — Workflows, Sequências, SLA por etapa, Scoring, Rotation, Playbooks, Macros, KB, Enriquecimento, Snippets, Import CSV.

**Pessoas & Acesso** — Membros, User groups, Roles/permissões, Access policy, SCIM, SSO, Auditoria, Exportar auditoria, API Keys.

**Engajamento** — Formulários, Widget, Portal, Pesquisas, Email templates, Biblioteca de mídia, Prospecção, Scripts de prospecção, Agente de voz, Vídeo/reuniões.

**Integrações** — Conectores, LinkedIn (Unipile), Webhooks, Zapier, Slack, HubSpot Sync, HubSpot Users, Ads Sync, WhatsApp (Meta), WhatsApp Templates, WhatsApp Catálogos, WhatsApp Anúncios CTWA, Calendários, Booking.

**Financeiro compartilhado** (Sales cria cobrança, Finance concilia, Contracts recorre) — Pagamentos, Assinaturas, Recorrência, Dunning, NFS-e.

**Vendas & Contratos compartilhado** — Cotações (base), Modelos de cotação, Biblioteca de cláusulas, eSign.

### 7.2 Específicas de módulo (apenas `scope`; URL preservada)

- **TechSales** — `lead-sources`, `goals`, `quotes` (config operacional de numeração/expiração).
- **TechHire, TechContracts, TechServices, TechProjects, TechFinance** — sem telas exclusivas hoje; as que surgirem já nascem com `scope: "<module>"`.

### 7.3 Implementação
- Estender `Section`/`Tab` em `src/routes/_authenticated/settings.tsx` com `scope?: "global" | ModuleId` (default `"global"`).
- Sidebar de cada módulo consulta `sections` filtrando por `scope === moduleId`; ganha item "Ver todas as configurações do ERP" apontando para `/settings`.
- Nenhuma URL renomeada; nenhum redirect necessário.

### 7.4 Governança
Toda nova tela de configuração responde: "mais de um módulo consome isso?"
- Sim → nasce em `/settings/*` como global.
- Não → nasce em `/<modulo>/settings/*` com `scope` do módulo.

---

## Ordem sugerida (sprints ~1 semana)
1. **Sprint A** — Fase 0 + Fase 1 + Fase 3 + Fase 7 (marcar `scope` e ajustar sidebars).
2. **Sprint B** — Fase 2 (catálogo global: `service_catalog`, view unificada, rotas `/catalog/*`).
3. **Sprint C** — Fase 4.1 + 4.2 parte 1 (hierarquia, views, custom status).
4. **Sprint D** — Fase 4.2 parte 2 + 4.3 (dependências, timer, timesheet).
5. **Sprint E** — Fase 4.4 + refinos ClickUp.
6. **Sprint F** — Fase 5.1 (paridade ContaAzul).
7. **Sprint G** — Fase 5.2 Inter (Pix, saldo, extrato, conciliação).
8. **Sprint H** — Fase 5.2 Sicoob.
9. **Sprint I** — Fase 5.2 C6 + Fase 5.3 (lote).
10. **Sprint J** — Fase 6 priorizada.

## Notas técnicas
- `AppSidebar`: concatena `CORE_SIDEBAR_GROUPS` + `<MODULE>_SIDEBAR_GROUPS` + configs filtradas por `scope`.
- `service_catalog` com RLS por workspace, grants padrão (`authenticated` CRUD + `service_role` ALL).
- Bancos: preferir `standard_connectors` quando existir; adapter próprio + secrets manuais caso contrário.
- Aviso "tela de outro módulo": banner não-bloqueante no topo do conteúdo, sem alterar sidebar.

## Como validar (por sprint)
- Sprint A: TechSales sem itens de outros módulos; ao entrar num submódulo pela URL de outro, o sidebar não some e aparece banner.
- Sprint B: Produtos e Serviços aparecem no menu de todos os módulos consumidores; pickers usam `catalog_items`.
- Sprint F–I: cada banco entra atrás de feature flag até smoke test com credencial sandbox.
