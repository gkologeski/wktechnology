---
module_key: projects
slug: reutilizar-template-lista
title: Salvar e reutilizar template de lista
summary: Salvar e reutilizar template de lista no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: 
min_permission: 
audience: internal
sort_order: 280
version: 1
is_published: true
---
# Salvar e reutilizar template de lista

**Para que serve:** Uma nova lista é criada a partir do template escolhido.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Espaços > Lista > Tarefa (`/projects/lists/$id`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Na lista, abra Salvar como template e informe um nome.
2. Na árvore de espaços, abra a criação de lista a partir de template e selecione o modelo disponível.
3. Confirme a criação e revise a lista resultante.
4. Remova um template apenas quando tiver capacidade de gestão e tiver conferido a seleção.

## Resultado esperado
Uma nova lista é criada a partir do template escolhido.

## Regras e limites
Gestão usa techprojects.list_templates. Não prometa cópia de histórico de horas, permissões ou vínculos comerciais sem validação específica.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Salvar e reutilizar template de lista; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->
