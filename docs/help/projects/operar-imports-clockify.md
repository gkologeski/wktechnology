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
version: 3
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
## Importação contínua

No fim da tela, a seção **Importação contínua** busca dados novos do Clockify sozinha.

1. Ligue **Ligar importação contínua**.
2. Escolha a **Frequência**: a cada 1 hora, 6 horas, 12 horas, diariamente ou semanalmente. Nas duas últimas, escolha também o horário (Brasília) e, na semanal, o dia.
3. Escolha o que fazer a cada execução:
   - **Só gerar a prévia**: o sistema prepara a prévia e um administrador confere e confirma, como na importação manual.
   - **Importar automaticamente**: a prévia é confirmada em nome de quem ligou a agenda. Itens com conflito continuam esperando revisão.
4. Clique em **Salvar agenda**. A tela mostra a próxima execução, a última e o resultado.

Cuidados: nada editado no sistema é sobrescrito e nada é duplicado. Se quem ligou a agenda perder a permissão ou deixar de ser administrador ativo, a agenda é desligada. Só administradores com acesso ao importador veem e alteram a agenda.

- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

![Tela: Importar do Clockify](/help-media/projects/operar-imports-clockify.webp)
