# Ciclo 14 — revisão, métricas e preparação da publicação

## Escopo e evidências

Todas as provas abaixo são locais, em banco sintético. Não representam produção.
Os relatórios brutos ficam em `.techerp-isolated.local/`, fora do Git, sem divulgação
 de sessões ou credenciais. Falhas intermediárias foram preservadas e corrigidas.

- Realtime: migração 0113 inclui `meetings` e `deal_line_items` na publicação.
  Eventos INSERT/UPDATE/DELETE de três tabelas (também `calendar_events`) chegam pelo SDK;
  os testes rejeitam leitura/evento de outro tenant. A matriz atual tem 76 aprovações,
  zero falhas e três placeholders visuais, conciliados separadamente com provas manuais.
- Exclusões: migração 0114 transmite apenas workspace/tabela/nonce/data, sem IDs ou conteúdo. RLS impede sinais de outro tenant e escrita por usuários; exclusão externa refletida na timeline de conta restrita sem reload.
- Contexto: reuniões e vagas assinam o workspace ativo. A troca cancela lotes antigos,
  ignora callbacks de canais anteriores, reinicia consultas e recria o estado local das
  rotas. Os hosts globais de conversas/atividades ficam fora dessa recriação.
  Teste visual: A → B removeu todos os cartões de A; B → A carregou 200 cartões
  nas duas abas sem recarregar a segunda. Associação temporária do administrador
  fictício a B removida ao final. Membros inativos não aparecem no seletor.
- Observabilidade: medidas locais por família de tela/consulta, sem IDs, valores de
  filtros ou conteúdo comercial. Consultas imperativas e React Query têm medição.
  O diagnóstico em DOM existe só em desenvolvimento; não há envio remoto.
  Build registra fases, módulos retidos, bytes e gzip da entrada. O wrapper só aprova
  depois da saída completa do processo, com tratamento de sinais.
- Integridade do gate: verificação e build usam o mesmo fingerprint de código/configurações.
  Um relatório anterior não pode aprovar uma cópia alterada. Mudança de fonte durante
  execução também impede aprovação.

## Medições de telas

Ambiente de desenvolvimento local, com 500 projetos e 500 vagas fictícias. Valores
não equivalem a um SLA de produção; compilação sob demanda, cache e outros processos
influenciam o resultado. "Rota" significa resolução do roteador, não término de todas
as consultas. Amostras pequenas: registramos valores, sem extrapolar percentis.

| Família | Rota observada | Consultas relevantes observadas | Resultado da revisão |
| --- | --- | --- | --- |
| TechProjects | 175–182,5 ms | 375,7–411,9 ms | Lista atual possui teto legado de 300. |
| TechHire | 240,4–279,3 ms | Antes: até 576,1 ms; após correção: 52–175,8 ms | Quatro consultas por entrada reduzidas a duas; cache compartilhado, busca com debounce e filtro explícito de workspace. |
| Prospecção | 74,3–189,6 ms | Fila 135,1 ms | Também medida a aba Base; sem execução de disparos externos. |
| Agentes | Primeira abertura dev 2787,1 ms; repetição 222,7 ms | Supervisão 823,8 ms; repetição 481,2 ms | O custo frio deve ser separado do atendimento/filas. |
| Detalhes | 215–216 ms | 24,7–281,3 ms | Ficha real de fixture isolada, sem dados de clientes. |

Prioridade de evolução além deste ciclo: paginação com cursor, contagem exata e
filtros globais nas listagens legadas de Projetos (300) e Vagas (200); ampliar as
amostras no ambiente compartilhado. Essas limitações preexistentes foram identificadas,
 não apresentadas como ganho de performance nem removidas com uma consulta ilimitada.

## Listas extensas

