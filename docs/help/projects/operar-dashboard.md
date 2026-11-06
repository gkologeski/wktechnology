---
module_key: projects
slug: operar-dashboard
title: Consultar o Dashboard de projetos
summary: Consultar o Dashboard de projetos no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/dashboard
min_permission: techprojects.projects.view.own
audience: internal
sort_order: 10
version: 2
is_published: true
---
# Consultar o Dashboard de projetos

**Para que serve:** Indicadores e detalhes refletem o período e o conjunto de dados permitido ao usuário.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.projects.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Dashboard (`/projects/dashboard`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Visão geral > Dashboard. Ajuste o período e os filtros disponíveis.
2. Comece pela Visão geral e selecione somente as visões por perfil que estiverem disponíveis para sua conta.
3. Abra o detalhamento de um indicador para conferir sua composição; compare listas usando o mesmo período.
4. Consulte a cobertura antes de interpretar capacidade, custo ou margem. Abra alertas e, quando autorizado, registre a decisão com justificativa.
5. Use o assistente para consultar os indicadores disponíveis; confirme a interpretação no detalhamento.

## Resultado esperado
Indicadores e detalhes refletem o período e o conjunto de dados permitido ao usuário.

## Regras e limites
As visões dependem de escopo, não do nome do cargo. Leitura não reavalia alertas automaticamente. O assistente é somente leitura. Sem jornada não há capacidade presumida; custo sem cobertura não deve ser tratado como zero.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

![Tela: Consultar o Dashboard de projetos](/help-media/projects/operar-dashboard.webp)
