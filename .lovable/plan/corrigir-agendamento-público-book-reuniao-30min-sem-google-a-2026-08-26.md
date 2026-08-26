# Corrigir agendamento público (/book/reuniao-30min): sem Google Agenda e sem link do Meet

## Diagnóstico (verificado no banco e no código)

O agendamento **foi criado** (`bookings`, 26/08 19:32, convidado gkologeski@gmail.com, status `confirmed`) e gerou uma atividade de reunião. O que não aconteceu:

1. **Sem evento no Google Agenda** — a página `reuniao-30min` está com `calendar_account_id = null`. O código só envia para o Google quando a página tem uma conta de calendário selecionada. Existe conta Google conectada para o seu usuário (guilherme@wktechnology.com.br), mas ela não está vinculada à página.
2. **Sem link do Meet** — mesmo com conta vinculada, a criação do evento não pede sala de conferência (falta `conferenceData` + `conferenceDataVersion=1`), então o Google nunca gera link do Meet. Nada no fluxo de booking cria link de reunião.
3. **Falhas silenciosas** — o envio ao Google é "best effort": qualquer erro (token, permissão, escopo) retorna `null` sem log e sem aviso, e o convidado vê "confirmado". Por isso não houve nenhuma pista do problema.
4. **Lead não criado** — a página tem `target = lead`, mas nenhum lead foi criado para gkologeski@gmail.com; o `insert` de lead também ignora o erro retornado.

## O que será feito

### 1. Gerar link do Google Meet no evento
Ao criar o evento no Google Agenda, solicitar sala do Meet (`conferenceData.createRequest` com `hangoutsMeet` + `conferenceDataVersion=1`), guardar o `hangoutLink` retornado no booking e na atividade (`meet_link` / `meeting_location`), e devolver o link na resposta pública de confirmação.

### 2. Vincular calendário e avisar quando não houver
- Em Configurações → Agendamentos, deixar explícito que sem conta de calendário selecionada não há evento nem Meet, com aviso visível na página e no formulário.
- Sugerir automaticamente a conta Google conectada do próprio dono da página quando `calendar_account_id` estiver vazio (o usuário confirma; nada é alterado sem ação dele).
- Vincular a conta Google já conectada à página `reuniao-30min` (via atualização de dados, sob sua confirmação).

### 3. Parar de falhar em silêncio
- Registrar em log o status e o corpo do erro do Google (sem tokens) e gravar o motivo da falha no booking (campo de erro/observação), para aparecer na tela de Agendamentos.
- Verificar o erro dos `insert` de lead/contato e da atividade, registrando o motivo em vez de descartar — corrigindo a causa da não criação do lead (provável validação/duplicidade ou coluna obrigatória).
- Mostrar na página pública, após confirmar, o link da reunião quando existir; quando não existir, mensagem clara de que o organizador enviará o link.

### 4. Página de Agendamentos (lista)
Exibir por reserva: se foi para o Google Agenda, o link do Meet e o motivo da falha quando houver, com estados de carregamento/vazio/erro no padrão do design system.

## Detalhes técnicos

- `src/lib/booking/engine.server.ts`: `pushBookingToGoogle` passa a pedir `conferenceData` e retornar `{ eventId, meetLink, error }`; `createPublicBooking` grava `gcal_event_id`, link do Meet e erro, e checa os erros dos inserts.
- `src/routes/api/public/booking/$slug/submit.ts`: resposta inclui `meet_link` (quando houver).
- `src/routes/book.$slug.tsx`: tela de confirmação mostra o link.
- `src/routes/_authenticated/settings.booking.tsx`: aviso + sugestão de conta de calendário.
- Migration pequena em `bookings` para colunas de link do Meet e erro de sincronização (com GRANT/RLS no padrão do projeto).
- Sem alterar RLS existente, autenticação ou regras de negócio de outros módulos.

## Validações

`bun run typecheck`, `bun run lint`, `bun run test`, e um agendamento real de ponta a ponta em `/book/reuniao-30min` conferindo evento no Google Agenda e link do Meet.
