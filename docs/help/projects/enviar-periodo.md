---
module_key: projects
slug: enviar-periodo
title: Enviar um período para aprovação
summary: Enviar um período para aprovação no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: 
min_permission: 
audience: internal
sort_order: 230
version: 1
is_published: true
---
# Enviar um período para aprovação

**Para que serve:** O período elegível é encaminhado para os aprovadores definidos, sem aprovação automática.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Minhas Horas (`/projects/my-hours`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Na visão de horas, abra o envio de período e confira o intervalo.
2. Leia a prévia: registros, total, avisos e bloqueios. Resolva os bloqueios antes de continuar.
3. Confirme o envio e confira a situação dos apontamentos. Se os dados mudarem, gere nova prévia antes de confirmar.

## Resultado esperado
O período elegível é encaminhado para os aprovadores definidos, sem aprovação automática.

## Regras e limites
Prévia contém hash, revisão, versão da política, bloqueios e avisos. Envio depende da revalidação no banco. Editar registro enviado o retorna a rascunho.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Enviar um período para aprovação; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->
