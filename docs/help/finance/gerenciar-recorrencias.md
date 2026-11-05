---
module_key: finance
slug: gerenciar-recorrencias
title: Gerenciar recorrências financeiras
summary: Gerenciar recorrências financeiras no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/recurrences
min_permission: techfinance.recurrences.view.own
audience: internal
sort_order: 110
version: 1
is_published: true
---
# Gerenciar recorrências financeiras

**Para que serve:** Gerenciar recorrências financeiras, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.recurrences`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar recorrências financeiras (`/finance/recurrences`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Filtre as agendas por direção e empresa/grupo.
2. Crie uma recorrência com descrição, valor, datas e cadência.
3. Configure intervalo para Dias fixos e os limites de término oferecidos.
4. Confira a agenda criada; pause ou retome pela ação da linha.
5. Use a geração das pendentes quando autorizado e confira contagem de criadas, ignoradas ou falhas.
6. Exclua uma agenda apenas após conferir a confirmação.

## Resultado esperado
Agenda recorrente cadastrada, com geração condicionada à data e aos limites.

## Regras e limites
- Cadências do servidor: semanal, mensal, anual e dias fixos.
- Intervalo personalizado: 1–365 dias; dia do mês: 1–31; máximo de ocorrências: 1–1000.
- Pausar agenda não estorna pagamentos existentes.
- Capacidades de atualizar, excluir e gerar são retornadas por registro.
- Não presuma execução automática do cron sem configuração validada.

### Campos e controles
Tipo; descrição; valor; categoria; cadência; início; término e limites quando informados; notas.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Gerenciar recorrências financeiras; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.recurrences.tsx; src/lib/finance-recurrences.functions.ts; src/lib/finance-recurrences.server.ts -->
