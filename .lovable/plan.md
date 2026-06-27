## Objetivo

Promover `Candidato` ao mesmo nível de entidade dos `Contatos` no TechHire: rota de lista com múltiplas visualizações (Tabela, Cards, Kanban e **Mapa de skills**), rota de detalhe em 3 colunas e padrões consistentes com o restante do produto. Sem alterar regras de negócio, schema, RLS, autenticação, integrações ou funcionalidades já entregues. Visual seguindo a Design Foundation oficial (quiet premium, enterprise).

## Padrão de referência

Reusar a arquitetura de `Contatos`:
- Lista: `src/routes/_authenticated/contacts.tsx` (ViewsTabs + FiltersSidebar + DataTable + colunas configuráveis + bulk actions).
- Detalhe: `src/routes/_authenticated/contacts.$id.tsx` (`RecordLayout` com header + 3 colunas).
- Kanban: padrão visual de `src/components/deals/deals-board.tsx`.

## Escopo

### 1. Lista — `/candidates`

`AtsPageHeader` ("Talentos / Candidatos") + contador ao vivo + ações (Exportar CSV, Parsing de CV IA, Novo candidato).

**ViewsTabs** com 4 visualizações:
- **Tabela** (default) — DataTable densa, colunas configuráveis e ordenação.
- **Cards** — grid atual refinado (3 col).
- **Kanban** — agrupado por status do talento derivado (§4).
- **Mapa de skills** (§3) — visão analítica para sourcing.

Views salvas como chips: Todos · Meus · Sem responsável · Adicionados na semana · Silver Medalists · Em processo ativo.

`FiltersSidebar`: status do talento (derivado) · pools · source · seniority · work_mode · localização (facet top 30) · skills (multi-select) · vaga atual · período de criação · risco (`ats_candidate_flags`).

Toolbar: busca, `ColumnsButton`, bulk actions (excluir, mover para pool, exportar CSV, enviar para sequência de sourcing).

Colunas padrão: nome+avatar · cargo@empresa · seniority · location · status do talento · vagas ativas · match alto · última atividade · source · criado em · responsável.

### 2. Detalhe — `/candidates/$id` (nova rota)

Cabeçalho com voltar, avatar, nome, headline (cargo@empresa), pills (seniority, work_mode, status do talento) e ações (editar, excluir, mover para pool, criar aplicação, agendar entrevista).

`RecordLayout` em 3 colunas:

**Esquerda — Propriedades** (`PropertiesPanel` em `ats_candidates`): identificação, profissional, compensação (oculto por permissão futura), origem, currículo (link `cv_url` + botão re-parsear), notas.

**Centro — Atividade e IA**: `AiSummaryPanel` + sub-abas (Timeline · Aplicações · Entrevistas · Scorecards · Match scores · E-mails de stage · Outreach) com `ActivityTimeline` cross-entity.

**Direita — Associações e contexto**: status do talento, aplicações ativas, pools, entrevistas próximas, ofertas, flags de risco, referral, dono.

### 3. Mapa de skills (novo)

Visualização analítica dedicada para sourcing e workforce planning — totalmente leitura, sem alterar schema.

Layout do mapa:
- **Header**: heading "Mapa de skills do pool", contagem de candidatos e skills únicas presentes no filtro atual, toggle "agrupar por: senioridade / pool / vaga / nenhum", toggle "incluir contratados/arquivados".
- **Painel esquerdo (300px)**: lista de skills ranqueadas, com barra horizontal de frequência (% do pool no filtro atual). Cada skill é um chip clicável que faz drill-down (filtra os candidatos por essa skill). Multi-seleção permite intersecção (ex.: React + TypeScript + Senior).
- **Painel central (1fr)**: dois modos alternáveis no canto superior direito:
  - **Heatmap (default)**: matriz `skills × bucket` (seniority/pool/vaga). Cor é a contagem, tooltip mostra exemplos de 3 candidatos e total; clique abre drill-down. Limite visual 30 skills × 8 buckets, ordenadas por demanda (vagas abertas) primeiro e oferta (candidatos) depois.
  - **Bubble grid**: skills em grid de bolhas tamanho ∝ candidatos, cor ∝ gap (demanda − oferta). Útil para enxergar skills sub/sobre-ofertadas.
- **Painel direito (320px)** quando há skills selecionadas: lista resumida dos candidatos que casam (top 50), com avatar, nome, match com a seleção (n de m skills), seniority, source e link para o detalhe. Botões: "Abrir como lista filtrada", "Adicionar selecionados a um pool", "Adicionar a sequência de sourcing".

Sinal de demanda (skills-gap):
- Demanda = contagem de skills exigidas nas vagas abertas (`ats_jobs.status='open'` com campo de skills/requisitos já existente). Se a tabela não expõe skills estruturadas, derivar via tokenização simples do `description/requirements` no servidor (cache em memória por request) — sem mudar schema.
- Oferta = contagem de candidatos com a skill no filtro atual.
- Chip "Skill em alta" quando demanda > oferta × 1,2.

Acessibilidade: tabela equivalente abaixo do heatmap (visualmente oculta, lida por screen-reader) com mesmo conteúdo; cores do heatmap usam tokens semânticos com contraste AA.

