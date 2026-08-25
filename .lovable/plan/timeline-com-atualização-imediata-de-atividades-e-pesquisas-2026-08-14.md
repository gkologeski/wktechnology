# Timeline com atualização imediata de atividades e pesquisas

## Objetivo

Quando uma atividade for registrada (nota, tarefa, e-mail, ligação, reunião, pesquisa, qualificação), a timeline do registro deve atualizar sozinha, sem depender de recarregar a página — inclusive quando a atividade foi criada por outro usuário, por automação ou por um fluxo assíncrono (ex.: qualificação que grava a atividade no servidor depois do modal fechar).

## Situação atual (verificada)

- `src/components/activity-timeline.tsx` mantém a lista em `useState` e recarrega via `load()`:
  - no mount / troca de registro e filtros de data;
  - quando um modal fecha ou a janela volta ao foco (`useRefreshCallback`);
  - via evento `window` de associações;
  - via callbacks `onSaved`/`onCreated`/`onSent` dos diálogos.
- Não existe assinatura de realtime na timeline. Se a gravação termina depois do fechamento do modal (caso da qualificação, que grava a atividade no servidor), ou se outra pessoa/automação cria a atividade, a tela só reflete no próximo refresh.
- As respostas de pesquisa (`activity_survey_responses`) são buscadas em um segundo passo, dependente da lista de atividades — sem realtime, o card de pesquisa também fica defasado.
- Realtime já está publicado para `activities`; **não** está publicado para `activity_survey_responses`.

## O que será feito

1. **Realtime na timeline**
   - Assinar `postgres_changes` (INSERT/UPDATE/DELETE) em `public.activities` filtrando pela coluna de vínculo do registro aberto (`related_lead_id`, `related_contact_id`, `related_company_id`, `related_deal_id`, conforme `relatedKey`).
   - Ao receber evento, disparar `load({ silent: true })` com debounce curto (~250 ms) para agrupar rajadas e não piscar a lista.
   - Reutilizar o padrão já existente no projeto (canal único, desinscrição no unmount e quando a aba fica oculta), como em `src/hooks/use-chat-realtime.ts` / `use-realtime-invalidate.ts`.

2. **Realtime nas respostas de pesquisa**
   - Migration aditiva: `ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_survey_responses;` (a RLS existente continua governando quem recebe os eventos).
   - Assinar essa tabela na timeline e recarregar os metadados de pesquisa quando chegar evento para uma atividade já exibida.

3. **Sinal explícito após salvar pesquisa/qualificação**
   - Emitir o mesmo evento de refresh da timeline após o salvamento da pesquisa (`SurveyActivityDialog`) e da qualificação do lead (painel de qualificação), garantindo atualização imediata mesmo se o realtime estiver indisponível (aba sem WebSocket, bloqueio de rede).
   - Manter todos os callbacks atuais (`onSaved`, `onCreated`, `onSent`) — a mudança é aditiva.

## Detalhes técnicos

- Arquivos previstos: `src/components/activity-timeline.tsx`, `src/components/surveys/survey-activity-dialog.tsx`, `src/components/prospecting/qualification-panel.tsx`, e uma nova migration de publicação de realtime.
- Sem alteração de schema, RLS, permissões ou regras de negócio; a migration apenas adiciona a tabela à publicação de realtime.
- Cuidados: um único canal por timeline (evitar vazamento de conexões), debounce nas invalidações, e nenhuma mudança nos filtros/ordenação existentes.

## Como validar

- Abrir um lead em duas abas; registrar uma nota/tarefa em uma e ver aparecer na outra sem recarregar.
- Qualificar um lead e confirmar que a atividade "Qualificação" aparece na timeline logo após salvar, já com o card de pesquisa preenchido.
- Registrar uma atividade de Pesquisa (NPS/CSAT) e confirmar que o card com respostas e score aparece imediatamente.