Foi medido o componente real `HistoryTimelineItem`, renderizado em 1500 cartões.
No benchmark de layout com 25 amostras: p50 32,8 → 2 ms, p95 34,5 → 2,5 ms.
CSS `content-visibility` só se aplica à timeline com pelo menos 200 entradas e
sem edição ativa. Todos os cartões continuam montados; foco e conteúdo preservados.
A navegação ao item 1000 foi validada. O ganho é de layout/pintura, não de montagem
React, memória total ou carregamento do banco. Navegadores sem suporte conservam o
comportamento anterior. CSS de benchmark simplificado; não extrapolar para toda a aplicação.

## Carga e proteção

Sete cenários aprovados, sem chamar provedores externos:

1. Vinte tentativas simultâneas de lease de campanha: um vencedor.
2. Doze workers concorrentes: dez conversas/trabalhos únicos; vinte trabalhos ainda em fila.
3. Limite de três follow-ups: três reservas aceitas e sete recusadas.
4. Chave de idempotência duplicada rejeitada pelo banco.
5. Lease expirado recuperado; token anterior impedido de concluir a execução.
6. Limite de tentativas respeitado.
7. Sessenta e quatro leituras autenticadas concorrentes sem vazamento de tenant:
   p50 149,8 ms, p95 179,1 ms, máximo 183,1 ms na repetição revisada.

Fixtures temporárias da carga removidas. Esses resultados não provam a capacidade
 de provedores externos ou de um ambiente com hardware distinto.

## Orçamentos e regressões

- Verificação e build completos: até 240 s cada.
- Nitro: até 120 s (inclui folga sobre o baseline remoto, não só o local).
- Entrada cliente: até 280 KB gzip.
- Resolução de rota aquecida: referência de 3 s; aviso local em desenvolvimento.
- Leitura local concorrente: p95 até 500 ms, exigido pelo teste de carga.

CI executa `verify`, `build` e `perf:check`, preservando relatórios mesmo quando falha.
E2E autenticado no CI é opt-in (`E2E_ENABLED=true`), exige conta e URL explícitas
 de homologação; um job desabilitado não é prova de execução. A validação autenticada
 deste ciclo foi realizada no ambiente isolado e no navegador.

Sem relatório íntegro, fases completas, finalização e fingerprint correspondente,
 a aprovação falha. O artefato inclui `build-info.json`, sem dados de clientes ou ambiente,
 para conferir a versão servida após publicação/rollback. Os placeholders de interface no harness não viram aprovação automática.

## Nitro — alternativas e critério

As alternativas anteriores sem ganho foram descartadas. Empacotar todas as dependências
SSR exigiu externalizar o módulo nativo `cloudflare:workers`, passou no build, mas piorou
Nitro para 71,5 s. Uma opção de `manualChunks` foi ignorada pela precedência interna do
plugin; suas diferenças de tempo não são atribuídas a otimização.

A alteração efetiva é o hook `rollup:before`, que remove o agrupamento manual por pacote
após a configuração do Nitro. Mantém divisão dinâmica e análise de efeitos colaterais.
Baseline original: Nitro 64,8 s / 5789 módulos retidos. Repetição: 53,9 s.
Alteração efetiva: 32,6 s / 3106 módulos retidos; build completo 101,1 s.
Repetição com as correções de tela e outra stack em reconstrução: Nitro 48,4 s,
3107 módulos retidos; build finalizado em 122,5 s, entrada cliente 247211 bytes gzip.
Os números variam com carga/cache, mas a redução do grafo emitido é verificável.

O artefato Cloudflare foi executado no workerd local, usando os módulos emitidos, assets
 e bindings do banco isolado. A detecção de versão foi corrigida para reconhecer os
 nomes reais `arquivo-HASH.js` do Vite (antes reconhecia apenas `arquivo.HASH.js`). Login SSR e navegação autenticada foram testados; endpoint
ATS sem autenticação recusado com 401. Publicação e rollback ainda precisam do aceite
 descrito no relatório de lançamento; não inferir implantação destes testes locais.