Performance: cap em 300 candidatos por consulta agregada; paginação "Carregar mais" no painel direito; cálculo de matriz no servidor.

Componentes: `src/components/ats/skills-map/` com `SkillsMap.tsx`, `SkillRankList.tsx`, `SkillHeatmap.tsx`, `SkillBubbleGrid.tsx`, `MatchedCandidatesPanel.tsx`. Sem libs novas — SVG/CSS grid puro.

Server fn: `getSkillsMap({ filters, groupBy, includeArchived })` → `{ skills:[{name, total, byBucket:Record<string,number>, demand}], buckets:string[], candidates:Array<{id, name, skills, seniority, source, pool_ids}> }`.

### 4. Kanban global de candidatos

`src/components/ats/candidates-board.tsx` reusando estética de `deals-board`. Colunas por status do talento derivado. Card: avatar, nome, headline, nº de aplicações ativas, melhor match score, source. Drag permitido só entre estados seguros; estados que exigem contexto (vaga, oferta) abrem diálogo em vez de mover silenciosamente.

### 5. Status do talento (derivado, sem mudar schema)

`src/lib/ats/candidate-status.functions.ts` → `getCandidateStatuses(ids)`:
- **Contratado**: `ats_offers.status='accepted'` recente
- **Oferta**: `ats_offers.status in ('sent','viewed')`
- **Entrevista**: `ats_interviews` futura
- **Em processo**: `ats_applications.status='active'`
- **Arquivado**: candidato `status='archived'` ou todas aplicações `rejected/withdrawn`
- **Novo**: caso contrário

Somente leitura. Usado por Kanban, filtros e badges.

### 6. Componentes a criar/promover

`candidates-table.tsx`, `candidates-cards.tsx`, `candidates-board.tsx`, `candidate-header.tsx`, `candidate-status-badge.tsx`, `candidate-associations.tsx`, `skills-map/*`. Reuso: `RecordLayout`, `PropertiesPanel`, `ActivityTimeline`, `AiSummaryPanel`, `ViewsTabs`, `FiltersSidebar`, `FilterGroup`, `OwnerFilter`, `AtsPageHeader`, `EmptyState`, `Skeletons`, `MetaPill`, `SourceBadge`, `Tabs`.

### 7. Server functions (leitura/composição apenas)

- `listAtsCandidates` — estender com filtros (pool, seniority, work_mode, location, skills, jobId, status, createdPreset, ownerIds, sort, paginação). Backwards-compatible.
- `getCandidate(id)` — candidato + agregados.
- `getCandidateStatuses(ids)`.
- `getSkillsMap(filters)`.
- `moveCandidateStatus(id, toStatus, ctx)` — orquestra ação derivada; devolve `requires_dialog` quando precisa de input.

Sem alterar RLS/schema/policies. Tudo via `requireSupabaseAuth`.

### 8. Navegação e links

Sidebar ATS: "Candidatos" → `/candidates`. Todos os lugares que renderizam nome de candidato (Kanban da vaga, sourcing inbox, captures, notetaker, fraud flags, match scores) passam a usar `<Link to="/candidates/$id">`. Persistência de view ativa em `localStorage`.

### 9. Estados obrigatórios

Loading com skeletons fiéis ao layout final, empty states, error com retry, foco visível, labels acessíveis, responsividade, dark mode.

## Fora de escopo

Inline editing em tabela, permissão de campo sensível (salário), bulk add to sequence (apenas stub), custom properties para candidato, materializar status derivado.

## Riscos e mitigações

- Kanban sem vaga: estados que exigem vaga abrem diálogo.
- Performance da lista + status derivado: status em batch só da página visível.
- Mapa de skills com pools grandes: cap em 300 candidatos e top 30 skills × 8 buckets; agregação no servidor.
- Skills não estruturadas em vagas: derivar com tokenização leve e marcar como "estimado" no tooltip.

## Entrega faseada

1. **Fase A — Detalhe** `/candidates/$id` com `RecordLayout` + links a partir das telas do ATS.
2. **Fase B — Lista** revamp com `ViewsTabs` (Tabela + Cards), `FiltersSidebar`, colunas configuráveis, bulk actions.
3. **Fase C — Kanban global** + status derivado.
4. **Fase D — Mapa de skills** + skills-gap.
5. **Fase E — Polimento** (associations panel completo, status no header, persistência de view).

## Como validar manualmente

1. Lista: alternar Tabela / Cards / Kanban / Mapa de skills; filtros; ordenação; bulk delete e bulk export.
2. Detalhe: abrir `/candidates/$id` pelo Kanban da vaga; editar propriedades; navegar sub-abas; adicionar/remover de pool.
3. Kanban: arrastar Novo → Em processo (diálogo de vaga); Arquivar com confirmação.
4. Mapa: selecionar 2-3 skills, ver intersecção no painel direito, abrir como lista filtrada, alternar heatmap ↔ bubble, alternar agrupamento.
5. Dark mode e tablet 768px.

## Próximo passo recomendado

Aprovar a divisão A→E. Sugestão de começar pela **Fase A (Detalhe em 3 colunas)** — entrega valor imediato e desbloqueia links de todas as outras telas — sem mexer na lista atual.
