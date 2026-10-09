# Performance — ciclo 3 (09/10/2026) — A implementada; B e C pendentes

Base: commit do ciclo 2 `5c573cea5`. Sem publicação, envios ou alteração de dados reais.

## Implementado e validado
- `0087_performance_cycle3_timeline_count_fix.sql` (aditiva, `CREATE OR REPLACE`, mesma assinatura — clientes antigos compatíveis):
  1. `total` = soma das contagens por categoria (antes contava categorias).
  2. Contrato do responsável explícito: sem IDs e sem "sem responsável" → sem filtro; só "sem responsável" → apenas
     `COALESCE(assigned_to, owner_id) IS NULL`; IDs + flag → união. Antes, só a flag liberava tudo.
  3. UUID de e-mail validado pelo formato canônico 8-4-4-4-12 dentro de `CASE` (cast nunca avaliado para texto inválido).
- Teste SQL real `tests/sql/timeline-activity-page.sql` (transação com `ROLLBACK`, fixture isolada):
  45 atividades (30 notas/15 ligações) → total 45, contagens corretas, páginas 40+5 sem sobreposição,
  filtro categoria 15, só-responsável 45, "sem responsável" 0 (todas têm `owner_id`, semântica de fallback preservada),
  busca com `external_ids` malformados não quebra (0), entidade vazia → total 0.
  Executado com papel privilegiado do sandbox: **não valida RLS**.
- `performance-cycle-2.md` corrigido (total, bundle 303→310 KB gzip é piora, build 149,3 s amostra única).

## Parte A — linha do tempo (implementado)
- `0088_performance_cycle3_timeline_history_calendar_pages.sql` (aditiva, SECURITY INVOKER):
  - `get_timeline_history_page`: agrupa `property_history` no servidor com a mesma regra de
    `groupPropertyChanges` (mesmo autor, até 2 s do início do grupo), filtra categoria/autor/busca
    depois de agrupar e pagina por grupo `(g_at, gid)` — grupo nunca é partido. Sem o limite de 300.
  - `get_timeline_calendar_page`: mesmas regras de vínculo de `get_entity_timeline` para eventos de
    calendário, exclui eventos já espelhados por atividade do próprio registro **antes** de paginar,
    filtra período/busca. Sem o limite de 300 (que antes era dividido com atividades/e-mails).
- `src/lib/timeline/feed-merge.ts`: intercalação k-way das três origens (data DESC, origem, id DESC),
  páginas globais de 40, busca a próxima página de uma origem só quando o buffer esvazia.
- `activity-fetch.ts` reescrito (`createTimelineFeed`/`nextTimelinePage`); `email-fetch.ts`: página traz só
  resumo do e-mail; corpo/anexos/última abertura e clique em `fetchEmailDetail`, chamado por
  `lazy-email-timeline-item.tsx` quando o item se aproxima da tela, com estados carregando/erro/tentar novamente.
- `use-timeline-feed.ts`: busca com debounce enviada ao servidor; cliente não refiltra por texto;
  recarga silenciosa (realtime/foco/modal) refaz a mesma quantidade já exibida e troca de uma vez, sem voltar
  à primeira página nem estado de carregamento; respostas de contexto antigo descartadas por versão; efeitos de
  realtime usam a versão atual de `load` (antes capturavam filtros antigos); `loadingMore` sempre liberado.
- Contagens: total e por categoria = soma exata das três origens (histórico conta grupos por categoria).

## Parte A — validado
- `tests/sql/timeline-history-calendar-page.sql` (ROLLBACK): 350 grupos de 3 alterações + empates com autores
  alternados → 356 grupos, 1.050 alterações, 9 páginas, 0 duplicados, total igual ao percorrido; filtro só
  responsável; "sem autor" 8; busca em valor não carregado 1; calendário dedup (1 de 2) e busca. Papel privilegiado: não valida RLS.
- `feed-merge.test.ts` (4): ordem global com 95+330 itens sem perda/duplicação, desempate, sem busca antecipada,
  proteção contra página vazia com has_more. 13/13 testes de timeline passam.
- Playwright autenticado (dev, negócio com 600 atividades): primeira página e "Carregar mais" 42→82 itens;
  RPCs 200; página de atividades ~30 KB, histórico 0,5 KB, calendário 78 B. Primeira tela 48 s no Vite dev —
  não representa produção. A primeira página foi pedida duas vezes (filtros salvos reidratados), comportamento anterior.
- tsgo e ESLint dos arquivos alterados sem erros (avisos de tamanho preexistentes).

## Parte A — limites conhecidos
- Busca no histórico usa nome da propriedade e valores brutos; nomes resolvidos (ex.: nome da etapa quando o
  valor é id) não são encontrados pela busca do servidor — divergência documentada.
- Período de calendário agora usa `< fim` (antes `<=`), igual às atividades.
- Antes, o dedup de calendário só considerava atividades da página carregada; agora considera todas do registro.
- Realtime ainda escuta só `activities` (e respostas de pesquisa); alterações de histórico/calendário aparecem
  ao focar a aba ou reabrir, como antes.
- Teste com sessão de usuário de outro workspace/escopo próprio ainda não executado.
- Sem medição comparável antes/depois além da amostra dev acima; suíte completa e build não rodados neste turno.

## Pendente
- A: teste RLS com sessão real (escopo próprio e outro workspace); realtime de histórico/calendário.
- B: jornada de leads, atividades 14/30 dias e listas secundárias ainda com 3.000/5.000/10.000.
- C: Inbox — não iniciado (depende de A/B).
- Medições antes/depois autenticadas, suíte completa e build deste ciclo não executadas além da migração.

## Rollback
- Parte A: restaurar `activity-fetch.ts`/`use-timeline-feed.ts` anteriores; as RPCs 0087/0088 permanecem sem efeito.
Reaplicar a definição de 0086 via nova migração `CREATE OR REPLACE` (sem perda de dados).
