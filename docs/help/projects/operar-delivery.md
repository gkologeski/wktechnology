---
module_key: projects
slug: operar-delivery
title: Configurar a entrega de negócios ganhos
summary: Configurar a entrega de negócios ganhos no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/settings/delivery
min_permission: 
audience: internal
sort_order: 70
version: 2
is_published: true
---
# Configurar a entrega de negócios ganhos

**Para que serve:** Novas transições elegíveis passam pelo fluxo de criação ou vínculo de projeto de entrega.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Entrega de negócios (`/projects/settings/delivery`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Entrega de negócios e confira a política atual.
2. Defina o criador dos projetos automáticos e, se necessário, o responsável operacional padrão.
3. Revise a política antes de ativar e confirme a ativação pelo comando exibido.
4. Ao ocorrer uma nova transição de negócio para etapa de ganho, acompanhe o vínculo de entrega e o projeto em planejamento.

## Resultado esperado
Novas transições elegíveis passam pelo fluxo de criação ou vínculo de projeto de entrega.

## Regras e limites
Não reprocessa automaticamente o histórico anterior à ativação. Ganho é definido pelo tipo da etapa do funil. Criação e vínculo usam controle de duplicidade por negócio e grupo de entrega; não crie projeto paralelo para compensar uma falha sem investigar.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

![Tela: Configurar a entrega de negócios ganhos](/help-media/projects/operar-delivery.webp)
