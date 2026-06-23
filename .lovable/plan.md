## Por que a reunião não aparece

A reunião do print foi criada no Google Calendar de **`domine.automacoes@gmail.com`** (organizador) com **`comercial@z3ttagroup.com.br`** convidado — esse contato é o `primary_contact_id` do deal "Negócio - Leandro Borges".

A timeline do deal já sabe puxar `calendar_events` casados pelo e-mail do contato (`src/components/activity-timeline.tsx` linhas 341-451). O motivo de não aparecer **não é o deal**, é a sincronização: o workspace tem **0 eventos** em `calendar_events` porque nenhuma das contas Google conectadas está sincronizando.

Estado atual das contas (`calendar_accounts` do workspace `184b9435…`):

| E-mail | sync_enabled | refresh_token | last_synced_at | last_error |
|---|---|---|---|---|
| `grasiele.magalhaes@wktechnology.com.br` | **false** | presente, mas inválido | 03/06/2026 | `refresh_token invalido (400) - reconecte` |
| `guilherme@wktechnology.com.br` | true | **ausente** (NULL) | **nunca** | — |
| `domine.automacoes@gmail.com` (organizador do print) | — | — | — | **não está conectado no CRM** |

Resultado: `pullGoogleEvents` (`src/lib/calendar/engine.server.ts:332`) cai em `refreshAccessToken` que aborta com "Conta sem refresh_token — reconecte" para o Guilherme e devolve 400 para a Grasiele. Nada chega no `calendar_events`, então a timeline (deal, contato, empresa, ticket) fica vazia para qualquer reunião do Google Calendar.

## Outros casos como esse

Sim — **todos**. Com `calendar_events = 0` no workspace inteiro, **100% das reuniões do Google Calendar de qualquer usuário WK estão ausentes** das timelines, não só essa do Leandro. Não há nada específico ao deal `7c1a5ca9…`.

## Como corrigir

1. **Tela `/settings/calendars` — reconectar as duas contas existentes**
   - Botão "Desconectar" + "Conectar" em `grasiele.magalhaes@wktechnology.com.br` (refresh_token foi revogado no Google).
   - Idem em `guilherme@wktechnology.com.br` (consentimento original não emitiu refresh_token — o fluxo OAuth atual já força `access_type=offline` + `prompt=consent`, então a reconexão vai persistir o refresh_token corretamente).
   - Após reconectar, clicar em "Sincronizar agora". O `pullGoogleEvents` puxa janela de -30 dias / +365 dias na primeira execução.

2. **Conectar a conta `domine.automacoes@gmail.com`** (ou qualquer outra conta operacional que agende reuniões em nome da WK) no mesmo `/settings/calendars`. Sem isso, reuniões criadas só nessa caixa (como a do print) continuarão invisíveis mesmo com as outras duas funcionando, pois nenhum usuário WK aparece como atendente da reunião dela.

3. **Validar** que a reunião do Leandro aparece na timeline do deal `/deals/7c1a5ca9…` depois do primeiro sync da conta que organizou o evento. O matching é pelo e-mail `comercial@z3ttagroup.com.br` (igual ao do contato primário do deal), então deve casar automaticamente.

## Nada de código a alterar agora

A lógica de sync, de matching de contato e de merge na timeline já estão corretas. O problema é 100% de credenciais OAuth/conta faltando. Confirme que pode (a) reconectar as duas contas existentes e (b) se a conta `domine.automacoes@gmail.com` também deve ser conectada — então eu te oriento o passo a passo na tela ou, se quiser, posso adicionar um **aviso visível em `/settings/calendars`** destacando contas com `last_status=error` ou `refresh_token` nulo para evitar que isso passe despercebido de novo. Me diga se quer esse aviso e eu incluo na fase de implementação.