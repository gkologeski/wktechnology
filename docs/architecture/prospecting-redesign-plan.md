# Reorganização da Prospecção (TechSales) — plano e mapa de reaproveitamento

Status: **fase 1 implementada na rota produtiva** (aprovação do usuário em 2026-10-12).
`/prospecting` usa `?area=` (visao, trabalho, campanhas, publicos, resultados) e
`?section=`; `?tab=` antigo é convertido por `src/lib/prospecting/areas.ts`.
Indicadores reais em `src/lib/prospecting/overview.server.ts` com cobertura
explícita (sem permissão/erro nunca vira zero). Voz em `/settings/voice-agent`.
Nutrição paginada no servidor (50/página). Sem tabelas novas.
Pendente: paginação da Base (mantém aviso de 1.000), Apollo além da 1ª página,
importação em lotes idempotente, serviço do catálogo na campanha, biblioteca única.

## 1. Áreas aprovadas

| Área         | Conteúdo                                                        |
| ------------ | --------------------------------------------------------------- |
| Visão geral  | pendências, respostas, qualificados, reuniões, falhas de envio  |
| Meu trabalho | filas, próxima ação, responsável, nutrição                      |
| Campanhas    | público, serviço, agente, modelo inicial, cadência, responsável, resultados |
| Públicos     | base interna, importações, busca Apollo, listas salvas          |
| Resultados   | por campanha/serviço/canal/agente, consumo, motivos de perda    |

Fluxo exibido: público/serviço → agente/modelo → qualificar/CRM → material → agenda/passagem para humano.

## 2. Fronteiras

- Configuração completa de agentes: `/agents/sdr` (destino canônico existente). Prospecção só seleciona e supervisiona. O agente deve ser reutilizável para receptivo, técnico e vendas.
- Voz: Agentes/Integrações (hoje `voice-agent-page.tsx` na aba `voice`).
- Agente controla a conversa; campanha controla abordagem e limites.
- Conversa sempre vinculada a pessoa/empresa/negócio; passagem humana leva histórico, pontuação e material.
- Pontuação junto à qualificação e visível nas fichas (`lead-score-badge.tsx`).
- Biblioteca única de roteiros (scripts, playbooks, questionários comerciais) sem apagar pesquisas gerais (`surveys`).
- Serviços: catálogo (`service_catalog.active`) é a fonte. Conferido na WK (leitura): ativos = Alocação de Squad, Consultoria Técnica, Engenharia de IA & Governança, Fábrica de Software, Hunting de TI, Outsourcing de TI; BPO Administrativo/Financeiro já inativo; "WK sob medida" não existe no catálogo. Nada foi alterado; históricos preservados.

## 3. Mapa de reaproveitamento (estado atual inspecionado)

| Hoje (aba `?tab=`)              | Componente / servidor                                        | Destino |
| ------------------------------- | ------------------------------------------------------------ | ------- |
| `fila`                          | `queue-tab.tsx`, `queues.functions.ts` (`prospecting_queues`, `prospecting_enrollments`) | Meu trabalho |
| `nutricao`                      | `nurturing-tab.tsx`                                          | Meu trabalho |
| `base`                          | `base-tab.tsx`, `create-queue-from-base-dialog.tsx`          | Públicos |
| `prospecting` (Apollo)          | `pages/prospecting-page.tsx`, `prospecting.functions.ts`, `prospect-search-form-dialog.tsx`, `list-builder.tsx` | Públicos |
| `cadencias`                     | `cadences-tab.tsx`, `cadences.functions.ts`                  | Campanhas |
| campanhas (`/prospecting/campaigns`) | `prospecting-campaigns.functions.ts` (`prospecting_campaigns`, `prospecting_campaign_variants`, `prospecting_call_attempts`) | Campanhas / Resultados |
| `questionarios`, `scripts`, `playbooks` | `questionnaires-tab.tsx`, `pages/scripts-page.tsx`, `pages/playbooks-page.tsx`, `prospecting_scripts`, `prospecting_questions`, `sdr_playbooks` | Biblioteca de roteiros |
| `scoring`                       | `pages/scoring-page.tsx`, `lead-score.ts`, `icp-criteria-section.tsx` | Qualificação + fichas |
| `enrichment`                    | `pages/enrichment-history-page.tsx`, `enrichment-sources-card.tsx` | Contextual nas fichas/Públicos |
| `voice`                         | `pages/voice-agent-page.tsx`, `voice_agent_settings`         | Agentes/Integrações |
| `sdr`                           | `sdr-console.tsx`, `sdr-agent-studio.tsx`, `sdr.functions.ts` (`sdr_*`, `whatsapp_*`) | Supervisão em Campanhas; configuração em `/agents/sdr` |

Permissões existentes reaproveitadas: `techsales.prospecting.*` (`permission-keys.ts`) e `techsales.marketing.sdr_agent.*` (`sdr/access.server.ts`). Nenhuma chave nova é necessária para o protótipo.

## 4. Compatibilidade de URLs

- `/prospecting?tab=<antigo>` continua aceito; após o aceite, cada valor redireciona para a área nova (ex.: `fila`→Meu trabalho, `base`/`prospecting`→Públicos, `voice`/`sdr`→`/agents/sdr`).
- `/prospecting/campaigns`, `/prospecting/campaigns/$id` e `/prospecting/queues/$queueId/play` permanecem.
- `/settings/prospecting` e `/settings/prospecting-scripts` permanecem até a biblioteca unificada existir.

## 5. Fases após o aceite (nenhuma iniciada)

1. Shell com cinco áreas carregadas sob demanda, compatibilidade de `?tab=`.
2. Paginação no servidor: Base (hoje limite 1.000), Nutrição (200), Apollo (primeira página 50).
3. Importação em lotes com idempotência.
4. Métricas com cobertura explícita — sem números inventados; indicador sem dado mostra "sem cobertura".
5. Campanha ligada a serviço do catálogo, agente, modelo inicial e cadência; tabelas novas só depois de confirmar que `prospecting_campaigns` + `sdr_*` não cobrem (migração aditiva, testada no ambiente isolado antes do banco compartilhado).
6. Biblioteca de roteiros unificada.

Restrições em todas as fases: sem disparos reais, sem ativar campanhas, sem publicar sem aceite.
