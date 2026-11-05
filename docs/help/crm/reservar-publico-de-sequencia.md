---
module_key: crm
slug: reservar-publico-de-sequencia
title: Reservar o público de uma sequência
summary: Prepare a inscrição do público em uma versão sem iniciar envios.
article_type: howto
route_pattern: /prospecting/sequences
min_permission: system.automation.sequences.view.workspace
audience: internal
sort_order: 407
version: 2
is_published: true
---
# Reservar o público de uma sequência
**Para que serve:** Separar os contatos elegíveis de uma versão antes da abordagem.
**Quem pode fazer:** Reservar exige `system.automation.sequences.assign.own`, `.assign.team` ou `.assign.workspace`.
**Onde fica:** Menu > TechSales > Sequências de prospecção (`/prospecting/sequences`).
**Antes de começar:** Configure "Público", salve, valide e crie uma versão. Tenha a evidência de autorização dos canais.

## Passo a passo
1. Abra "Público" e configure os filtros.
2. Salve o rascunho, valide e crie uma versão.
3. Localize "Inscrição do público em uma versão".
4. Escolha "Versão para inscrição".
5. Registre a origem da lista e a evidência de autorização no campo indicado.
6. Clique em "Reservar público sem iniciar disparos". Durante o processamento aparece "Calculando e reservando…". O botão fica desabilitado sem versão escolhida ou com justificativa de menos de 10 caracteres.
7. Confira o resumo e as exclusões.
<!-- screenshot: versão para inscrição, evidência de autorização e resumo do público -->

## Resultado esperado
"Público reservado. Nenhum disparo iniciado."

## Regras e limites
Usa uma fotografia dos filtros da versão. Exclui descadastros, duplicidades e as proteções configuradas (cliente, negócio aberto, outra sequência, WhatsApp recente). A evidência precisa de pelo menos 10 caracteres. Entrada dinâmica é ativada à parte.

## Erros comuns
- Botão desabilitado: justificativa curta, alterações não salvas ou versão desatualizada.
- "Não foi possível preparar a inscrição. Nenhum envio foi iniciado.": confira versão, permissões e evidência.

## Relacionados
- [Validar e criar uma versão imutável de sequência](/ajuda/crm/validar-versionar-sequencia)
- [Iniciar e pausar execuções de sequência](/ajuda/crm/iniciar-pausar-sequencia)
