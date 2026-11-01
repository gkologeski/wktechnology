# Lembretes de reunião por WhatsApp (template aprovado)

Porte: **M** — estimativa **3 a 4 horas** (código + banco + testes + Playwright). Nada publicado ao final sem seu pedido.

## O que você vai ter
- Nova tela **Configurações → Lembretes de reunião (WhatsApp)**.
- Liste as opções **24 horas antes, 3 horas antes, 1 hora antes, 5 minutos antes**; ligue uma ou mais.
- Para cada opção ligada: escolher o **modelo aprovado na Meta** (só aparecem `APPROVED`), o idioma e o número que envia (padrão da conversa ou Bruna), e mapear as variáveis (ex.: {{1}} = primeiro nome, {{2}} = data, {{3}} = hora, {{4}} = link da reunião, {{5}} = nome do responsável).
- Prévia da mensagem com dados de exemplo antes de salvar.
- Interruptor geral "Ativar lembretes" por workspace.
- Na ficha da reunião (atividade tipo Reunião): indicador "Lembretes WhatsApp: 24h ✓ enviado · 1h agendado", com opção de desligar só para aquela reunião.

## Regras de envio
- Vale para reuniões (atividades tipo Reunião) futuras, não concluídas e não excluídas, com Contato ou Lead vinculado que tenha WhatsApp celular válido (regra WhatsApp → Celular → Telefone, nunca fixo).
- Cada opção envia **no máximo uma vez por reunião** (registro por reunião + opção, sem duplicar).
- Reunião criada já dentro do prazo (ex.: marcada para daqui 2h) **não** dispara o lembrete de 24h/3h vencidos; só os que ainda cabem. Tolerância de atraso: até 10 min (para 5 min antes: até o horário da reunião).
- Reunião remarcada: lembretes ainda não enviados são recalculados para o novo horário; os já enviados não repetem. Reunião cancelada/concluída: pendentes são cancelados.
- Respeita opt-out ("não quero receber"). Sempre template (não depende da janela de 24h).
- Antes de enviar, o servidor confere de novo: modelo ainda APPROVED, variáveis completas, reunião ainda válida.
- Mensagem enviada aparece na conversa da Inbox e na timeline do cliente; falhas aparecem com o motivo traduzido.

## Permissões
- Nova chave `crm.meeting_reminders` (ver / configurar), cadastrada em `/settings/permissions`, sem conceder automaticamente; owner/admin configuram. Tela, servidor e banco negam por padrão; testes: permitido, sem chave, deny, outro workspace, inativo.

## Detalhes técnicos
- Migration: `meeting_reminder_settings` (workspace_id, enabled, sender_phone_number_id) e `meeting_reminder_rules` (workspace_id, offset_minutes ∈ {1440,180,60,5}, template_name, language, variable_map jsonb, enabled; único por workspace+offset); `meeting_reminder_dispatches` (activity_id, rule offset, workspace_id, status queued/sent/failed/skipped/cancelled, wa_message_id, error, sent_at; único activity_id+offset); coluna `activities.wa_reminders_disabled boolean default false`. Ordem CREATE → GRANT → RLS → POLICY com `user_can_act`.
- Lógica pura em `src/lib/whatsapp/meeting-reminders.ts` (quais offsets vencem agora, recálculo ao remarcar, montagem de variáveis) com testes vitest.
- Envio em `meeting-reminders.server.ts` reutilizando o envio de template existente (gateway Meta, registro outbound `accepted`, reconciliação de status) e `composer-policy`.
- Agendador: nova rota `/api/public/hooks/meeting-reminders-tick` a cada 2 min (padrão do projeto, `requireCronAuth`), idempotente; usa claim por linha para não enviar em dobro.
- Server functions finas em `meeting-reminders.functions.ts`; lista de modelos via `/message_templates` filtrando APPROVED.
- Contrato em `permission-contracts.json`; `permissions:check`, testes e Playwright na tela nova.

## Fora do escopo / dependências
- Criar os modelos na Meta (ex.: "Lembrete: sua reunião com a WK é amanhã às {{3}}") — você cria/submete; aprovação até 48h. Posso sugerir textos.
- Lembretes de entrevistas do TechHire não entram nesta entrega.
