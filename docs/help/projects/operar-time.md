---
module_key: projects
slug: operar-time
title: Configurar política de horas e modelos
summary: Configurar política de horas e modelos no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/settings/time
min_permission: techprojects.time_policy.view.workspace
audience: internal
sort_order: 160
version: 1
is_published: true
---
# Configurar política de horas e modelos

**Para que serve:** A política salva e os modelos ficam disponíveis conforme o escopo autorizado.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.time_policy.view.workspace`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Política de horas e modelos (`/projects/settings/time`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Política de horas e modelos.
2. Confira a política atual, os controles de envio, jornada e aprovação apresentados. Ajuste o limite diário para alerta e a alocação máxima sem justificativa quando necessário.
3. Informe o motivo da mudança e salve a política.
4. Na seção de modelos de entrega, consulte ou salve o modelo e confira sua versão. A aplicação ocorre no projeto e deve ser revisada separadamente.

## Resultado esperado
A política salva e os modelos ficam disponíveis conforme o escopo autorizado.

## Regras e limites
Consultar política e gerenciar política são capacidades diferentes. Não assuma valores padrão universais: a política é do workspace. Limite para alerta não equivale automaticamente a descarte de horas. Modelo salvo tem versão.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Configurar política de horas e modelos; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->
