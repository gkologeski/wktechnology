## Problema

Ao entrar em `/tickets`, a página não abre no pipeline padrão configurado ("RH - Seleção") nem no layout "Quadro" definido como `default_view` desse pipeline.

Causas identificadas:

1. `src/lib/pipelines.ts` prefere qualquer pipeline chamado "Serviços" sobre o `is_default` — regra criada para Negócios que vaza para todas as entidades (inclui `ticket`). Se o usuário já teve outra seleção salva em `localStorage`, ela também prevalece indefinidamente.
2. `src/routes/_authenticated/tickets.tsx` inicializa `layout` como `"table"` fixo e nunca lê `pipeline.default_view`, então mesmo escolhendo "RH - Seleção" (que tem `default_view = 'board'` no banco) o quadro não abre.

## Mudanças

### 1. `src/lib/pipelines.ts`
- Restringir a preferência por "Serviços" à entidade `deal`. Para as demais (`ticket`, `lead`), voltar à regra: `is_default` primeiro, depois o primeiro pipeline retornado.

### 2. `src/routes/_authenticated/tickets.tsx`
- Ler `pipeline.default_view` do pipeline selecionado e usar como layout inicial (`board` | `table` | `split`), com fallback `"table"`.
- Sincronizar via `useEffect` quando o pipeline selecionado mudar, **apenas** enquanto o usuário ainda não trocou o layout manualmente na sessão (flag local `layoutTouched`), para não sobrescrever a preferência da sessão ao alternar pipelines.

## Fora do escopo
- Não alterar RLS, schema, dados ou lógica de negócio.
- Não mexer no seletor de pipeline de Negócios/Leads.
- Não persistir o layout escolhido pelo usuário entre sessões (comportamento atual mantido).

## Validação manual
1. Abrir `/tickets` sem seleção prévia → deve carregar "RH - Seleção" no seletor e o layout Quadro.
2. Trocar para outro pipeline → mantém o layout escolhido pelo usuário na sessão.
3. Recarregar → volta ao pipeline padrão e ao Quadro.
4. Em `/deals`, o pipeline "Serviços" continua sendo o preferido.
