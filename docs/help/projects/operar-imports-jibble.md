---
module_key: projects
slug: operar-imports-jibble
title: Importar do Jibble
summary: Importar do Jibble no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/settings/imports/jibble
min_permission: 
audience: internal
sort_order: 110
version: 2
is_published: true
---
# Importar do Jibble

**Para que serve:** A execução registra o processamento do histórico de ponto e os vínculos revisados.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Importar do Jibble (`/projects/settings/imports/jibble`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Importar do Jibble. Salve as credenciais e teste a conexão.
2. Confirme a organização de origem e inicie a prévia.
3. Confira Resumo, Mapeamentos, Duplicidades e Staging. Resolva as decisões de duplicidade antes de confirmar o que deve entrar.
4. Confirme a importação da prévia revisada e acompanhe o histórico da execução.
5. Se precisar desfazer, confira a execução escolhida e a confirmação Desfazer; depois revise o resultado.

## Resultado esperado
A execução registra o processamento do histórico de ponto e os vínculos revisados.

## Regras e limites
Ponto do Jibble não deve ser somado automaticamente a horas produtivas do Clockify. Não resolva duplicidade apenas pelo nome. Desfazer depende das regras e do estado da execução, não é uma restauração geral do workspace.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

![Tela: Importar do Jibble](/help-media/projects/operar-imports-jibble.webp)
