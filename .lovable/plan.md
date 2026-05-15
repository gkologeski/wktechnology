# Contadores em tempo real durante a importação

Substituir, na tela de execução (`ImportTimeline`), o sumário textual atual ("X/Y etapas · N registros importados") por um painel de **contadores ao vivo, um por objeto**, com animação de número subindo, anel de progresso e ícone do objeto. O usuário acompanha visualmente quantos registros de cada tipo já foram importados em tempo real.

## Layout proposto

Logo acima do bloco "Etapas", um grid responsivo de cards — um para cada objeto presente no escopo (Empresas, Contatos, Negócios, Leads, Atividades). Cada card é um `LiveCounter`:

```text
┌─────────────────────────┐
│ 🏢  Empresas    ◐ 62%   │
│                         │
│      127 / 200          │   ← número grande animado (rolagem)
│   ──────────────        │   ← barra/anel de progresso
│   ✓ 125 ok · ✗ 2 falhas │
└─────────────────────────┘
```

Estados visuais:
- **pending**: card em opacidade baixa, ring `border-muted`, número `0`.
- **running**: ring com gradiente animado (`from-primary to-primary/60`), pulso suave no ícone, número crescendo via tween.
- **done**: ring `border-emerald-500`, ícone `CheckCircle2`, badge "concluído".
- **failed**: ring `border-destructive`, ícone `XCircle`.

O número grande usa **tween** (CSS transition em `--n` via `@property` ou pequeno hook `useAnimatedNumber` com `requestAnimationFrame`) — sem libs externas. Quando o valor sobe, anima de `prev` até o novo valor em ~600ms com `ease-out`.

Para Empresas, o denominador é `maxCompanies` (vem do `scope` do job). Para os filhos (Contatos/Negócios/Leads/Atividades), o denominador não é conhecido a priori (a cascata descobre em runtime); o card mostra apenas o numerador grande + um indicador "descobrindo…" (chips com counts parciais extraídos dos `step_logs`, ex.: `2.1k contatos descobertos · 850 importados`). Quando a etapa termina, o denominador passa a ser o próprio total final.

Faixa inferior global (logo abaixo do grid) mantém o `Progress` por etapas + tempo decorrido (HH:MM:SS) e ETA estimado.

## Como os contadores se atualizam

O componente já está assinado em Realtime (`enrichment_jobs` + `enrichment_job_items`). Vou derivar por objeto:
- `succeeded` / `failed` por etapa: lê `enrichment_job_items.after.{succeeded,failed}` quando a etapa fecha; durante a execução, extrai o último `count` do `step_logs` filtrado por `step` para alimentar o numerador "descoberto" (`discovered`).
- `imported` durante execução: o item ainda está `running`, então o `after` é null. Para contar em tempo real, vou adicionar `running_succeeded`/`running_failed` no `before` do item e atualizar a cada inserção (já temos `appendLog` por página/lote — basta atualizar 1 campo do item junto). Isso evita alterar schema.

### Pequeno ajuste no backend

`startHubspotImport` já atualiza `step_logs` e o `enrichment_jobs.succeeded` global. Para granularidade por etapa em tempo real, vou:
- Após cada `insert` bem-sucedido em uma etapa, atualizar `enrichment_job_items.before.running_succeeded` e `running_failed` (já gravamos `before` como JSON livre). Throttle: a cada 5 inserts ou no fim de cada lote/página para não bater no banco a cada linha.
- Frontend lê `it.before.running_succeeded` enquanto `status='running'` e `it.after.succeeded` quando `status='done'`.

## Componente novo

`src/components/hubspot/live-counter.tsx` — recebe `{ icon, label, value, target?, status, failed }`, anima o número, renderiza o ring + barra. Reutiliza `lucide-react` e tokens do design system (`text-primary`, `bg-card`, `border-emerald-500`, etc.).

Hook auxiliar `useAnimatedNumber(value, duration=600)` em `src/hooks/use-animated-number.ts`.

## Edição em `import-timeline.tsx`

- Logo após o card de status, renderizar `<LiveCountersGrid items={items} scope={job?.scope} />`.
- Mantém a seção "Etapas" (lista vertical) e o "Log" como estão — a função delas é detalhar; os contadores são o destaque novo.

## Entregáveis

1. `src/hooks/use-animated-number.ts` — tween simples por rAF.
2. `src/components/hubspot/live-counter.tsx` — card individual + grid.
3. `src/components/hubspot/import-timeline.tsx` — incluir o grid no topo.
4. `src/lib/integrations/hubspot.functions.ts` — pequena atualização para gravar `running_succeeded/failed` por item durante a execução (throttled).

## Fora de escopo

- ETA preciso (mostro só tempo decorrido + estimativa linear).
- Sons/notificação ao concluir.
- Persistência histórica de jobs anteriores nessa tela.
