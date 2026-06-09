## Objetivo

Permitir que o usuário crie e gerencie modelos HTML para a página pública da cotação, escolha qual modelo aplicar a cada cotação gerada dentro de um negócio, e tenha 3 modelos prontos para começar.

## Mudanças de banco (uma migração)

1. **Nova tabela `quote_templates`** (workspace-scoped):
   - Campos de domínio: `name`, `description`, `html` (string com o HTML do modelo + placeholders), `is_default` (boolean), `is_system` (boolean — marca os 3 modelos seed).
   - `owner_id`, `workspace_id`, timestamps padrão, trigger `updated_at`.
   - GRANTs para `authenticated` e `service_role`.
   - RLS por workspace, no padrão das demais tabelas do projeto.
   - Trigger para garantir que só exista um `is_default = true` por workspace.

2. **`quotes.template_id`** — coluna `uuid` opcional, FK para `quote_templates` com `ON DELETE SET NULL`.

3. **Seed dos 3 modelos por workspace**: feito por trigger `AFTER INSERT ON workspaces` que insere os 3 modelos padrão; e por uma rotina única que cria os modelos nos workspaces existentes (executada como parte da migração). Os 3 modelos:
   - **Clássico** — layout sóbrio, cabeçalho com dados da empresa, tabela tradicional, rodapé com termos.
   - **Moderno** — cabeçalho colorido com logo, blocos espaçados, tipografia maior.
   - **Compacto** — uma página enxuta, ideal para cotações curtas, foco no total e CTA de aceite.

## Server functions (`src/lib/quote-templates.functions.ts`)

- `listQuoteTemplates` — lista os modelos do workspace do usuário (ordenados por `is_default desc`, `name asc`).
- `getQuoteTemplate({ id })`.
- `createQuoteTemplate({ name, description, html })`.
- `updateQuoteTemplate({ id, patch })` — bloqueia editar `is_system` no nome (mas permite clonar/editar HTML).
- `deleteQuoteTemplate({ id })` — bloqueia exclusão se `is_system`.
- `setDefaultQuoteTemplate({ id })` — marca default e desmarca os demais.
- `duplicateQuoteTemplate({ id })` — clona um modelo (útil para partir dos modelos do sistema sem perdê-los).

Todas com `requireSupabaseAuth`; filtro por `workspace_id` do usuário; validação Zod.

Ajuste em `src/lib/quotes.functions.ts`:
- `createQuoteFromDeal` aceita `templateId?` e grava em `quotes.template_id` (ou usa o modelo default do workspace quando ausente).
- `updateQuote` aceita atualizar `template_id`.
- `getQuoteByToken` passa a retornar também o `template` (id, name, html) para o renderer público.

## UI: gestão de modelos

**Nova rota:** `src/routes/_authenticated/settings.quote-templates.tsx`
- Lista de modelos à esquerda (com badge "Padrão" e "Sistema"), ações: novo, duplicar, definir como padrão, excluir (oculto para sistema).
- Botão "Novo modelo" abre o editor em branco.

**Componente editor** `src/components/quote-templates/template-editor.tsx`:
- Layout duas colunas (desktop) / abas (mobile).
- Esquerda: `name`, `description`, e textarea monoespaçada com o HTML. Toolbar acima do textarea lista os placeholders disponíveis — clicar insere no cursor.
- Direita: iframe sandbox (`sandbox="allow-same-origin"`, `srcDoc`) que renderiza o HTML interpolado com uma cotação fictícia de exemplo, atualizando em tempo real (debounce 200ms).
- Botões: Salvar, Salvar e fechar, Definir como padrão.

**Renderer compartilhado** `src/lib/quote-template-renderer.ts`:
- Função `renderQuoteTemplate(html, data)` que substitui placeholders. Suporta:
  - Escalares: `{{quote.number}}`, `{{quote.title}}`, `{{quote.total}}`, `{{quote.currency}}`, `{{quote.subtotal}}`, `{{quote.discount_total}}`, `{{quote.tax_total}}`, `{{quote.valid_until}}`, `{{quote.notes}}`, `{{quote.terms}}`, `{{company.name}}`, `{{company.domain}}`, `{{contact.name}}`, `{{contact.email}}`, `{{agent.name}}`, `{{agent.email}}`.
  - Loops: bloco `{{#each items}} ... {{/each}}` com `{{name}}`, `{{quantity}}`, `{{unit_price}}`, `{{discount_pct}}`, `{{tax_rate}}`, `{{line_total}}`.
  - Condicionais simples: `{{#if quote.valid_until}}...{{/if}}`.
  - Bloco especial `{{#actions/}}` que o renderer do público troca pelos botões Aceitar/Recusar/Pagar; no preview do editor é renderizado como placeholder visual.
- Escapa HTML por padrão nos valores interpolados. Sanitiza o HTML final com DOMPurify antes de exibir (no preview do editor e na página pública).

## UI: seleção no negócio

`src/components/deals/deal-quotes.tsx`:
- No diálogo "Nova cotação", adicionar campo "Modelo" (Select) carregando `listQuoteTemplates`, padrão = template default do workspace, com opção "Sem modelo (layout padrão)".
- Persistir `template_id` ao criar.
- Em cada cotação listada, adicionar botão "Trocar modelo" que abre popover com a mesma Select e chama `updateQuote({ id, patch: { template_id } })`.

## UI: página pública da cotação

`src/routes/quote.$token.tsx`:
- Quando `template` existir, renderizar a página inteira a partir do HTML do modelo via `renderQuoteTemplate`, dentro de um wrapper que injeta os botões Aceitar/Recusar/Pagar (substituindo `{{#actions/}}`) e mantém o modal de assinatura atual.
- Quando não houver template, manter o layout atual como fallback.

## Navegação

Adicionar item "Modelos de cotação" no menu de Settings (perto de `settings.quotes`).

## Detalhes técnicos

- **Sanitização**: usar `dompurify` + `isomorphic-dompurify` no server (já compatível com o runtime). Adicionar a dependência.
- **Preview iframe**: `srcDoc` com base CSS mínima injetada para evitar herança de estilos da app.
- **Sem editor de código pesado**: textarea monoespaçada com `spellcheck=false`, tab handling básico — evita adicionar bundles grandes.
- **Tipos**: após a migração, o `types.ts` é regenerado automaticamente e as functions consomem os tipos novos.

## Arquivos a criar/editar

Criar:
- `src/lib/quote-templates.functions.ts`
- `src/lib/quote-template-renderer.ts`
- `src/components/quote-templates/template-editor.tsx`
- `src/components/quote-templates/template-list.tsx`
- `src/routes/_authenticated/settings.quote-templates.tsx`

Editar:
- `src/lib/quotes.functions.ts` (aceitar/retornar `template_id` + template)
- `src/components/deals/deal-quotes.tsx` (seleção de modelo na criação e troca)
- `src/routes/quote.$token.tsx` (renderizar via template quando houver)
- Menu de settings (link para a nova rota)

## Ordem de execução

1. Migração (tabela + coluna + seed + trigger).
2. Server functions de templates + ajustes em `quotes.functions.ts`.
3. Renderer + sanitizer.
4. Rota e UI de gestão de modelos.
5. Integração no `deal-quotes` e na página pública.
6. Verificação: criar/editar/duplicar modelo, gerar cotação no negócio escolhendo modelo, abrir link público e validar render + ações.
