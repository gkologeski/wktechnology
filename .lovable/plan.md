## Objetivo

Hoje, ao agendar uma entrevista no TechHire (`ScheduleInterviewDialog` → `scheduleInterview`), apenas gravamos uma linha em `ats_interviews` com um `meet_url` opcional digitado pelo recrutador. Não há sala de vídeo automática, não há push pro Google Calendar do host, e o evento não aparece na timeline padrão de reuniões.

O TechSales já resolve isso em `MeetingDialog` + `createMeeting` (Jitsi room + `public_token` + `/meet/:token`, opcionalmente empurrado pro Google Calendar via `pushActivityToCalendar`, e registrado em `activities` como `type: "meeting"`).

O plano é fazer a entrevista do TechHire usar exatamente essa mesma lógica, mantendo tudo que já existe no ATS (kit de perguntas, panel, self-schedule, status, eventos ATS, lembretes).

## Escopo

Somente o fluxo de agendamento **manual** de entrevista (aba "Agendamento manual" do `ScheduleInterviewDialog` + server fn `scheduleInterview`). Fluxos que continuam iguais nesta etapa:

- Self-schedule / link ao candidato (`createSelfScheduleLink`) — quando o candidato escolhe o horário, criamos a reunião naquele momento (fase 2, fora deste plano se não for pedido).
- Async video, kits, panel, reagendar/cancelar/marcar status, lembretes, eventos ATS.

## Mudanças

### 1. `src/lib/ats/interviews.functions.ts` — `scheduleInterview`

Depois de inserir a linha em `ats_interviews`, e apenas quando `kind` for `video`:

1. Chamar internamente a mesma lógica de `createMeeting` (Jitsi room + `public_token`), com:
   - `title`: `"Entrevista — {candidato}"` (buscar nome do candidato pra manter padrão TechSales).
   - `scheduled_at`: o mesmo horário da entrevista.
   - `recording_consent: true`, `skip_activity: true` (a activity será criada no passo 3 pra ficar idêntica ao TechSales).
   - Sem `entity/entity_id` — entrevista não tem `related_*_id` em `meetings`. Vamos linkar via `external_ids` na activity.
2. Se `data.meet_url` foi informado manualmente, respeitamos ele (não sobrescreve). Senão, `meet_url` da entrevista passa a ser `${appUrl}/meet/{public_token}`.
3. Inserir uma linha em `activities` com `type: "meeting"`, `subject`, `due_date`, `meeting_location = meet_url`, `attachments.attendees` (candidato + interviewer + panel), `attachments.end_at`, `external_ids: { interview_id, meeting_id, provider: "jitsi", room_name }`. Isso alimenta a timeline unificada da mesma forma que reuniões do TechSales.
4. Se o host tem `calendar_accounts.sync_enabled = true`, chamar `pushActivityToCalendar` com o `activity_id` recém-criado para criar o evento no Google Calendar do recrutador (mesmo comportamento do TechSales — best-effort, não bloqueia se falhar).
5. Persistir `meet_url` e (novo campo opcional) `meeting_id` na linha de `ats_interviews`, pra permitir navegar do detalhe da entrevista pra sala/gravação.

Detalhes técnicos:

- Não duplicar código: extrair um helper `createInterviewMeeting({ userId, title, scheduledAt })` no próprio `interviews.functions.ts` (ou usar `createMeeting` como server fn — como já é ".middleware([requireSupabaseAuth])", usar o helper de baixo nível via `supabaseAdmin` evita duplicar auth).
- `kind === "phone" | "onsite" | "async"` continua igual ao atual (sem sala, sem push pro Calendar; `location` respeitado; opcionalmente ainda criamos a `activity` pra aparecer na timeline).
- Falha do Google Calendar não pode derrubar o agendamento — envolver em try/catch, logar e retornar `{ id, meeting_id?, meet_url?, calendar_pushed: boolean }` para o dialog exibir o toast correto.

### 2. Migration mínima

Adicionar coluna nullable `meeting_id uuid references public.meetings(id) on delete set null` em `ats_interviews`, mantendo compat com registros antigos. Sem alterar RLS existente.

```sql
alter table public.ats_interviews
  add column if not exists meeting_id uuid references public.meetings(id) on delete set null;
create index if not exists ats_interviews_meeting_id_idx on public.ats_interviews(meeting_id);
```

### 3. `src/components/ats/schedule-interview-dialog.tsx`

- Manter tudo como está; apenas ajustar o toast de sucesso para refletir o novo retorno ("Entrevista agendada. Link da sala: /meet/…", "Sincronizado com Google Calendar", etc.), no mesmo padrão do `MeetingDialog`.
- Quando `kind !== "video"`, comportamento visual inalterado.
- (Opcional, curto) mostrar aviso "Nenhum Google Calendar conectado — geraremos link automaticamente" reutilizando o listing `listCalendarAccounts`, igual ao `MeetingDialog`. Sem bloquear o fluxo.

### 4. Exibição no detalhe da vaga / entrevistas

Onde já listamos entrevistas (`listInterviews` já devolve `meet_url`), incluir `meeting_id` no `select` para que a UI (ex.: aba "Entrevistas" em `jobs.$id`) possa oferecer botões "Entrar na sala" e "Ver gravação" (esta última quando `meeting.status = ended` e houver `recording_storage_path`). Zero mudança de RLS; leitura via server fn autenticada como já é hoje.

## Fora de escopo (fica pra depois)

- Aplicar o mesmo fluxo ao `createSelfScheduleLink` (criar `meetings` só quando o candidato confirma o slot). Pode virar um passo dedicado depois.
- Convite de calendário para o candidato por e-mail (hoje TechSales também depende do Google Calendar do host — mesma limitação).
- Alterações em `meetings` schema, RLS, `activities` schema.

## Riscos e mitigação

- Push pro Google pode falhar silenciosamente: já tratamos no `MeetingDialog`; replicamos o mesmo padrão (`toast.warning`).
- Duplicidade de activity: garantimos `skip_activity: true` no `createMeeting` e criamos uma única activity com `external_ids` contendo tanto `meeting_id` quanto `interview_id`.
- Reagendar/cancelar: nesta fase, `rescheduleInterview` e `cancelInterview` não sincronizam com `meetings`/`activities` (comportamento atual preservado). Fica documentado como próximo passo.

## Validação manual

1. Ir em `/jobs/:id` → aba Entrevistas → agendar entrevista `video` para um candidato.
2. Confirmar que aparece toast com link `/meet/{token}` e, se houver Google conectado, "Sincronizado com Google Calendar".
3. Abrir a timeline do candidato/vaga e confirmar que a reunião aparece como `type: "meeting"`.
4. Abrir o link `/meet/{token}` e confirmar acesso à sala Jitsi.
5. Agendar entrevista `phone`/`onsite` e confirmar que continua funcionando sem sala.

## Relatório final

Ao concluir, entrego resumo, arquivos alterados, migration executada, validações e pendências (self-schedule / reschedule / cancel).
