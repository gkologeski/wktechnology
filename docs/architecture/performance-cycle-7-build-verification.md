# Performance — ciclo 7 (09/10/2026): build/verificação + integridade do histórico — preview, não publicado

Ambiente de todas as medições: sandbox de desenvolvimento, 8 núcleos, 31 GB RAM, Bun + Vite 7.3.1,
`NODE_OPTIONS=--max-old-space-size=8192`, `dist/` apagado antes de cada build (cache do Vite em
`node_modules/.vite` mantido igual em todas as rodadas). Commit base `98bb82d8d` + alterações deste ciclo.
Nada foi publicado, enviado ou alterado em dados de clientes. Nenhuma migration.

## 0. Integridade do histórico de mensagens (herdado do ciclo 6)

Problema real encontrado em `use-message-history.ts`:
- **Novas mensagens**: o laço parava após 5×100 páginas e só retomava no próximo evento. Não havia perda
  permanente (o cursor parte da última carregada), mas >500 novas ficavam ocultas até outro gatilho.
- **Reconciliação**: com janela >2.000 itens, parava em 20×100 e apenas unia (sem detectar exclusões).
  Com janela menor, `replaceWindow` substituía a janela inteira: **uma mensagem que chegasse por tempo real
  durante a revalidação, mais nova que a resposta, era apagada da tela**.

Correção (`src/lib/inbox/message-history.ts`, funções puras testáveis):
- `drainNewer`: continua até o servidor dizer que acabou; 5 páginas sequenciais por rodada e cede a vez à
  interface (`setTimeout 0`) entre rodadas; para em abort (troca de conversa/usuário/workspace) ou se o
  cursor não avança (sem laço infinito).
- `reconcileRange` + ação `replaceRange`: cada página é autoritativa **só no intervalo `(after, until]`
  que ela cobre** — ausente ali = excluída; fora dele nada é apagado (incompleto ≠ excluído). Na última
  página (fim do servidor) só saem ids que já estavam carregados antes da busca; o que chegou durante a
  busca fica. Sem teto que interrompa; 20 páginas por rodada.
- Hook: uma reconciliação por vez (chamadas concorrentes viram uma repetição), flags por contexto (a
  troca de conversa cria outro objeto, então um laço antigo abortado não libera o novo).

Testes isolados (fixtures sintéticas, sem banco): 2.600 carregadas + 600 novas → 3.200 únicos em 6 páginas;
abort na 3ª página aplica só 2; cursor parado → 1 chamada; janela de 2.600 com 3 excluídas (inclusive a
mais nova) e 1 status alterado → 26 páginas, 2.597 itens, status aplicado; abort após 3 páginas não apaga
101 excluídos ainda não verificados; mensagem nova durante a última página mantida; empate no mesmo
instante remove só o id excluído. `message-history.test.ts`: 18/18.

## 1. Linha de base do build

Fases (`bun run build`, log em cada rodada): **client** (5.769 módulos) → **ssr** (2.217) → **nitro**
(5.759, preset `cloudflare-module`). A fase nitro é a maior (46–71 s) e retransforma quase todo o grafo;
não foi alterada (é configurada pelo preset `@lovable.dev/vite-tanstack-config`; mexer exigiria prova e
risco de duplicar plugins).

Diagnóstico reproduzível adicionado (não muda o bundle normal):
- `PERF_SOURCEMAP=1 bun run build` gera sourcemaps (padrão continua `false`).
- `PERF_GRAPH=1 bun run build` grava `/tmp/perf-graph.json` com o caminho de imports mais curto que trouxe
  cada módulo para o chunk de entrada (`scripts/perf/graph-plugin.ts`).
- `python3 scripts/perf/chunk-closure.py dist/client/assets index- <rota>-` soma raw/gzip do fechamento de
  imports estáticos (entrada + chunk da rota + dependências).

Composição da entrada (1.047.277 B raw, source-map-explorer): react-dom 181 KB, supabase (auth/realtime/
storage/postgrest/phoenix) ~200 KB, router-core 61 KB, zod 55 KB, routeTree 35 KB, sonner 34 KB,
tailwind-merge 28 KB. **Achado causal**: `src/routes/_authenticated/prospecting.index.tsx` exportava
`PROSPECTING_TAB_PERMISSIONS` (sem nenhum uso), o que impedia o code-splitting de mover a lista de abas — e
com ela as 12 telas da Prospecção, `cmdk`, Radix Select/Popover/ScrollArea etc. — para fora da entrada
(~363 KB de módulos atribuídos a essa rota).

## 2. Otimização aplicada (uma)

Removido o export não usado. Mesmo ambiente, A = antes, B = depois:

| Medida | A | B |
| --- | --- | --- |
| Entrada `index-*.js` raw / gzip | 1.047.277 / 309.890 | **931.973 / 269.940 (−11,0% / −12,9%)** |
| Fechamento `/login` (gzip) | — | 304.446 (6 chunks) |
| Fechamento `/dashboard` gzip | 360.357 (39 chunks) | 348.093 (56) **−3,4%** |
| Fechamento `/inbox/email` gzip | 360.682 (52) | 361.737 (76) +0,3% |
| Fechamento `/prospecting` gzip | 420.207 (84) | 433.879 (125) **+3,3%** |
| Tempo total do build (`/usr/bin/time`) | 158 s, 132 s | 126 s, 120 s, 122 s (final) |
| Pico de memória | 7,33 / 7,31 GB | 7,31 / 7,31 / 7,32 GB |

