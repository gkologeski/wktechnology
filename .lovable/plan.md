# SDR de IA na Prospecção (TechSales): diagnóstico e plano

Somente planejamento. Nada foi editado, publicado ou enviado. As evidências vêm de leitura de código e de consultas só de leitura ao banco, feitas em 06/10/2026.

## 1. Diagnóstico (o que existe hoje)

| Área | Evidência | Situação | Ação |
|---|---|---|---|
| Agente SDR | `/agents/sdr` (`src/lib/menu-config.ts:279`), `src/lib/sdr-agent.functions.ts`: `listPlaybooks`, `upsertPlaybook`, `enrollLead`, `requestHandoff`. Tabelas `sdr_playbooks` (2 linhas: `steps`, `qualification_prompt`, `handoff_score`, `opt_out_phrases`, `max_messages`) e `sdr_enrollments` (0 linhas: `status`, `handoff_at`, `qualification_score`) | Só cadastro. **Nenhum motor** lê esses dados para responder mensagens. | Ajustar e levar para dentro da Prospecção |
| Cadências | `prospecting_cadences`, `prospecting_cadence_steps` (canal whatsapp), `prospecting_enrollments` (`next_run_at`, `status`), `stopEnrollment` com motivo `replied` (`src/lib/prospecting/cadences.functions.ts:244`) | O cancelamento existe, mas só manual. Nenhuma rotina automática processando `prospecting_enrollments` foi encontrada; `sequences-tick` usa outro motor (`src/lib/sequences/engine.server.ts`). | Ajustar: cancelar automaticamente quando o cliente responde |
| Qualificação | `prospecting_questionnaires`, `prospecting_questions`, `prospecting_qualifications` (`answers`, `score`, `decision`) | Existe, preenchida por pessoa. Não guarda evidência por resposta. | Reutilizar e estender |
| WhatsApp: recebimento | `src/routes/api/public/whatsapp/webhook.ts` + `src/lib/whatsapp/webhook-processor.server.ts`; `whatsapp_webhook_events` (`delivery_id` único, `attempts`, `next_attempt_at`; 47 eventos) | Grava antes de processar e deduplica por entrega e por id de mensagem. Não aciona nenhum agente. Não há trava por conversa. | Ajustar |
| WhatsApp: envio | `sendWhatsAppMessage` (`src/lib/whatsapp.functions.ts`) com bloqueio de 24 h e checagem de modelo `APPROVED`; `getWhatsAppServiceWindow` | Funciona no código. **`wa_templates` está vazia (0 modelos)** e `wa_phone_numbers` também (0); o envio usa a conexão do conector. | Reutilizar. Depende de aprovar modelos na Meta |
| Campanhas WhatsApp | `whatsapp_campaigns` (7), `whatsapp_campaign_recipients.wa_message_id`, `whatsapp-campaign-tick.ts` | O destinatário guarda o id da mensagem, mas **a conversa não sabe de qual campanha ou modelo veio** (`whatsapp_conversations` não tem `campaign_id`). | Ajustar |
| Conversas | `whatsapp_conversations`: `contact_id`, `lead_id`, `identity_status`, `assigned_to`, `last_inbound_at` | Não existe dono IA/humano nem estado do agente. | Criar extensão mínima |
| Identidade no CRM | `src/lib/inbox/identity-resolution.server.ts` (Contato antes de Lead, ambíguo fica para escolha manual); gatilho `leads_check_duplicate` | Reaproveitável para não duplicar. | Reutilizar |
| IA | `aiChatFetch` / `resolveAiRoute` (`src/lib/ai/provider-resolver.server.ts`), `ai_call_logs`, `resolveAgentModel`/`logAgentCall` (`src/lib/ai/agent-route.server.ts`) | Provedor por workspace, chaves cifradas no servidor e registro de cada chamada. | Reutilizar |
| Catálogo | `service_catalog` com `active`. Hoje: Outsourcing de TI, Fábrica de Software, Hunting de TI, Consultoria Técnica, **BPO Administrativo/Financeiro** | **Faltam** Alocação de Squad, as frentes da Consultoria e toda a Engenharia de IA & Governança (6 ofertas). WK Sob Medida não aparece. Não há "fonte aprovada" nem regras de preço e política por oferta. | Estender |
| Materiais | `media_assets` (sem aprovação nem vínculo a serviço), `kb_articles` (0) | Nada de "material aprovado". | Criar vínculo mínimo |
| Agenda | `booking_pages`, `bookings` (`gcal_event_id`, `calendar_sync_error`), `createPublicBooking` em `src/lib/booking/engine.server.ts:325`, que grava e depois chama `pushBookingToGoogle`; `calendar_accounts` (3) | A reserva fica gravada **mesmo se o Google falhar**, então "agendado" não prova sucesso no calendário. | Ajustar |
| Workflows | `src/lib/workflows/*` (regras em `src/lib/workflows/AGENTS.md`) | Útil para tarefas e notificações de handoff. Não confirmei se tem ação de envio de WhatsApp. | Verificar |
| Permissões | `techsales.prospecting.*` em `src/routes/_authenticated/prospecting.index.tsx`; `marketing.sdr_agent`; `user_can_act` | Há base para novas chaves. | Estender |

