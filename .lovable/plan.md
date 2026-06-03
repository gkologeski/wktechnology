## Objetivo

Substituir a página atual `/tickets` por uma área de Help Desk no estilo HubSpot Service Hub, com três layouts (Tabela, Split, Quadro), sidebar de visualizações salvas, ações em lote e drawer de detalhe rico.

## Referência visual (HubSpot Help Desk)

- **Sidebar esquerda (~240px)**: lista de "views" — *Inbox / Não atribuídos / Meus abertos / Todos abertos / Urgentes / Vencidos / Fechados hoje*, com contador ao lado. Botão "+ Nova view".
- **Toolbar superior**: busca, seletor de pipeline, filtros (status, prioridade, dono, fonte, data), seletor de layout (Tabela / Split / Quadro), ordenação, "Novo ticket".
- **Layout Tabela**: linhas densas, checkbox de seleção, colunas customizáveis, badges de prioridade coloridos (Baixa cinza, Média amarelo, Alta laranja, Urgente vermelho), avatar do dono, SLA com cor (verde/âmbar/vermelho).
- **Layout Split**: lista compacta à esquerda (assunto, contato, prioridade, tempo) + painel direito com o ticket aberto (cabeçalho, abas Conversa/Comentários/Histórico, timeline de atividades, e propriedades à direita).
- **Layout Quadro (kanban)**: colunas = estágios do pipeline (não status genérico). Cards arrastáveis entre colunas com drag-and-drop, mostrando assunto, contato, prioridade, SLA e tempo aberto.
- **Bulk action bar** aparece flutuante ao selecionar (Atribuir, Mudar estágio, Mudar prioridade, Fechar, Excluir).
- **Drawer de detalhe** (ao abrir um ticket no modo tabela/quadro): 3 colunas — Sobre o ticket (esq), Conversa/Atividade (centro), Associações + Propriedades (dir), igual ao record layout existente.

## Escopo das mudanças (frontend apenas)

### 1. Pipeline de tickets (já existe `pipelines`/`pipeline_stages` no DB)
- Garantir que `tickets.pipeline_id` e `tickets.stage_id` são usados; se a coluna não existir, **adicionar via migração simples** apenas para alimentar o board (com fallback para `status` quando vazio).
- Settings de pipelines de ticket já são acessíveis em `/settings/pipelines` — sem alterações.

### 2. Reescrita de `src/routes/_authenticated/tickets.tsx`
Transformar em layout 2 colunas: `<TicketsSidebar />` + `<TicketsWorkspace />`.

### 3. Novos componentes em `src/components/tickets/`
- `tickets-sidebar.tsx` — views salvas + contadores (query agregada).
- `tickets-toolbar.tsx` — busca, pipeline picker, filtros, layout switch, novo ticket.
- `tickets-table.tsx` — reusa `useGridColumns`, adiciona checkbox de seleção e bulk bar.
- `tickets-split-view.tsx` — lista compacta + preview (reusa `RecordLayout` de `src/components/record/`).
- `tickets-board.tsx` — kanban por `stage_id`, drag-and-drop com `@dnd-kit` (já no projeto via deals-board).
- `ticket-card.tsx` — card compartilhado entre split e board.
- `ticket-bulk-bar.tsx` — barra de ação flutuante.
- `ticket-drawer.tsx` — drawer/full-page para detalhe usando `RecordLayout` existente.

### 4. Design tokens
- Cores de prioridade e SLA via tokens em `src/styles.css` (`--priority-urgent`, `--sla-breached`, etc.) para manter o tema.
- Sem cores hard-coded nos componentes.

## Não-escopo
- Não mexer em sincronização HubSpot (já feita em turnos anteriores).
- Não criar inbox de e-mail/conversa nova — reusa a timeline de atividades existente.
- Não alterar permissões/RLS.

## Diagrama

```text
┌──────────────┬─────────────────────────────────────────────┐
│ Views        │ Toolbar: busca | pipeline | filtros | view │
│  Inbox    12 ├─────────────────────────────────────────────┤
│  Meus      4 │                                             │
│  Não atrib 6 │   [ Tabela | Split | Quadro ]               │
│  Urgentes  2 │                                             │
│  Vencidos  1 │   <conteúdo do layout escolhido>            │
│  + Nova view │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

## Entrega
Quando aprovado, implemento na ordem: tokens → sidebar+toolbar → table → board → split → drawer → bulk bar.
