## Problema

Ao rolar horizontalmente com o trackpad dentro dos grids (Kanban e tabelas com rolagem horizontal), o gesto para a esquerda no fim/início da rolagem é interpretado pelo navegador como "voltar página" (swipe-back nativo do macOS/Chrome/Safari). Isso acontece porque os containers não isolam o overscroll horizontal, deixando o navegador tomar controle do gesto.

## Solução

Aplicar `overscroll-behavior-x: contain` nos containers com rolagem horizontal. Isso mantém o gesto do trackpad dentro do container e impede a navegação de histórico do navegador, sem alterar comportamento visual nem funcional.

## Escopo

Alteração apenas de CSS/utilitários de apresentação. Nada de lógica, dados, RLS ou rotas.

### 1. `src/styles.css`

Acrescentar `overscroll-behavior-x: contain` nas regras existentes do Kanban:

```css
.kanban-top-scroll { overscroll-behavior-x: contain; ... }
.kanban-content-scroll { overscroll-behavior-x: contain; scrollbar-width: none; }
```

E adicionar uma classe utilitária global para reutilizar em tabelas:

```css
.h-scroll-contain { overscroll-behavior-x: contain; }
```

### 2. Aplicar `overscroll-behavior-x: contain` (via classe Tailwind `overscroll-x-contain`) nos containers principais com rolagem horizontal de dados:

- `src/routes/_authenticated/(ats)/candidates.index.tsx` (tabela de candidatos)
- `src/routes/_authenticated/(ats)/jobs.index.tsx` (tabela de vagas)
- `src/routes/_authenticated/(ats)/jobs.$id.tsx` (linha rolável do detalhe da vaga)
- `src/routes/_authenticated/reports.tsx` (tabela de relatórios)
- `src/routes/_authenticated/settings.billing.tsx` (tabela de faturas)
- `src/routes/_authenticated/settings.audit-log.tsx` (tabela do audit log)
- `src/routes/_authenticated/settings.notifications.tsx` (tabela de notificações)
- `src/components/projects/list-views.tsx` (lista rolável)
- `src/components/hubspot/import-wizard.tsx` (preview tabular)
- `src/components/stage-tracker.tsx` (trilho de estágios)
- `src/components/activity-timeline.tsx` (linha de filtros/pills)
- `src/routes/_authenticated/projects.lists.$id.tsx` (colunas de listas)

Containers que já são apenas barras de abas/tabs curtas (ex.: `entity-list.tsx`, `tasks.tsx`, `leads.tsx`) recebem o mesmo tratamento por consistência: o comportamento nativo do navegador se manifesta em qualquer container horizontal, mesmo que curto.

## Validação manual

1. Abrir uma lista com scroll horizontal (ex.: `/candidates`, `/reports`, ou o Kanban de deals).
2. Rolar para a direita com o trackpad até o fim, depois rolar para a esquerda — a página não deve voltar no histórico.
3. No começo do container, tentar puxar mais para a esquerda com o trackpad — o navegador não deve navegar para trás.
4. Repetir em Chrome e Safari (macOS).

## Fora do escopo

- Rolagem vertical (não há relato de problema).
- Redesign visual, scrollbars customizadas em novos componentes, novos comportamentos de teclado.
- Qualquer alteração em RLS, server functions, dados ou lógica de negócio.
