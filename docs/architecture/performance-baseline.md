# Baseline de performance — ciclo 1 (08/10/2026)

Ambiente: sandbox de desenvolvimento (16 CPUs, 32 GB), commit `09618a5d3`, Node 22.22.0, Bun 1.3.3,
Vite 7.3.1. Execuções sequenciais, sem builds concorrentes; o servidor de desenvolvimento seguia
ligado (fonte de ruído). Pico de memória = `ru_maxrss` dos processos filhos (`/tmp/perf/m.py`).
**Não são números de produção.**

## Verificação e build (antes das mudanças)

| Comando | Duração | Pico RAM | Observação |
| --- | --- | --- | --- |
| `tsgo --noEmit` (cache `.tscache` quente) | 1,0 s | 714 MB | usa o cache incremental do tsconfig |
| `tsgo --noEmit --incremental false` (frio real) | 37,1 s | 5,4 GB | 1ª execução da sessão: 54 s |
| `eslint .` sem cache | 60,2 s | 1,2 GB | exit 1: **503 erros pré-existentes** (quase todos prettier) |
| `eslint --cache` frio / quente | 54,7 s / 2,8 s | 1,2 GB | ganho medido → adotado no script `lint` |
| `vitest run` | 9,3 s | — | 631/632; falha pré-existente em `hardcode-guard.test.ts` |
| `vite build` total | 211,8 s | 7,3 GB | cliente 59 s · SSR 60 s · nitro/worker 86 s (5.742 módulos) |
| `vite build` depois das mudanças | 256,5 s | 7,3 GB | cliente 75 s · SSR 78 s · nitro 94 s — variação de ruído, não regressão comprovada |

Conclusões medidas:
- O build sozinho fica entre 212 e 256 s. Isso basta para estourar uma verificação de 240 s. O
  comando exato da verificação da plataforma **não está acessível** no sandbox. Não está provado
  qual etapa estoura: pode ser o build, a verificação de tipos (tsc ou tsgo frio) ou a soma das duas.
- O ambiente nitro/worker transforma de novo cerca de 5.700 módulos: é a fase mais longa (86–94 s).

## Pacotes do cliente (build de produção)

- Arquivo de entrada `index-*.js`: 1.022 KB brutos, cerca de 303 KB gzip (igual antes e depois).
- Maiores arquivos sob demanda: pdf.worker 2,3 MB, chart-kit 496 KB, mammoth 488 KB, pdf 475 KB,
  word-editor 462 KB, xlsx 419 KB.
- Layout autenticado `_authenticated-*.js` depois das mudanças: 95 KB, ou 28,9 KB gzip. O valor
  de antes não ficou registrado.
- Janelas de atividade separadas sob demanda: 7 arquivos, 27 KB gzip no total.

## Telas (servidor de desenvolvimento, sessão real, somente leitura)

| Tela | Até a rede ficar ociosa | Requisições | Funções do servidor | Consultas diretas ao banco |
| --- | --- | --- | --- | --- |
| Detalhe do negócio | 27–45 s | ~1.510 | 25 | 72 |

As requisições incluem os módulos do Vite em modo desenvolvimento, então **não representam
produção**. Dashboard, Inbox/WhatsApp, Projetos, Prospecção/Agentes e TechHire: **não medidos**
neste ciclo.

## Banco (somente leitura)

- Publicação de tempo real: activities, deals, leads, contacts, companies, tickets, chats,
  whatsapp_*, notifications, ats_jobs/candidates, calendar_events, entre outras.
  **`deal_line_items` e `meetings` não fazem parte dela**, então as assinaturas dessas tabelas
  nunca disparam.
- `REPLICA IDENTITY default` na maioria das tabelas: um DELETE só traz o `id`.
- O `pg_stat_statements` acessível mostrou apenas backfills. Não há diagnóstico de consultas
  interativas.

## Métricas não obtidas

p50/p95 de produção, tempo até o conteúdo principal em produção, CPU e RAM da verificação da
plataforma, consultas interativas lentas e carga multiworkspace.
