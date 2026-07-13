## Objetivo

Criar no CRM a reunião "WK Technology <> AV ECO WELLNESS HUB LTDA" ocorrida em 02/07, vinculada ao deal `4803d5df-ced0-41de-b8da-a1a6ccbd8e22`, sem sincronizar toda a agenda de terceiros e sem duplicar a reunião de 13/07 já existente.

## Escopo

Restrito a uma única inserção de dados. Nenhuma alteração de código, schema, RLS, permissões ou motor de sincronização.

## O que preciso confirmar antes de inserir

Para não gerar um card genérico, preciso destes campos da reunião de 02/07 (só o que você souber — o que faltar eu preencho com valores conservadores):

1. **Data e horário exatos** (início e término, com fuso). Ex.: 02/07/2026 15:00–16:00 (America/Sao_Paulo).
2. **Título** — mantenho "WK Technology <> AV ECO WELLNESS HUB LTDA" se não vier outro.
3. **Organizador/dono no CRM** — por padrão uso o `owner_id` do deal (`1c237fbe…`, Guilherme). Confirma?
4. **Link do Google Meet** da reunião de 02/07 (se houver — ex.: `meet.google.com/xxx-xxxx-xxx`). Sem isso a reunião entra sem `conference_id`.
5. **Participantes** (opcional) — lista de e-mails.
6. **Notas/resumo** (opcional).
7. **Gravação** — se existir link no Drive, informo depois; não é obrigatório para importar.

## Como será feita a importação

Uma única operação de dados (via `supabase--insert`) que:

- Insere uma linha em `public.activities` com:
  - `type = "meeting"`, `completed = true`, `owner_id` = dono do deal (ou o informado),
  - `related_deal_id = 4803d5df-ced0-41de-b8da-a1a6ccbd8e22`,
  - `subject/title`, `due_date` = início da reunião, `meta.end_at` = término,
  - `meeting_key` distinta da de 13/07 para não colidir com o índice único parcial:
    - se você fornecer o link do Meet: `meet:<code>`,
    - senão: `manual:av-eco-wellness-2026-07-02` (prefixo `manual:` para não conflitar com `meet:`/`gcal:`/`title:`).
  - `attachments/meta` com participantes e notas, quando fornecidos.
- **Não** insere nada em `calendar_events` (evitamos criar um evento "fantasma" que o próximo sync poderia tentar reconciliar com Google e falhar). A timeline renderiza cards de reunião a partir de `activities` normalmente — o card virtual de `calendar_events` é opcional.

## Como validar

- Abrir `/deals/4803d5df-ced0-41de-b8da-a1a6ccbd8e22` e conferir que a timeline mostra **duas** reuniões: 02/07 (nova) e 13/07 (existente), sem duplicações.
- Rodar novamente "Sincronizar agora" em Calendários e confirmar que não aparece um terceiro card nem a reunião de 02/07 é sobrescrita.

## Fora do escopo

- Não expandir sync para agendas de terceiros.
- Não mexer no matcher, no `meeting_key`, na deduplicação de timeline, nem em RLS.
- Não incluir gravação — se existir, tratamos em passo separado depois de importar.

## Próximo passo

Você me envia data/hora, link do Meet (se houver) e participantes; eu executo o insert único e devolvo o resultado com o `id` da activity criada para conferência.