**Principais lacunas:**
- nenhum agente responde mensagens recebidas;
- não há trava nem fila por conversa;
- não há dono IA/humano;
- não há vínculo entre modelo, campanha e conversa;
- o catálogo está incompleto e sem fonte aprovada;
- a agenda sem confirmação real do Google;
- não há modelos aprovados na Meta.

## 2. Arquitetura incremental

```text
Campanha/cadência ─ modelo aprovado ─> wa_message_id ─> conversa.prospecting_context
                                                     │
webhook ─> whatsapp_webhook_events (já deduplica) ─> processador ─> sdr_turn_jobs (fila por conversa)
                                                                     │ trava por conversa
                                              sdr-tick ─> agente (aiChatFetch + ferramentas)
                                                 ferramentas: catálogo, qualificação, CRM, material, agenda, handoff
                                                 cada ação só é "concluída" após sucesso do provedor
```

- O motor fica em `src/lib/prospecting/sdr/` (arquivos `.server.ts`), sem módulo paralelo. O `sdr_playbooks` atual vira a configuração do agente.
- O agente só assume quando a conversa tem `prospecting_context`, ou seja, quando o cliente respondeu a um modelo de campanha ou cadência.
- O dono da conversa (`ai`/`human`/`paused`) fica separado do estado comercial (novo, descoberta, qualificado, material enviado, reunião, perdido). Quando um humano assume, a IA é bloqueada no servidor.
- As ferramentas chamam serviços que já existem, com o cliente RLS do workspace ou o admin só depois de validar o workspace. Toda ação gera registro auditável.

## 3. Fases (cada uma depende da anterior)

1. **Catálogo e fontes.**
   - Entrega: cadastrar as ofertas obrigatórias, com ativo/inativo, resumo aprovado, para quem é, sinais de necessidade, perguntas de descoberta, política e preço só quando aprovado, e fonte (URL do site e data da revisão). Também uma tela de aprovação.
   - Aceite: todas as ofertas obrigatórias ativas e aprovadas, nenhuma fora da lista, e o agente lê só itens aprovados.
2. **Vínculo e entrada.**
   - Entrega: a conversa recebe campanha, modelo e enrollment ao enviar o modelo inicial (pelo `wa_message_id`). Quando o cliente responde, a cadência é cancelada automaticamente (`replied`) e a resposta entra em `sdr_turn_jobs`, sem duplicar.
   - Aceite: resposta repetida do webhook não gera trabalho duplicado, e cliente que respondeu não recebe o próximo passo da cadência.
3. **Agente em modo supervisionado.**
   - Entrega: o agente gera uma resposta como rascunho (`message_drafts`) e um humano aprova o envio. Inclui descoberta, escolha da oferta pelo catálogo e qualificação com evidência (trecho e id da mensagem).
   - Aceite: nenhum envio sem aprovação, toda resposta cita a oferta e a fonte, e a qualificação mostra a evidência de cada campo.
4. **CRM e handoff.**
   - Entrega: vincula ou cria Contato, Empresa e Negócio pela resolução de identidade, sem duplicar. Handoff por pedido do cliente, pontuação, recusa ou dúvida fora do catálogo: troca o dono para humano, cria tarefa e notifica.
   - Aceite: nenhuma duplicata nos testes, e após o handoff a IA não gera nada.
5. **Material e agenda.**
   - Entrega: envio de material aprovado e agendamento pela página de agendamento. Só confirma ao cliente depois do `wa_message_id` ou do `gcal_event_id` com sucesso; se falhar, faz handoff.
   - Aceite: uma falha simulada do Google não gera confirmação ao cliente.
