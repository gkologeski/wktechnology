## Diagnóstico

O deal `a663fb77…` (CT/Brooks Ambiental) mostra reuniões até 2040 porque:

1. O contato principal do deal (Sergio, `1bad118c…`) foi convidado em eventos recorrentes internos do próprio cliente — principalmente **"Brooks - Programação Diária"** (recorrência semanal, 727 instâncias até **2040-05-31**), além de compromissos pessoais como "Academia", "Massagem", "Noripurum".
2. A sincronização com o Google Calendar armazena cada instância recorrente como uma linha em `public.calendar_events` já com `related_contact_id` populado apontando para o Sergio (porque o e-mail dele bate com um contato do workspace).
3. A função `public.get_entity_timeline` tem um `UNION` que espelha na timeline do deal **qualquer** `calendar_event` cujo `related_contact_id` esteja entre os contatos do deal, sem qualificar se é uma reunião WK↔cliente.

Resultado: 727+ ocorrências futuras do calendário particular do cliente aparecem como "reuniões" do deal até 2040.

Nenhuma dessas instâncias é uma reunião WK↔cliente real — nenhuma tem `hangout_link`/`conference_id` da WK e nenhum atendente do domínio interno (`@wktechnology.com.br`) participa.

## O que vou fazer

Sem qualquer regra baseada em janela de tempo. O filtro é 100% semântico: só é reunião do deal se a WK estiver dentro.

### 1. Corrigir o espelhamento na timeline (`public.get_entity_timeline`)

Migration com `CREATE OR REPLACE FUNCTION` que altera os dois `UNION` de `calendar_events` (o de contato e o de espelhamento em deal/company via `related_contact_id`) para exigir que o evento seja "WK-facing":

- Existir pelo menos um atendente cujo e-mail termine em `@wktechnology.com.br` no JSON `attendees`, **ou**
- O `owner_id` do evento ser um usuário interno da WK (membro do workspace com e-mail do domínio interno).

Eventos sem nenhum sinal de participação da WK deixam de aparecer na timeline do deal/contato/company, independentemente da data.

### 2. Corrigir a heurística de ingest (`src/lib/calendar/engine.server.ts`)

Ao popular `related_contact_id` no upsert de `calendar_events`, aplicar a mesma regra: só marcar o evento como cliente-facing quando houver ao menos um atendente do domínio interno da WK. Eventos que só têm contato do cliente + domínios externos ficam com `related_contact_id = NULL`.

### 3. Backfill

Migration única para limpar dados atuais, sem filtro temporal:

```sql
UPDATE calendar_events
SET related_contact_id = NULL
WHERE related_contact_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(attendees) att
    WHERE lower(att->>'email') LIKE '%@wktechnology.com.br'
  );
```

Nenhuma linha é deletada — apenas o vínculo indevido é quebrado. Eventos com atendente WK continuam ligados.

### 4. Validação

- Rodar `get_entity_timeline('deal', 'a663fb77…')` antes e depois e conferir que a contagem cai de 700+ para as poucas reuniões reais WK↔Brooks (ex.: "Alinhamento WK <> Brooks Ambiental" em 13/07/2026).
- Conferir que deals com reuniões WK reais (ex.: NEXID) continuam com a timeline intacta.
- Rodar `bun run typecheck`.

## Fora de escopo

- Não vou mexer no matcher de gravações (`recording_matched_by`).
- Não vou deletar linhas de `calendar_events` — só o vínculo com contato.
- Não vou alterar RLS nem permissões.
- Não vou aplicar cap por janela de tempo em lugar nenhum.

## Detalhes técnicos

- Migration nova em `supabase/migrations/` com: (a) `CREATE OR REPLACE FUNCTION public.get_entity_timeline(...)` com o filtro "tem atendente WK OU owner interno" nos dois `UNION` de `calendar_events`; (b) `UPDATE` de backfill.
- Edição em `src/lib/calendar/engine.server.ts` na função que resolve `related_contact_id` no upsert.
- Domínio interno em constante única (`INTERNAL_EMAIL_DOMAINS = ['wktechnology.com.br']`), reutilizada onde já existir.
- Sem mudanças em componentes React ou rotas.

## Como validar manualmente

1. Abrir `/deals/a663fb77-0f62-4140-bc81-68b0d4f52856` → aba Atividades → só devem aparecer reuniões reais WK↔Brooks.
2. Abrir o contato do Sergio → não devem aparecer "Academia / Massagem / Programação Diária".
3. Abrir um deal com reuniões WK reais (ex.: NEXID) e confirmar que a timeline continua igual.
