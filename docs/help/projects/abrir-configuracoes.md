---
module_key: projects
slug: abrir-configuracoes
title: Abrir configurações do TechProjects
summary: Abrir configurações do TechProjects no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/settings
min_permission: 
audience: internal
sort_order: 130
version: 2
is_published: true
---
# Abrir configurações do TechProjects

**Para que serve:** A rota de configurações abre o hub de importações.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Configurações / ficha vinculada (`/projects/settings`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Acesse /projects/settings.
2. Aguarde o redirecionamento para /projects/settings/imports.
3. Escolha a fonte desejada no hub ou uma configuração específica pelo menu lateral.

## Resultado esperado
A rota de configurações abre o hub de importações.

## Regras e limites
É uma rota de redirecionamento, não uma tela de edição. A tela de destino aplica seu controle de acesso.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

![Tela: Abrir configurações do TechProjects](/help-media/projects/abrir-configuracoes.webp)
