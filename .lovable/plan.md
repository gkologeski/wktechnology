# Painel de vendas: filtro de Período com calendário e filtro de Responsável

## O que muda para o usuário
1. **Período**: o seletor simples (7/30/90 dias) vira o seletor de período padrão do sistema, com atalhos em português (Hoje, Ontem, Essa Semana, Esse Mês, Trimestre, Semestre, Ano, Últimos 7/14/30/60/90/180/365 dias) e a opção **Período** para escolher datas no calendário. Padrão: Últimos 30 dias.
2. **Escopo vira Responsável**: sim, faz mais sentido. O campo passa a se chamar **Responsável**, com as opções:
   - **Todos** (padrão para quem pode ver a equipe)
   - **Eu**
   - Cada membro do workspace
   - Sem responsável
   Quem não tem permissão de ver a equipe continua vendo apenas os próprios dados (a lista fica travada em "Eu"), exatamente como hoje — a regra continua sendo verificada no servidor.
3. A comparação com o período anterior (setas de variação nos indicadores) passa a usar um intervalo de mesma duração imediatamente antes do escolhido.

## Detalhes técnicos
- Reutilizar `src/components/date-range-picker.tsx` e `src/lib/date-presets.ts` (já existem); conferir que seguem a skill (Período fixo no topo, dois cliques sem fechar).
- URL: trocar `period` por `preset` + `from`/`to` (ISO, apenas quando `custom`); manter leitura de `period=7|30|90` legado mapeando para `last7/last30/last90`.
- Trocar `scope: me|team` por `assignee` (`__all__`, `__me__`, `__none__` ou uuid); `scope=team` legado → `__all__`, `scope=me` → `__me__`.
- `sales-dashboard.functions.ts`: input `{ from, to, assignee }` validado com zod (uuid ou sentinelas; intervalo máx. 2 anos).
- `sales-dashboard.server.ts`: substituir `periodDays` por `from/to`; helper `mine()` vira filtro por responsável (`owner_id`, coluna já usada hoje). Sem permissão `techsales.dashboard.view.team|workspace`, forçar o próprio usuário, ignorando o valor recebido. Metas por `target_user_id` quando um usuário específico for escolhido.
- UI: usar `AssigneeFilter` existente (`allowAll`, desabilitado quando sem permissão), rótulo "Responsável".
- Sem alterações de banco, RLS ou permissões.

## Validação
- Testes unitários do mapeamento de parâmetros legados e do cálculo do período anterior.
- Typecheck, lint, build; Playwright em `/dashboard`: escolher preset, intervalo personalizado (dois cliques), Responsável = Todos / Eu / membro, conferir números mudando e ausência de erros no console.