6. **Piloto controlado.**
   - Entrega: envio automático liberado por workspace e por campanha, com limites, horário comercial, opt-out e botão "pausar IA".
   - Aceite: piloto com uma campanha pequena e revisão diária.

## 4. Telas (dentro de `/prospecting`)

- Aba **Agente SDR**, que substitui `/agents/sdr` por redirecionamento:
  - configuração do playbook;
  - limites;
  - modo supervisionado/automático;
  - ligado/desligado.
- Aba **Catálogo do SDR**: ofertas, aprovação e fontes.
- **Fila de revisão**: rascunhos para aprovar, editar ou descartar, com a evidência ao lado.
- Na Inbox e na ficha:
  - selo "IA conduzindo / Humano";
  - botão "Assumir conversa";
  - linha do tempo das ações do agente.

Todas seguem `PageHeader`, `FilterBar`, `EmptyState`, `StatusBadge`, com estados de carregamento e erro.

## 5. Dados (reaproveitar, com extensões mínimas e aditivas)

- `whatsapp_conversations` (novas colunas):
  - `prospecting_campaign_id`, `prospecting_enrollment_id`, `origin_template_name`;
  - `ai_owner` (`ai|human|paused`), `ai_locked_at`, `ai_locked_by`;
  - `commercial_stage`.
- `sdr_playbooks` (novas colunas): `mode` (`supervised|auto`), `catalog_scope`, `quiet_hours`.
- `sdr_enrollments` (novas colunas): `conversation_id`, `state`, `cancel_reason`.
- `service_catalog` (novas colunas): `sdr_enabled`, `sdr_summary`, `sdr_fit_signals`, `sdr_discovery_questions`, `sdr_pricing_policy`, `source_url`, `approved_by`, `approved_at`.
- `media_assets` (novas colunas): `approved_for_sdr`, `service_catalog_id`.
- Tabelas novas:
  - `sdr_turn_jobs`: fila por conversa (`conversation_id`, `inbound_wa_message_id` único, `status`, `attempts`, `locked_until`);
  - `sdr_actions`: auditoria (`kind`, `payload`, `provider_ref`, `status`, `error`);
  - `prospecting_qualification_evidence`: campo, valor, `source_message_id`, trecho.
- Todas com `workspace_id`, GRANT, RLS e políticas na mesma migration. A serialização por conversa usa `pg_advisory_xact_lock` ou `locked_until` atômico.

## 6. Testes e implantação reversível

- **Unitários:**
  - escolha da oferta só entre itens aprovados;
  - bloqueio de oferta inativa;
  - estado comercial separado do dono;
  - regra de cancelamento da cadência.
- **Integração:**
  - webhook duplicado e fora de ordem;
  - duas mensagens simultâneas na mesma conversa;
  - humano assume no meio de um turno, e a resposta da IA é descartada;
  - falha da Meta ou do Google sem confirmar ao cliente;
  - isolamento entre workspaces.
- **E2E (Playwright):** supervisionar, aprovar e enviar; assumir conversa; aprovar o catálogo.
- **Reversível:**
  - uma chave por workspace e por campanha, desligada por padrão;
  - modo supervisionado antes do automático;
  - migrations só aditivas;
  - desligar a chave volta tudo para o fluxo humano atual.

## 7. Decisões e dependências não verificadas

- **BPO Administrativo/Financeiro** está ativo no catálogo, mas fora da sua lista: confirmar se sai do escopo do SDR.
- **Textos, preços e políticas** de cada oferta: confirmar no site e com você; o agente não pode inventar.
- **Modelos na Meta**: `wa_templates` está vazia; é preciso criar e aprovar o modelo inicial. Não verifiquei o envio real por esse caminho.
- **Destino do webhook**: confirmar que o conector WhatsApp manda as mensagens recebidas para este projeto.
- **Cadências**: não achei a rotina automática que executa `prospecting_enrollments` hoje; confirmar se as cadências de WhatsApp realmente disparam.
- **Google Agenda**: falta confirmar que as 3 contas conectadas criam eventos com sucesso, e qual agenda e página de agendamento o SDR usa.
- **IA**: escolher o provedor de IA do workspace e limites de custo; o modelo padrão do Lovable AI fica como opção.
- **Agendador**: confirmar o agendador (cron) para `sdr-tick` e o tempo máximo por turno.
- **Revisão no piloto**: definir quem aprova as mensagens no piloto e os horários de atendimento.
