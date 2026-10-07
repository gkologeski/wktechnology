# Três propostas para aprovação visual

## Inspecionar no preview autenticado

- `/agents/prototype`: índice comparativo.
- `/agents/prototype/1`: Estúdio, canvas com paleta e inspetor lateral.
- `/agents/prototype/2`: Assistente de criação, wizard primeiro, biblioteca editorial e canvas com bandeja/editor modal.
- `/agents/prototype/3`: Central de operação, master-detail com atividade, wizard com trilha superior e canvas com inspetor inferior.

Use a navegação Agentes / Wizard / Estúdio / Cliente. No estúdio, explore Fluxo / Testar / Métricas / Conhecimento / Lançamento. Os controles White Label e tema só alteram a prévia; não persistem configurações do workspace.

## Escopo

Todos os agentes, anfitriões, fontes, métricas, canais e históricos são demonstrações. O canvas permite arrastar, selecionar, editar, adicionar blocos conectados ao selecionado, pan, zoom e fit. O teste responde por regras locais; não executa IA, fluxo de produção, WhatsApp, CRM ou agenda. Fontes simulam processamento, sem ingestão real. Salvar grava apenas localStorage separado por proposta. Não houve publicação, migração ou ativação de canal/campanha/agente. A escolha visual ainda está pendente; não é alegada paridade completa com ChatSuite.

## Arquivos e referências

Layouts: `studio-model.tsx`, `assistant-model.tsx`, `operation-model.tsx`. Dados/estado: `model.ts`, `state.tsx`. Canvas: `flow.tsx`, `flow-nodes.tsx`. Componentes compartilhados são separados por área; `shared.tsx` é um barrel. Estilos: `prototypes.css`. Rotas: `src/routes/_authenticated/agents.prototype*.tsx`, com parent Outlet e index separado.

Referências lidas: `AGENTS.md`, `docs/techhire-design-system.md`, `docs/new-screen-ux-ui-checklist.md`, `docs/architecture/frontend-conventions.md`, `src/lib/branding.tsx`, `src/lib/branding/archetypes.ts`, `src/lib/branding/tokens.ts`, `src/components/branding/archetype-selector.tsx`, `src/styles.css`, `src/components/inbox/inbox-workspace.tsx` e `src/components/deals/deals-toolbar.tsx`.

Regra White Label em `AGENTS.md`: “Arquétipos White Label são catálogos do workspace; trocam estilo, preservam identidade/assets e usam o `theme`.” As propostas preservam assets/fontes do workspace e usam tokens sem importar fonte remota. A regra de mockup aprovado é atendida pela apresentação destas propostas para escolha, não por uma aprovação presumida.

## Evidências de verificação

Playwright: `/tmp/browser/agents-options/verify.py`; log: `browser.log`. Capturas por proposta: `{1,2,3}-entry.png`, `-wizard.png`, `-canvas.png`, `-client.png`, `-Testar.png`, `-Métricas.png`, `-Conhecimento.png`, `-Lançamento.png`, `-dark-quiet.png`, `-dark-classic.png`, `-1280.png`, `-768.png`, `-390.png`. Capturas são temporárias de inspeção, não assets servidos pela aplicação.

Percursos autenticados passam: hard refresh, edição/retorno wizard, drag, edição e adição de bloco, cinco áreas, chat local, salvar/reabrir, claro/escuro e Quiet Premium/Enterprise Classic. Medidos 1440×900, 1280×800, tablet 768 e mobile 390; sem overflow horizontal global. Screenshots são inspecionadas após ajustes.

`bunx vitest run src/components/agents/prototypes/model.test.ts`: três testes passam (isolamento, validações, respostas locais usando agenda/fontes corretas). Lint direcionado: zero erros, dois avisos (tamanho de flow.tsx e export de hook no contexto). O typecheck automático global repetidamente atingiu o limite sem diagnóstico de arquivo; a validação global atual de types/build permanece inconclusiva. Não foi executado build/typecheck manual.

## Limites conhecidos

Portais dos componentes compartilhados (menus/modais) mantêm o tema global do aplicativo, enquanto a prévia claro/escuro/arquétipo é escopada à tela. Em telas pequenas, o canvas ajusta para visão geral; use zoom e pan para leitura detalhada. Conexões novas são automáticas ao adicionar, não há editor livre de arestas. Métricas e checklist são ilustrativos, nunca evidência de produção.