# CAMPANHA-LIGACOES — Campanhas de Ligação com menu próprio

Porte: **M/G** · Estimativa: **6 a 8 horas** (prévia visual 1h + implementação 4–5h + Ajuda, permissões e testes 1–2h).
Dependências: aprovação da prévia visual (regra do projeto para redesign relevante).

## Objetivo
Tirar a campanha de ligações por voz de dentro da Prospecção e dar a ela um lugar próprio em **TechSales › Captar › Campanhas de Ligação**, ao lado de Campanhas Email e Campanhas WhatsApp, com uma tela que siga a ordem natural de montar uma campanha.

## O que sai da Prospecção e vai para o novo menu
| Hoje (dentro de Prospecção) | Depois |
|---|---|
| Cartão "Ligações por voz" na área Campanhas | Removido; vira item de menu próprio |
| Lista de campanhas de voz (`/prospecting/campaigns`) | `/campaigns/calls` |
| Ficha da campanha (`/prospecting/campaigns/:id`) | `/campaigns/calls/:id` |
| Roteiros de ligação (seção "roteiros") | Aba **Roteiros** dentro de Campanhas de Ligação |
| Atalho para Configurações › Agente de voz | Aviso de pré-requisito na própria tela |

Ficam na Prospecção: fila de trabalho e discador manual (`queues/play`), nutrição, qualificação, cadências, sequências (que podem ter etapa de ligação), questionários, playbooks, públicos e resultados. Os links antigos continuam abrindo e redirecionam para o novo endereço.

## Nova jornada da tela (avaliação UX/UI)
Hoje a ficha mistura tudo num único cartão "Configuração", com Iniciar/Pausar no topo antes de ter roteiro ou público, e as métricas embaixo. Proposta:

```text
Lista: [Cabeçalho + "Nova campanha"] [Filtros: situação, busca] [Tabela: nome, situação, público, ligações, atendidas, próxima janela]
       Vazio: "Crie sua primeira campanha de ligação" + checklist de pré-requisitos

Ficha (passos numerados, como contratos):
 1 Público       -> estático/dinâmico, filtros, contagem prevista
 2 Roteiros      -> variantes A/B, pesos (soma 100%), atalho "Criar roteiro"
 3 Agenda        -> janela, dias, tentativas, intervalo
 4 Pós-ligação   -> WhatsApp de retorno (regra das 24 h mantida)
 5 Revisar e iniciar -> resumo + checklist (agente de voz, número, roteiro, público)
Barra fixa: Salvar rascunho | Iniciar (só com checklist ok) | Pausar/Retomar
Aba Resultados (após iniciar): métricas por variante + histórico de tentativas
```
- Ação primária única por estado (Rascunho: Iniciar; Em execução: Pausar; Pausada: Retomar).
- Iniciar bloqueado com motivo claro quando faltar requisito.
- Componentes oficiais: PageHeader, SectionHeader, FilterBar, MetricCard, StatusBadge, EmptyState, Skeletons, FormSection; loading/vazio/erro, foco, rótulos e dark mode.

## Permissões
- Reutiliza `techsales.marketing.campaigns` (a mesma da tela atual) para lista, ficha, iniciar/pausar; roteiros mantêm `techsales.prospecting_scripts`.
- Menu, URL direta e servidor continuam negando sem a chave; nenhuma chave nova concedida a cargos.
- Contratos de permissão atualizados com os 5 cenários (permitido, sem chave, negado, outro workspace, inativo).

## Ajuda
Novo artigo "Campanhas de Ligação" (criar, passos, iniciar, resultados) e ajuste do artigo da Prospecção removendo a parte de voz; cobertura `help:coverage`.

## Fora do escopo
Nenhuma mudança no banco, nas regras de discagem, na integração de voz ou nas sequências.

## Detalhes técnicos
- Novas rotas `_authenticated/campaigns.calls.index.tsx`, `campaigns.calls.$id.tsx`, `campaigns.calls.scripts.tsx`; antigas viram `redirect` preservando `id`.
- `menu-config.ts`: item "Campanhas de Ligação" (ícone PhoneCall) após WhatsApp; `sales-route-map.ts` mapeia `/campaigns/calls`.
- `areas.ts`: remove "roteiros" de `campanhas` e mapeia `?tab=scripts`/`section=roteiros` para a nova rota; `campaigns-hub.tsx` sem o cartão de voz; testes de `areas` atualizados.
- Ficha refatorada em componentes de passo reaproveitando a lógica/consultas atuais (sem alterar server functions).
- Validação: permissions:check, verify, build, help:coverage e Playwright na lista, ficha e redirecionamentos.