Leitura honesta: o ganho comprovado é **−40 KB gzip na entrada**, que toda primeira visita baixa
(qualquer rota). A própria Prospecção fica ~14 KB gzip mais pesada (mais chunks, mais sobrecarga) — aceito
porque é uma tela entre centenas. O tempo de build caiu nas amostras (média A 145 s, B 123 s), mas com 2–3
amostras e variação de 26 s dentro de A **não é prova** de ganho de tempo. Memória igual.

Rollback: recolocar `export const PROSPECTING_TAB_PERMISSIONS = TABS.map((t) => t.permission);`.

## 3. Verificação incremental (feedback, não gate)

`bun run verify:changed` (`scripts/verify-changed.ts`, regras em `scripts/verify-changed/select.ts`):
- **Typecheck sempre completo** (`tsgo`). Não há project references; checagem parcial de tipos não seria
  segura e não foi avaliada como migração (sem ganho demonstrável: tsgo completo levou 17–19 s frio,
  0,8 s com cache quente).
- Lint só dos arquivos alterados (cache de conteúdo do ESLint).
- Testes: `vitest related`, que segue o grafo real de imports — inclui testes de outros módulos que
  importam o arquivo alterado.
- Fallback total (lint `.` + `vitest run`): package.json/lockfile, tsconfig, vite/vitest/eslint config,
  `routeTree.gen.ts`, `src/integrations/**`, router/start/server/__root, `styles.css`, `lib/utils.ts`,
  `components/ui`, `techhire/ui`, `access-control`, migrations, guard de hardcode, o próprio script,
  arquivo fora do mapa, arquivo de código removido, ou git indisponível.
- Os módulos (TechSales, TechHire, Agents, TechProjects…) são só informativos; quem decide os testes é o
  grafo de imports.
- Sem paralelismo novo (os passos rodam em sequência).

Validação: 14 testes de seleção (`src/lib/dev-tools/verify-changed-select.test.ts`); execução real com 4
arquivos: 22 s (tsgo 18,5 s + lint 1,2 s + 2 arquivos de teste/32 testes 2,4 s), exit 0; dry-run com
`package.json` alterado escolheu modo completo. Um bug do próprio script (descartava o 1º arquivo
explícito) foi encontrado nessa execução e corrigido.

**Gate obrigatório antes de entrega/publicação continua sendo `bun run verify` + `bun run build`.**

## 4. Reorganização de módulo

Não feita: o achado do item 2 já era a extração de fronteira útil; mover arquivos sem medida não entra.

## 5. Gates finais

- `tsgo --noEmit`: exit 0. `vitest run`: exit 0, 103 arquivos / **720 testes** (699 + 21 novos).
- `bun run build`: exit 0 (122 s, entrada 931.973 B).
- `eslint .`: exit 1 — **503 erros, todos `prettier/prettier`, em 43 arquivos que este ciclo não tocou**;
  0 erros de outras regras; 0 erros nos arquivos alterados. Dívida de formatação separada (não formatado o
  repositório inteiro). Por isso `bun run verify` hoje para no lint; os testes foram rodados à parte.
- Smoke autenticado read-only no preview (dev): `/dashboard`, `/prospecting` (abas e fila renderizadas),
  `/inbox`, `/deals` — sem erros de página. Nenhuma conversa WhatsApp aberta. SSR de produção não foi
  exercitado no navegador (só o build).

## Pendências

- Timeout automático de 240 s: o log da plataforma (`/tmp/observability/build-errors.log`) agora mostra que
  é a etapa **"typecheck"** que é encerrada (226–240 s, 12 vezes entre 20:32 e 21:38 UTC). Esse intervalo
  coincide com os 6 builds de produção deste ciclo (8 núcleos, ~7,3 GB cada); as 3 verificações depois que
  os builds pararam (21:38, 21:40, 21:47) deram "build OK". Indício forte de **disputa de CPU/memória**, não
  prova: o comando exato do typecheck da plataforma segue desconhecido (localmente `tsgo` completo leva
  17–19 s frio; `tsc` sem cache ~2m25s, ciclos anteriores). Não alterado nem contornado. Consequência
  prática: evitar builds pesados simultâneos às verificações automáticas.
- Fase nitro (46–71 s) retransforma ~5.700 módulos — maior custo isolado, configurada pelo preset; não
  alterada.
- `settings.tsx` exporta `getSettingsForScope` (≈23 KB na entrada) e `dashboard.tsx` é a 1ª rota a puxar
  zod: candidatos ao mesmo tipo de correção, a medir em ciclo próprio.
- Assinatura realtime `branding` recusada pelo servidor (ciclo 6): **prioridade alta** — decidir entre
  incluir só essa tabela na publicação (migração aditiva) ou remover a assinatura; não ampliar publicações
  em bloco.
- RLS não-admin no banco real: segue não validada (requisito de publicação).
- Evento realtime ponta a ponta: segue não comprovado.
