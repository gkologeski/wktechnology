---
module_key: projects
slug: sincronizar-fila-local
title: Guardar e sincronizar novos apontamentos sem conexão
summary: Guardar e sincronizar novos apontamentos sem conexão no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: 
min_permission: 
audience: internal
sort_order: 250
version: 1
is_published: true
---
# Guardar e sincronizar novos apontamentos sem conexão

**Para que serve:** Somente a confirmação do servidor transforma um pendente local em apontamento salvo no ERP.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Minhas Horas (`/projects/my-hours`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. No apontamento rápido, habilite Guardar neste aparelho se a conexão cair.
2. Para novo apontamento, selecione uma atividade existente e revise os dados.
3. Se a conexão cair, confira o aviso de armazenamento local; abra a fila na tela Minhas Horas.
4. Ao recuperar a conexão, envie os pendentes pelo painel e confira os resultados.

## Resultado esperado
Somente a confirmação do servidor transforma um pendente local em apontamento salvo no ERP.

## Regras e limites
Opt-in por usuário e workspace. Apenas apontamento novo com atividade existente; sem tokens ou custos na fila. Sair apaga a fila. Sincronização revalida permissão, competência e idempotência.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Guardar e sincronizar novos apontamentos sem conexão; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->
