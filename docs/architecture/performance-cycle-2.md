# Performance — ciclo 2 (09/10/2026)

## Escopo e ambiente

Commit de referência `4778fdc88a54f2476e34ebb260a7b48ef9056484`, Bun 1.3.3, Node 22.22.0,
Vite 7.3.1, sandbox de desenvolvimento. Não houve publicação, carga de produção nem envio de
mensagens. As migrações 0083–0086 são aditivas e foram aplicadas no banco compartilhado, mantendo
o cliente antigo compatível.

## Entregue

### Timeline

- `0083_performance_cycle2_timeline_indexes.sql`: índices parciais por entidade e data efetiva
  `COALESCE(hs_createdate, created_at), id`, além do histórico por entidade/data/id.
- `0084_performance_cycle2_timeline_page.sql` e correção aditiva `0086`: RPC `SECURITY INVOKER`
  com RLS, filtros de período/tipo/responsável/busca antes da paginação, cursor estável, página de
  40, contagens por categoria; **o total estava errado (contava categorias, não atividades) — corrigido no ciclo 3 pela 0087**, projeção reduzida e exclusão lógica.
- `activity-fetch.ts`, `use-timeline-feed.ts`, `timeline-page.ts`: consumo paginado, descarte de
  respostas de contexto antigo, merge sem duplicação, busca de e-mail no servidor e botão
  “Carregar mais”. E-mails são enriquecidos apenas para os IDs da página.

Amostra read-only no mesmo banco: a consulta de um negócio que antes examinou 600 linhas e levou
262,8 ms passou, com o predicado compatível com o índice final, a examinar 51 linhas em 1,12 ms.
Uma segunda amostra após 0086 usou `activities_related_deal_effective_date_idx` e levou 0,106 ms
para duas linhas. São amostras pontuais, não p50/p95.

### Dashboard

- `0085_performance_cycle2_dashboard_aggregates.sql`: agregação invoker/RLS para KPIs exatos de
  negócios e funil por estágio, sem o teto anterior de 3.000 registros; índices parciais orientados
  por essa consulta.
- `sales-dashboard-aggregates.ts` e `sales-dashboard.server.ts`: os KPIs principais agora usam o
  agregado SQL e preservam período atual/anterior, mês, pipeline, responsável e probabilidades.
  O parser aceita contagens acima do limite antigo sem truncar.

## Build e verificação

| Verificação                  | Resultado                                                     |
| ---------------------------- | ------------------------------------------------------------- |
| `tsgo --noEmit` quente       | 0,81 s, pico 717 MB, passou                                   |
| ESLint direcionado com cache | 0,90 s, pico 363 MB, 0 erros/6 avisos existentes              |
| Testes direcionados          | 18/18 passaram                                                |
| Suíte completa               | 649/650; mesma falha preexistente em `hardcode-guard.test.ts` |
| Build completo               | passou em 149,3 s, pico 7,50 GB                               |
| Fases do build               | cliente 47,27 s; SSR 43,76 s; Nitro/Worker 53,73 s            |
| Entrada cliente              | 1.046,97 KB brutos; 310.083 bytes gzip                        |

O build medido ficou abaixo da faixa anterior de 212–256 s e o Worker abaixo de 86–94 s, mas uma
execução não prova ganho causal ou estabilidade. Nenhuma configuração Nitro foi alterada: a fase
ainda retransforma 5.757 módulos. A entrada cresceu de aproximadamente 303 KB para 310 KB gzip (piora, não estabilidade);
não houve ganho de bundle. O build de 149,3 s é amostra única sem mudança Nitro; não é ganho causal. O comando real da verificação automática da plataforma continua
inacessível.

## Parcial e limitações honestas

- O feed unificado ainda não pagina `property_history` e eventos virtuais de calendário junto com
  atividades. Histórico mantém o limite legado de 300 e calendário o limite de 300 da RPC; logo,
  contagens globais e continuação multi-origem ainda não satisfazem todo o aceite.
- A busca servidor alcança atividades e conteúdo de e-mail, mas ainda não todo o histórico. Corpo,
  anexos e tracking de e-mail são carregados por página, não estritamente ao expandir o item.
- O cursor é validado por timestamp/UUID e produzido pelo servidor, mas não é token assinado preso
  aos filtros. Alterar filtros reinicia a página e invalida respostas antigas.
- Realtime recarrega a primeira página com debounce e reconcilia ao voltar à aba; ainda não preserva
  páginas extras e posição de scroll após uma mutação.
- Dashboard: KPIs/funil deixaram de depender do limite de 3.000. Listas secundárias
  (`advancedDeals`, atenção), jornada de leads e atividades de 14/30 dias ainda usam limites de
  3.000/10.000/5.000 e permanecem no ciclo seguinte. Falha do agregado principal não é exibida como
  zero: ela gera indisponibilidade.
- Sem telemetria de produção ou benchmark autenticado repetível, não há p50/p95, bytes por tela nem
  tempo até conteúdo principal antes/depois. Sprint 0 continua parcial.
- O linter do banco encontrou 204 avisos preexistentes em quatro classes. As duas funções novas são
  `SECURITY INVOKER`, com `search_path=public`; não adicionaram função definer.

## Rollback

1. Reverter o app para os fetches anteriores; as funções e índices aditivos podem permanecer sem
   afetar clientes antigos.
2. Se necessário em janela administrativa, remover somente os índices 0083/0085 e revogar/remover
   as duas RPCs após todos os clientes deixarem de usá-las. Não há rollback de dados.
3. Para regressão de UX, ocultar “Carregar mais” e voltar ao carregamento legado enquanto a RPC
   permanece disponível.

## Próximo ciclo dependente

1. Criar feed SQL unificado de atividades, grupos indivisíveis de histórico e calendário, com cursor
   por origem e contagens completas; mover detalhe de e-mail para endpoint sob demanda.
2. Substituir os limites secundários do dashboard por agregados/listas top-N separadas e jornada de
   leads exata, com fixtures acima de 10 mil e testes own/team/workspace/tenant.
3. Medir telas autenticadas com um roteiro estável e observabilidade de produção.
4. Investigar Nitro isoladamente; não alterar `noExternals` sem teste de SSR, server functions e
   Cloudflare.
