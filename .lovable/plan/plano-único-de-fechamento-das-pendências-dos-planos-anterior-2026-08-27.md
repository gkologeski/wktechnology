# Plano único de fechamento das pendências dos planos anteriores

Foram auditados os 177 planos arquivados em `.lovable/plan/` mais os documentos
`docs/backlog-pendencias.md` e `docs/plan-templates.md`. A grande maioria já está
implementada. O que segue reúne, num único plano, apenas o que a verificação em
código e no banco mostrou **em aberto**.

## O que a auditoria confirmou como já entregue

- Prospecção/Apollo, qualificação de leads, scoring unificado, duplicidade de leads.
- Contratos: importação por IA, aditivos, aninhamento prestação x compra, títulos padronizados, agrupamentos, presets de contratação.
- RBAC granular: matriz de permissões, fim do gate legado de ferramentas, visibilidade por permissão, `workspace_id` como fonte única de isolamento.
- Grids e Kanban: colunas dinâmicas, edição em massa (tabela e quadro), movimentação em massa no Kanban de Negócios.
- White-label, arquivos, workflows (drag-and-drop, tokens, condições agrupadas), API pública v1, documentação para agentes.
- Fases 0 e 1 da redução do tempo de implementação (typecheck ~22-31s, lint limpo, build ~2m).
- Booking: link do Meet, erros visíveis, aviso de calendário não vinculado. A página `reuniao-30min` já está com conta de calendário vinculada.

## Pendências verificadas agora

| # | Pendência | Evidência |
| - | --------- | --------- |
| 1 | Conta Azul nunca conectou de fato | `contaazul_sync_state` com 0 linhas; OAuth falha na tela do provedor, antes do callback |
| 2 | Agendamento público sem validação real | nenhuma reserva com `meet_link` gravado até agora |
| 3 | Fase 2 (modularização) incompleta | `hubspot-steps.server.ts` com 1.358 linhas; 3 arquivos ainda importam `recharts`/`@tiptap` estaticamente |
| 4 | Fase 3 (dados e permissões) incompleta | apenas 1 teste E2E de visibilidade; `deleteRowGuarded` em 9 arquivos contra 134 com `.delete()` |
| 5 | Observabilidade/templates/escala de workflows | fases 6 a 8 nunca iniciadas |
| 6 | Backlog congelado | R-01 Stripe payment link, R-02 Outlook/Microsoft Calendar, 36 itens de paridade HubSpot |

## Fase A — Fechar Conta Azul (bloqueio externo primeiro)

1. Consolidar o painel de diagnóstico numa única leitura: endpoint de autorização, `client_id`, callback efetivo, escopos e situação da última tentativa, com texto explícito de que a validação final depende do app cadastrado no provedor.
2. Confirmar em conjunto: callback cadastrado igual a `https://app.wktechnology.com.br/api/public/oauth/contaazul-callback`, app de produção, e `CONTAAZUL_CLIENT_ID`/`SECRET` do mesmo app da API v2.
3. Somente após a primeira conexão bem-sucedida: rodar uma sincronização real e validar contadores por workspace no painel e no histórico do cron.
4. Se o provedor continuar negando antes do callback, o plano registra a limitação como dependência externa em vez de seguir alterando código.

## Fase B — Validar o agendamento público ponta a ponta

1. Fazer uma reserva real em `/book/reuniao-30min` e confirmar: evento no Google Agenda, `meet_link` gravado, link exibido ao convidado, lead/contato criados.
2. Corrigir apenas o que essa execução apontar (escopo de token, criação de lead, mensagem de erro).
3. Entregar o e-mail transacional de confirmação com link do Meet e anexo `.ics` (item já apontado como próximo passo).

## Fase C — Concluir a Fase 2 (tempo de build e edição)

1. Quebrar `hubspot-steps.server.ts` em módulos por grupo de passos, mantendo o arquivo como dispatcher fino.
2. Converter os usos restantes de `recharts` e `@tiptap` para import dinâmico.
3. Nas 20 rotas mais pesadas, passar a chamar server functions via `useServerFn` dentro dos handlers, reduzindo imports estáticos de `*.functions.ts`.
4. Medir build e typecheck antes e depois; sem mudança de comportamento.

## Fase D — Concluir a Fase 3 (dados, exclusão e permissões)

1. Inventário SQL das tabelas de `public` sem `GRANT` ou com RLS incompleta; migration única e aditiva corrigindo o que faltar.
2. Varredura das exclusões: substituir `.delete()` direto por `deleteRowGuarded` nos fluxos de usuário, para que exclusão negada por RLS deixe de parecer sucesso.
3. Testes E2E de visibilidade por papel (admin, gestor, membro) cobrindo Leads, Contatos, Negócios, Contratos e People.

## Fase E — Observabilidade e escala dos workflows (fases 6 a 8)

1. Painel de execuções: fila, tentativas, falhas por passo e reprocessamento manual.
2. Biblioteca de modelos de workflow prontos por módulo.
3. Ajustes de escala: lotes, limite de concorrência e proteção contra laço infinito.

## Fase F — Reabrir o backlog congelado (decisão, não implementação)

Triagem de R-01 (payment link Stripe), R-02 (Outlook/Microsoft Calendar, depende de secrets) e dos 36 itens de paridade HubSpot, marcando cada um como entra / backlog / descartado. Nada é implementado nesta fase sem aprovação item a item.

## Fora de escopo

Redesign de telas já entregues, remoção de funcionalidades, mudança de regra de
negócio ou de autenticação, e novas features amplas antes do fim da Fase D.

## Validação de cada fase

`bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, linter de
banco quando houver migration, e smoke manual nas telas tocadas. Nenhuma fase é
declarada concluída sem a saída dos comandos.

## Ordem sugerida

A → B → C → D → E → F. A e B são curtas e destravam integrações já pagas; C e D
reduzem risco e tempo de entrega; E e F são evolução.
