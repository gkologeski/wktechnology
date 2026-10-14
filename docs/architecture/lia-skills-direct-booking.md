# Lia — habilidades, ferramentas e agendamento direto

## Referências oficiais consultadas

- respond.io — AI Skills (CRM, tags, ciclo de vida, handoff, workflow): https://respond.io/help/ai-skills/using-ai-skills
- Anthropic — como o uso de ferramentas funciona (schema + execução real no cliente): https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works
- Google Calendar — freeBusy.query, criação de eventos e events.delete:
  https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query ·
  https://developers.google.com/workspace/calendar/api/guides/create-events ·
  https://developers.google.com/workspace/calendar/api/v3/reference/events/delete
- Microsoft Graph — calendar.getSchedule: https://learn.microsoft.com/en-us/graph/api/calendar-getschedule?view=graph-rest-1.0

## Arquitetura

- Catálogo: `src/lib/prospecting/sdr/tools/catalog.ts` (habilidade → ferramentas; schema JSON para a IA + zod no servidor; efeito; confirmação; requisitos de prontidão).
- Executor único: `tools/dispatcher.ts` (`executeTool`). Workspace, agente, conversa, anfitrião e usuário vêm do servidor; a IA só envia argumentos de negócio.
- Runtime: `agent.server.ts › callSdrAgent` faz o laço de chamadas de ferramenta (até 8 passos) antes da resposta final estruturada.
- Configuração versionada: `sdr_agent_versions.tool_config` (ferramentas ligadas, anfitrião/agenda, etiquetas). O worker lê só a versão publicada.
- Produção: `tools/store.server.ts` (banco + Google Agenda real). Testes e sandbox: `tools/memory.ts` (memória + agenda falsa, saída `simulated: true`).
- Banco (aditivo): `sdr_tool_calls` (registro e idempotência por execução+chamada), `sdr_slot_offers` (opções vigentes, recusadas e escolhidas por conversa), `sdr_meetings` (reuniões do agente), `sdr_reserve_meeting` (trava por agenda com `pg_advisory_xact_lock`, recusa sobreposição com buffers, idempotente; só service_role), `sdr_enrollments.tags`.

## Capacidade existente × nova

| Capacidade                                  | Antes                                                     | Agora                                                                                                              | Prontidão                                                                                  |
| ------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Agenda                                      | Link `/book/` anexado pelo `composeOutgoing`              | Removido da Lia; consulta freeBusy real, 3 opções diversas, reserva com trava, evento Google com id determinístico | Pronta com a agenda Google do anfitrião; Microsoft não suportado (nenhuma conta conectada) |
| Remarcar/cancelar/consultar                 | Não havia                                                 | `calendar.reschedule/cancel/lookup` só da própria conversa, com confirmação                                        | Idem                                                                                       |
| Identificar cliente                         | `tools-impl.ts` com OR por termo, sem filtro de workspace | Igualdade exata no workspace; só confirma se o cadastro é do mesmo número; ambíguo não revela                      | Pronta                                                                                     |
| Contexto CRM, qualificação, tarefas, resumo | Qualificação só pela saída final                          | Ferramentas dedicadas; nota continua canônica                                                                      | Pronta (qualificação exige questionário)                                                   |
| Conhecimento/catálogo                       | Texto fixo no prompt                                      | Pesquisa com citação; sem fonte = não inventa                                                                      | Pronta                                                                                     |
| Materiais                                   | Saída final                                               | `materials.find/send` respeitando "Anexar páginas do site"                                                         | Lia: envio desligado                                                                       |
| Handoff/opt-out                             | Saída final                                               | Também por ferramenta                                                                                              | Pronta                                                                                     |
| Etiquetas                                   | Não havia                                                 | Lista permitida por agente                                                                                         | Sem etiquetas definidas na Lia                                                             |
| Web search/fetch                            | Não havia                                                 | Catalogadas como indisponíveis                                                                                     | Sem conector/lista permitida                                                               |

## Regras de segurança

- Ferramenta desligada ou não pronta não é exposta nem executa; ações com efeito exigem o `message_id` da mensagem ATUAL do cliente; retomadas automáticas não executam efeitos.
- Falha ou ausência de resposta da agenda nunca vira "livre". Reserva revalida no momento de marcar. Tempo esgotado → `reconcile` e conciliação pelo id do evento, sem recriar.
- Reunião só é anunciada como confirmada quando o provedor confirma; o link de videoconferência é anexado pelo sistema; qualquer `/book/` é removido.
- `/book/` público e o bloco de Workflows "Link de agendamento" continuam funcionando fora da Lia; a página pública agora também respeita reuniões marcadas pela Lia.

## Pendências

- Publicar o rascunho da Lia (v7) depois da sua revisão.
- Microsoft 365: sem conexão de agenda Microsoft no sistema; getSchedule não implementado.
- Validação com Google real (evento verdadeiro) não executada por decisão: exige criar evento real.
