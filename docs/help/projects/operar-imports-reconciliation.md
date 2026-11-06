---
module_key: projects
slug: operar-imports-reconciliation
title: Conciliar horas e vínculos importados
summary: Conciliar horas e vínculos importados no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/settings/imports/reconciliation
min_permission: 
audience: internal
sort_order: 120
version: 2
is_published: true
---
# Conciliar horas e vínculos importados

**Para que serve:** Decisões e vínculos ficam rastreáveis sem reescrever os dados brutos importados.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Conciliação de horas (`/projects/settings/imports/reconciliation`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Conciliação de horas e escolha o intervalo.
2. Consulte Visão geral e a conferência por agrupamento para entender a cobertura antes de decidir pendências.
3. Na fila de pendências, selecione os casos, confira evidências e registre a decisão com justificativa. Reavaliar a fila é uma ação explícita.
4. Em Vínculos, confira evidências exatas ou sugestões. Aplique vínculos exatos ou confirme sugestões; para reverter, confira as alterações registradas.
5. Use as seções de negócios, horas Jibble e revisão para investigar o tipo de ocorrência correspondente. Exporte pendências somente quando autorizado.

## Resultado esperado
Decisões e vínculos ficam rastreáveis sem reescrever os dados brutos importados.

## Regras e limites
Somente administrador ativo do workspace ativo; Ver Como não pode gravar. Vínculo canônico nunca é inferido apenas por nome. Reversão só desfaz valor ainda igual ao que foi aplicado; edição posterior é preservada. Parâmetros de aba e datas são validados na rota.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

![Tela: Conciliar horas e vínculos importados](/help-media/projects/operar-imports-reconciliation.webp)
