# Performance — ciclo 3 (09/10/2026) — A e B implementadas; validação de papéis não-admin e C (Inbox) pendentes

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

## Pendente (atualizado)
- A/B: validar RLS com perfis não-admin (próprio/equipe) e outro tenant com dados.
- A: conferir visualmente pins e selos de e-mail; agenda em tempo real fora de contatos.
- C: Inbox — não iniciada (depende da validação acima).
- Medições comparáveis antes/depois e em produção.

## Rollback
- Parte A: restaurar `activity-fetch.ts`/`use-timeline-feed.ts` anteriores; as RPCs 0087/0088 permanecem sem efeito.
Reaplicar a definição de 0086 via nova migração `CREATE OR REPLACE` (sem perda de dados).

## Parte B — Dashboard sem tetos (implementado)

- `0090`: `get_sales_dashboard_secondary` (invoker) — atenção, contatos/dia, jornada agrupada; sem
  os tetos 3.000/5.000/10.000/500. **DEPRECATED** pela v2, mantida para clientes antigos.
- `0091` + `0092`: `sales_dashboard_hot_score` (mesma fórmula de `computeHotScore`, termo de
  engajamento = 0 como no painel; 0092 corrigiu paridade de ponto flutuante — `extract(epoch)`
  devolve numeric) e `get_sales_dashboard_secondary_v2`: ranking dos avançados **no banco** sobre
  todos os candidatos, ordem `score desc, valor desc, id`, devolve só o top 8 + `advanced_total`
  exato. Atenção (8 por risco) já exclui o top 8 avançado no banco.
- Leads a trabalhar: `count: exact` + amostra de 5.
- Mudança de semântica: negócio com etapa inexistente no pipeline não entra nas listas (igual aos
  KPIs de 0085). Score agora vem do banco; JS só recalcula se a resposta não trouxer o campo.

### Parte B — validado
- Referência independente: fixture de 12.000 candidatos gerada por `generate_series` (nenhuma
  gravação em tabela, nenhum gatilho): soma dos scores, soma ponderada por índice e top 8 com
  empates idênticos entre banco e `computeHotScore` (`sales-dashboard-secondary.test.ts`). A
  primeira versão divergiu em 1 ponto e foi corrigida pela 0092 — o teste pegou.
- Sessão real authenticated (conta admin do solicitante, via PostgREST): jornada 5.913 leads e
  contatos 129 = contagens diretas; modo "um responsável" (membro) 4 leads = direto; workspace
  sem vínculo devolve tudo zerado/vazio.
- Navegador (dev): painel mostra "Fase avançada" com scores do banco; 7,2 s / 7,0 s até o bloco
  visível em duas cargas. **Sem baseline anterior comparável**; não é medida de produção.

## Parte A — complementos desta entrega
- Dupla carga inicial: o feed só consulta depois de reidratar os filtros salvos (1 chamada de
  `get_timeline_activity_page` na abertura, antes 2).
- Realtime: `0093` adiciona só `property_history` à publicação; a ficha assina
  `entity_id=eq.<ficha>`; `calendar_events` filtrado por `related_contact_id` apenas em
  contatos (demais fichas reconciliam ao focar/voltar à aba). Coalescido em 250 ms, recarga
  silenciosa preserva páginas e rascunhos.
- `0094`: busca do histórico também casa rótulos resolvidos (etapa por ID → label do pipeline,
  funil → nome, responsável → nome), sob a RLS de quem consulta. Ex.: "Perdido" 0 → 1 grupo.
- Cartões após a regressão da projeção (navegador, dev): 7 players de gravação, duração
  ("0m 9s"), "Abrir gravação", criador e status/prioridade de tarefa visíveis. **Não conferidos
  visualmente**: pins (nenhum registro fixado nos dados) e selos de direção/status de e-mail.
- E-mail detalhado continua carregando **por proximidade na viewport**, não só ao clicar.
- Observação: com as colunas laterais alargadas, a coluna central fica estreita em 1280 px.

## Permissões — cobertura real
- Validado com sessão authenticated real: conta admin (escopo workspace), filtro por
  responsável, workspace alheio e entidade inexistente (timeline 0).
- **Não validado**: perfis com escopo próprio/equipe sem admin e outro tenant com dados (existe
  um único workspace com negócios). `SET ROLE authenticated` é negado à ferramenta de leitura;
  emitir sessão de outro usuário exige aprovação do usuário. Até lá, Inbox (parte C) não começa.

## Gates desta entrega (commit base 2df94a8)
| Verificação | Resultado |
| --- | --- |
| `tsgo --noEmit` | exit 0 |
| ESLint nos arquivos alterados | exit 0, 0 erros, 5 avisos (tamanho de arquivo, diretivas) |
| Suíte completa | exit 1 antes: 670/671, falha preexistente `hardcode-guard` (domínio fixo em `role-profile-approval.tsx`); corrigida — teste isolado 7/7 |
| Build | exit 0, 259 s (cliente 93 s, SSR 69 s, Nitro 89 s); entrada 1.046,97 KB / 310.103 B gzip (inalterada) |
| Verificação automática da plataforma | segue em timeout de 240 s; `tsgo` local termina em segundos. Comando real inacessível — hipótese (não comprovada): roda `tsc` sem cache incremental. |

## Rollback
- App: reverter `sales-dashboard.server.ts` para `get_sales_dashboard_secondary` (0090) — não
  voltar às consultas com `.limit(3000/10000)`, que truncavam. 0091–0094 são aditivas.
- Realtime: `ALTER PUBLICATION supabase_realtime DROP TABLE public.property_history` em janela
  administrativa, se houver custo; a timeline continua reconciliando ao focar.
