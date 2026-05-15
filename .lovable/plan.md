
# CRM MVP — estilo HubSpot

## Visão geral
Aplicativo web multiusuário onde cada usuário gerencia seu próprio funil. Login por email/senha. Quatro entidades principais (Leads, Contatos, Empresas, Negócios) com relacionamentos, Kanban de negócios com drag-and-drop, notas e atividades, dashboard com métricas e import/export CSV.

## Stack
- TanStack Start + React + Tailwind
- Lovable Cloud (Supabase) para banco, auth e RLS
- shadcn/ui para componentes
- @dnd-kit para drag-and-drop do Kanban
- recharts para gráficos do dashboard
- papaparse para CSV

## Modelo de dados (Supabase)

```text
profiles (id=auth.users.id, full_name, avatar_url)

companies        (id, owner_id, name, domain, industry, size, website, phone, address, notes, created_at)
contacts         (id, owner_id, company_id?, first_name, last_name, email, phone, job_title, notes, created_at)
leads            (id, owner_id, first_name, last_name, email, phone, company_name, source, status[new|contacted|qualified|disqualified], notes, converted_at?, created_at)
deals            (id, owner_id, name, value, currency, stage[new|qualified|proposal|negotiation|won|lost], company_id?, primary_contact_id?, expected_close_date, notes, created_at)
deal_contacts    (deal_id, contact_id)            -- many-to-many
activities       (id, owner_id, type[note|task|call|email|meeting], subject, body, due_date?, completed,
                  related_lead_id?, related_contact_id?, related_company_id?, related_deal_id?, created_at)
```

Stages do pipeline: `new`, `qualified`, `proposal`, `negotiation`, `won`, `lost` (fixos).

RLS: cada tabela com `owner_id uuid not null` referenciando `auth.users(id)`. Policies: `owner_id = auth.uid()` para SELECT/INSERT/UPDATE/DELETE. `deal_contacts` usa subquery em `deals.owner_id`.

Trigger: `on auth.users insert` cria linha em `profiles`.

## Rotas

```text
/login, /signup, /reset-password
/_authenticated/
  /                    -> Dashboard (métricas)
  /leads               -> lista + filtros + import/export
  /leads/$id           -> detalhe + converter para Contato/Empresa/Negócio
  /contacts            -> lista + filtros + import/export
  /contacts/$id        -> detalhe + negócios + atividades
  /companies           -> lista
  /companies/$id       -> detalhe + contatos + negócios + atividades
  /deals               -> Kanban drag-and-drop (default) + toggle lista
  /deals/$id           -> detalhe + atividades + contatos vinculados
  /settings            -> perfil
```

Layout autenticado: sidebar (Dashboard, Leads, Contatos, Empresas, Negócios, Settings) + topbar com busca e logout.

## Funcionalidades por tela

**Dashboard**
- Cards: total de leads abertos, negócios ativos, valor do pipeline, taxa de conversão (won / (won+lost))
- Gráfico de barras: valor por estágio
- Gráfico linha: negócios criados últimos 30 dias
- Lista de tarefas pendentes (activities com due_date e !completed)

**Leads**
- Tabela (nome, empresa, email, fonte, status, criado em)
- Busca, filtro por status/source
- Criar/editar em dialog
- Botão "Converter": cria Company (se company_name preenchido), Contact, Deal vinculado, marca lead como `qualified` + `converted_at`

**Contatos / Empresas**
- Tabela com busca e filtros
- Detalhe mostra registros relacionados (negócios, atividades)

**Negócios**
- Kanban com 6 colunas (estágios fixos), drag-and-drop atualiza `stage`
- Cada card: nome, valor formatado, contato primário, data esperada
- Toggle para visualização em tabela
- Criar/editar em dialog com selects para empresa e contato primário

**Notas/Atividades**
- Componente `<ActivityTimeline />` reusável nas páginas de detalhe
- Tipos: note, task, call, email, meeting
- Tasks têm checkbox completed e due_date

**Import/Export CSV**
- Botões na lista de Leads e Contatos
- Import: parse com papaparse, mapeamento de colunas, validação Zod, insert em batch
- Export: gera CSV dos registros visíveis (respeitando filtros)

## Implementação técnica

- Server functions em `src/lib/*.functions.ts` com `requireSupabaseAuth` para todas operações
- Client query layer com TanStack Query (`queryOptions` + `ensureQueryData` + `useSuspenseQuery`)
- `attachSupabaseAuth` registrado em `src/start.ts`
- Validação com Zod nos `inputValidator`
- Design system: paleta neutra clean (branco/cinza com primary azul HubSpot-like), tokens em oklch no `src/styles.css`

## Entregáveis em ordem

1. Habilitar Lovable Cloud + migration com tabelas, enums, RLS, trigger de profile
2. Auth (login/signup/reset) + layout `_authenticated` + sidebar
3. CRUD de Empresas e Contatos (mais simples, valida o padrão)
4. CRUD de Leads + ação Converter
5. Negócios: tabela, dialog, Kanban drag-and-drop
6. ActivityTimeline + integração nas 4 páginas de detalhe
7. Dashboard com métricas e gráficos
8. Import/Export CSV em Leads e Contatos

## Fora do escopo (MVP)
- Email tracking, integração com Gmail/Outlook
- Workflows/automações
- Relatórios customizáveis
- Times/permissões compartilhadas (cada usuário vê só seus dados)
- Mobile app
