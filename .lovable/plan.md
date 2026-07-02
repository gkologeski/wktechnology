## Problema

Na aba **Entrevistas** do detalhe da vaga (`/jobs/:id`), o grid "Agendar entrevista" mostra no máximo **12 candidatos** e ainda filtra apenas os com `status = "active"`. Candidatos aplicados além disso (ou marcados como `on_hold`, reengajados, etc.) não aparecem — impossibilita agendar entrevista para eles direto dali.

Trechos responsáveis (`src/routes/_authenticated/(ats)/jobs.$id.tsx`):
- L545: `apps.filter((a) => (a.status ?? "active") === "active")`
- L564: `.slice(0, 12)`
- L587-590: mensagem "Mostrando 12 de N. Use a aba Candidatos…"

## Plano (somente UI, sem mudar backend / regras)

1. **Remover o `slice(0, 12)`** e a mensagem "Mostrando 12 de N".
2. **Adicionar campo de busca** (nome do candidato + estágio) acima do grid, para localizar rápido quando a vaga tem muitos aplicantes.
3. **Container com scroll** (`max-h-[420px] overflow-y-auto`) para acomodar listas grandes sem quebrar o layout da aba.
4. **Incluir candidatos não-ativos** por padrão, com um toggle "Somente ativos" ligado por padrão (usuário pode desmarcar para ver `on_hold` / `rejected` / `hired` se quiser reagendar). Mantém comportamento atual como default.
5. **Contador** no cabeçalho ("N candidatos") no lugar da mensagem cortada.

Sem alterações em server functions, RLS, schema, ou no `ScheduleInterviewDialog`.

## Arquivos alterados

- `src/routes/_authenticated/(ats)/jobs.$id.tsx` — bloco `interviewsSection` (linhas ~545-592).

## Como validar

- Abrir uma vaga com >12 aplicantes → todos aparecem no grid rolável.
- Digitar parte do nome no campo de busca → lista filtra em tempo real.
- Desmarcar "Somente ativos" → aparecem `on_hold`/`rejected`/`hired` também.
- Clicar em um card → `ScheduleInterviewDialog` abre normalmente.
