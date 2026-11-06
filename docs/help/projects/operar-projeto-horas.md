---
module_key: projects
slug: operar-projeto-horas
title: Administrar horas e aprovação do projeto
summary: Administrar horas e aprovação do projeto no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/$id/horas
min_permission: techprojects.projects.view.own
audience: internal
sort_order: 220
version: 2
is_published: true
---
# Administrar horas e aprovação do projeto

**Para que serve:** Aprovadores, aceites, fechamentos e modelo ficam registrados em operações separadas.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.projects.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Projetos (`/projects/$id/horas`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Horas e aprovação na ficha do projeto.
2. Confira os aprovadores nomeados e a delegação; altere somente com autorização.
3. No período exibido, registre aceite do cliente com resultado, identificação e evidência quando necessário.
4. Consulte a prévia do fechamento de competência. Resolva bloqueios antes de confirmar o fechamento.
5. Para reabrir competência, registre a justificativa solicitada. Consulte ou aplique o modelo de entrega pela seção correspondente.

## Resultado esperado
Aprovadores, aceites, fechamentos e modelo ficam registrados em operações separadas.

## Regras e limites
Aceite é registro interno com evidência; não implica portal ou assinatura do cliente. Fechamento e reabertura usam regras próprias. Aplicar modelo não é aprovar apontamentos.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

![Tela: Administrar horas e aprovação do projeto](/help-media/projects/operar-projeto-horas.webp)
