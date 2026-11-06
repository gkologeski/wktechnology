---
module_key: projects
slug: operar-imports-clockify
title: Importar do Clockify
summary: Importar do Clockify no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/settings/imports/clockify
min_permission: 
audience: internal
sort_order: 90
version: 1
is_published: true
---
# Importar do Clockify

**Para que serve:** Os dados aprovados na prévia são processados pelo importador e o resultado da execução fica disponível para conferência.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Importar do Clockify (`/projects/settings/imports/clockify`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Importar do Clockify. Salve a conexão e teste a chave no controle próprio, sem compartilhá-la.
2. Selecione o workspace de origem. Inicie a prévia e configure o tratamento de apontamentos sem projeto e a situação das horas no ERP.
3. Após a simulação, confira Resumo, Pessoas, Clientes, Projetos e Staging. Revise os mapeamentos e os vínculos antes de continuar.
4. Marque a confirmação da prévia e confirme Importar agora somente após revisar os totais.
5. Acompanhe a execução e o resultado. Use controles de estado e revisão apenas para a execução indicada.

## Resultado esperado
Os dados aprovados na prévia são processados pelo importador e o resultado da execução fica disponível para conferência.

## Regras e limites
Prévia não equivale a importação. Identidades criadas sem acesso não recebem login. Histórico importado travado não é aprovado nem faturado; reabertura de entradas é ação separada.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Importar do Clockify; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->
