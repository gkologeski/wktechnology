## Avaliação das entregas de hoje × pontos de entrada de menu

Revisei rota-por-rota o que foi entregue hoje contra os arquivos `src/lib/menu-config*.ts`.

### Status por sprint/fase

| Sprint / Entrega | Rota | Menu? |
|---|---|---|
| S1–S8 People (ficha 360°, docs, OKRs, 1:1, reviews, VMS, timesheet, benefícios) | `/people`, `/people/$id` | ✅ |
| S9 Compliance de offboarding | (aba na ficha `/people/$id`) | ✅ (via ficha) |
| S10 Benefícios e custos | (aba na ficha `/people/$id`) | ✅ (via ficha) |
| **S11 Analytics de People** | `/people/analytics` | ❌ **faltando** |
| S12 Integração TechFinance (custos folha) | dashboard em `/people/analytics` | ❌ herda o gap do S11 |
| S13 Faturamento de horas | `/people/billing` | ✅ |
| S14 Margem por contrato | `/people/contract-margin` | ✅ |
| Meu time (gestores) | `/people/my-team` | ✅ |
| Documentos a vencer | `/people/documents` | ✅ |
| **Modelos de onboarding (People-side)** | `/people/onboarding-templates` | ❌ **faltando** (só há a versão de settings) |
| Modelos de onboarding (workspace) | `/settings/onboarding-templates` | ✅ (Automação & Engajamento) |
| **Onboarding guiado (wizard)** | `/onboarding/leads`, `/onboarding/companies`, `/onboarding/contacts` | ❌ **sem entrada** (só por URL) |
| Outsourcing em contratos | melhorias em `/contracts/$id` | ✅ (via /contracts) |
| Workflows cross-módulo, templates de ação, layout | `/settings/workflows` | ✅ |

### Gaps a corrigir

1. **`/people/analytics`** — dashboard entregue no S11/S12 não tem link.
2. **`/people/onboarding-templates`** — rota do módulo People existe mas não é acessível pelo sidebar (só a versão de workspace em `/settings/onboarding-templates`).
3. **Wizard `/onboarding/$entity`** — não há ponto de entrada visível; usuário só chega por URL manual.

### Plano de implementação

**1. `src/lib/menu-config-people.ts`** — adicionar dois itens ao grupo "Pessoas":
- `{ title: "Analytics", url: "/people/analytics", icon: BarChart3, need: "manager" }` — após "Margem por contrato".
- `{ title: "Modelos de onboarding", url: "/people/onboarding-templates", icon: LayoutTemplate, need: "manager" }` — no fim do grupo.

Importar `BarChart3` e `LayoutTemplate` do `lucide-react`.

**2. Ponto de entrada para o wizard de onboarding (opção A recomendada na conversa anterior)** — adicionar botão secundário **"Usar onboarding guiado"** dentro dos diálogos de criação existentes, escondido quando `pickOnbTemplate(entity)` retorna vazio:

- `src/components/leads/create-lead-dialog.tsx` → link para `/onboarding/leads`.
- `src/components/record/quick-create-dialogs.tsx` (Empresa e Contato) → link para `/onboarding/companies` e `/onboarding/contacts`.

Cada botão fecha o diálogo atual e navega via `<Link to>` do TanStack Router. Usa `useQuery` chamando `pickOnbTemplate({ entity })` para decidir a visibilidade — se não há template ativo, o botão nem aparece (mantém o fluxo rápido intacto).

**3. Sem alterações em RLS, schema, server functions ou lógica de negócio.** Apenas UI/menu.

### Fora do escopo (não mexer agora)

- Reorganizar os demais grupos do sidebar.
- Adicionar Quick Create global (opção B da conversa anterior) — pode ser um passo seguinte se o usuário quiser mais discoverability.
- Renomear/mover `/settings/onboarding-templates` (segue como está, é o catálogo cross-entidade).

### Validação manual sugerida

1. Como manager, abrir sidebar em TechPeople → conferir "Analytics" e "Modelos de onboarding" aparecem e navegam.
2. Como member, conferir que os dois itens novos NÃO aparecem (têm `need: "manager"`).
3. Criar template ativo em `/settings/onboarding-templates` para `leads`; abrir "Novo lead" → botão "Usar onboarding guiado" deve aparecer e navegar para `/onboarding/leads`.
4. Desativar o template → botão some no próximo abrir do diálogo.