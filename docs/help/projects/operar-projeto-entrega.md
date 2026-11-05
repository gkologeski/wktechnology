---
module_key: projects
slug: operar-projeto-entrega
title: Publicar acompanhamento de entrega
summary: Publicar acompanhamento de entrega no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/$id/entrega
min_permission: techprojects.projects.view.own
audience: internal
sort_order: 200
version: 1
is_published: true
---
# Publicar acompanhamento de entrega

**Para que serve:** O acompanhamento macro é registrado na linha do tempo do projeto.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.projects.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Projetos (`/projects/$id/entrega`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Na ficha do projeto, abra Acompanhamento de entrega.
2. Confira o farol, previsão, evolução e linha do tempo atuais.
3. Com permissão de criação, abra o novo acompanhamento e informe Título, Resumo macro, Farol, Evolução (%), Previsão e Visibilidade.
4. Publique e confira o checkpoint na linha do tempo. Para corrigir ou remover, use as ações de edição ou exclusão quando liberadas.

## Resultado esperado
O acompanhamento macro é registrado na linha do tempo do projeto.

## Regras e limites
Farol: Verde, Atenção ou Crítico. Visibilidade: Interno ou Visível ao comercial. Acompanhamento não cria tarefa, marco nem apontamento e não comprova aprovação financeira.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Publicar acompanhamento de entrega; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->
