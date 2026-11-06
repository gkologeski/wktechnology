---
module_key: projects
slug: operar-hours-review
title: Revisar e decidir horas
summary: Revisar e decidir horas no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/hours-review
min_permission: techprojects.time_entries.approve.workspace
audience: internal
sort_order: 20
version: 2
is_published: true
---
# Revisar e decidir horas

**Para que serve:** A decisão é registrada apenas nos itens cuja autorização e revisão continuem válidas no banco.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.time_entries.approve.workspace`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Revisão de Horas (`/projects/hours-review`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Horas > Revisão de Horas e escolha o período.
2. Confira a fila de itens aguardando sua decisão e a visão de acompanhamento.
3. Selecione os itens que deseja decidir e confira o total selecionado.
4. Aprove ou devolva pelo comando disponível; informe a justificativa solicitada e aguarde o resultado.
5. Recarregue a fila para conferir o que deixou de aguardar sua decisão.

## Resultado esperado
A decisão é registrada apenas nos itens cuja autorização e revisão continuem válidas no banco.

## Regras e limites
A fila é limitada ao que o usuário pode decidir. Ser gestor ou enxergar o menu não substitui a nomeação como aprovador. Não presuma autoaprovação; decisões são revalidadas no servidor.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

![Tela: Revisar e decidir horas](/help-media/projects/operar-hours-review.webp)
