---
module_key: projects
slug: operar-projeto-financeiro
title: Consultar medições e rentabilidade do projeto
summary: Consultar medições e rentabilidade do projeto no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/$id/financeiro
min_permission: techprojects.projects.view.own
audience: internal
sort_order: 210
version: 2
is_published: true
---
# Consultar medições e rentabilidade do projeto

**Para que serve:** O projeto permite acompanhar o que foi medido, aprovado, lançado e recebido, com os dados sensíveis permitidos.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.projects.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Projetos (`/projects/$id/financeiro`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Medições e rentabilidade na ficha do projeto.
2. Confira receitas por situação e cobertura de custos no painel de rentabilidade.
3. Consulte as medições relacionadas ao projeto ou ao serviço e abra os detalhes permitidos.
4. Para preparar medição, siga o fluxo do contrato de origem; não crie uma cobrança paralela para o mesmo serviço.

## Resultado esperado
O projeto permite acompanhar o que foi medido, aprovado, lançado e recebido, com os dados sensíveis permitidos.

## Regras e limites
As medições são preparadas no contrato. Medido, aprovado, lançado e recebido são situações diferentes. Sem tarifa válida, custo/receita é desconhecido, não zero. Painéis têm permissões separadas de profitability e measurements.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

![Tela: Consultar medições e rentabilidade do projeto](/help-media/projects/operar-projeto-financeiro.webp)
