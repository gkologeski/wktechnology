## Objetivo

Nas telas de detalhe de **Leads, Contatos, Empresas e Negócios**, transformar o composer do `ActivityTimeline` em uma central de ações que cobre dois fluxos:

1. **Registrar** (texto livre do que já aconteceu): Nota, Tarefa registrada, Ligação, E-mail, Reunião, SMS, Correio Postal, LinkedIn, WhatsApp.
2. **Criar** (iniciar algo novo): Reunião (Google Calendar), E-mail, Tarefa, Ligação (Twilio), WhatsApp. LinkedIn e Sequência ficam desabilitados.

## Passo 1 — Migração de banco

Adicionar 3 novos valores ao enum `activity_type`:
- `sms`
- `postal_mail`
- `linkedin_message`

(`whatsapp` já existe; `note`, `task`, `call`, `email`, `meeting` continuam.)

Conforme escolha do usuário, **um valor de enum por canal** — sem coluna nova.

## Passo 2 — Composer estendido (`ActivityTimeline`)

Reorganizar as abas em duas linhas/grupos visuais dentro do mesmo card:

```text
[ Registrar ]  Nota · Tarefa · E-mail · Ligação · Reunião · SMS · Correio · LinkedIn · WhatsApp
[ Criar    ]  Reunião · E-mail · Tarefa · Ligação · WhatsApp · (Sequência) · (LinkedIn)
```

- Abas de **Registrar**: comportam-se como a aba "Nota" atual — assunto opcional + editor rico + anexos + menções. Ao salvar, criam um `activities` com o `type` correspondente. Ícones novos: `MessageSquare` (sms), `Mail` (postal), `Linkedin`, `MessageCircle` (whatsapp).
- Abas de **Criar**: ao clicar, **não** mostram o editor — abrem a modal/dialog correspondente:
  - **Reunião** → nova `MeetingDialog` (ver Passo 3).
  - **E-mail** → `SendEmailDialog` já existente.
  - **Tarefa** → reaproveita o composer da aba "Tarefa" (criar agendada/já ocorrida via `due_date` + `completed`).
  - **Ligação** → `CallDialer` (Twilio) já existente.
  - **WhatsApp** → `SendWhatsAppDialog` já existente.
  - **Sequência** e **LinkedIn** → botões `disabled` com tooltip "Em breve".

As ações novas resolvem o e-mail/telefone do destinatário a partir do registro pai (lead/contato/empresa/negócio → contato primário).

## Passo 3 — "Marcar reunião" com Google Calendar

- Nova `MeetingDialog` (`src/components/meetings/meeting-dialog.tsx`) com campos: título, descrição, data/início, data/fim, local/link, participantes (e-mail do contato pré-preenchido).
- Sempre cria um `activities` com `type=meeting`, salvando `subject`, `body`, `due_date` (início), `meeting_location`.
- Novo server function `createCalendarEvent` em `src/lib/calendar.functions.ts` que usa o `email_accounts`/`calendar_accounts` Google já conectado do usuário para `POST /calendars/primary/events` no Google Calendar API (engine já tem o cliente em `src/lib/calendar/engine.server.ts`).
- Se o usuário não tiver Google conectado com escopo `calendar.events`, exibir aviso inline com botão "Conectar Google Calendar" apontando para `/settings/calendars` e ainda assim permitir salvar como registro interno.
- Armazenar o id retornado em `activities.external_ids` para deduplicar no sync.

## Passo 4 — Reuso na timeline

- Atualizar `ICONS` em `ActivityTimeline` com os novos tipos.
- Atualizar `ACTIVITY_TYPES` em `src/lib/crm.ts` com labels em pt-BR para `sms`, `postal_mail`, `linkedin_message`.
- O timeline já renderiza qualquer tipo — só ajustar ícone/label.

## Passo 5 — Aplicar nas 4 telas

`ActivityTimeline` já é usado em `leads.$id`, `contacts.$id`, `companies.$id` e `deals/deal-detail-drawer`. Como o composer está dentro do componente, a mudança chega automática nas 4 telas.

## Arquivos afetados

**Novos**
- `supabase/migrations/<ts>_extend_activity_type.sql` — enum.
- `src/components/meetings/meeting-dialog.tsx` — modal de reunião.
- (opcional) `src/components/activity/log-pickers.ts` — agrupamento dos botões.

**Editados**
- `src/lib/crm.ts` — `ACTIVITY_TYPES` ganha novos valores.
- `src/components/activity-timeline.tsx` — duas faixas (Registrar/Criar), ícones, integração com dialogs.
- `src/lib/calendar.functions.ts` + `src/lib/calendar/engine.server.ts` — `createCalendarEvent`.

## Fora de escopo

- Inscrever em sequência e Envolver-se no LinkedIn (apenas botão desabilitado).
- Sincronização bidirecional reunião↔Calendar (só inserção inicial).
- Integração com Microsoft Teams/Outlook.

## Pergunta de confirmação antes de implementar

A migração de enum é irreversível (Postgres não remove valores de enum facilmente). Confirmo que posso adicionar `sms`, `postal_mail` e `linkedin_message`?
