---
module_key: finance
slug: consultar-auditoria
title: Consultar auditoria financeira
summary: Consultar auditoria financeira no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/audit
min_permission: techfinance.audit.view.workspace
audience: internal
sort_order: 250
version: 1
is_published: true
---
# Consultar auditoria financeira

**Para que serve:** Consultar auditoria financeira, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.audit`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar auditoria financeira (`/finance/audit`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Auditoria.
2. Confira os indicadores de consistência e os avisos apresentados.
3. Investigue os registros de origem nas telas correspondentes.

## Resultado esperado
Diagnóstico financeiro consultado sem reparo automático.

## Regras e limites
- É tela de consulta, não ferramenta para corrigir saldo diretamente.
- Visibilidade do menu por admin não dispensa os controles de acesso financeiros.
- Não exporte evidências com dados privados para a Ajuda.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar auditoria financeira; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.audit.tsx; src/lib/finance-audit.functions.ts -->
