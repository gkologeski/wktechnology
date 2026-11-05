---
module_key: crm
slug: validar-versionar-sequencia
title: Validar e criar uma versão imutável de sequência
summary: Confira a configuração salva e preserve uma revisão antes de reservar contatos.
article_type: howto
route_pattern: /prospecting/sequences
min_permission: system.automation.sequences.view.workspace
audience: internal
sort_order: 406
version: 1
is_published: true
---
# Validar e criar uma versão imutável de sequência
**Para que serve:** Conferir a configuração e preservar uma revisão que pode receber inscrições.
**Quem pode fazer:** Criar versão exige `system.automation.sequences.manage.own`, `.manage.team` ou `.manage.workspace`.
**Onde fica:** Menu > TechSales > Sequências de prospecção (`/prospecting/sequences`).
**Antes de começar:** Salve o rascunho.

## Passo a passo
1. Abra o rascunho em "Rascunhos recentes (até 100)".
2. Clique em "Salvar rascunho" se houver alterações.
3. Clique em "Validar configuração salva".
4. Corrija as pendências indicadas.
5. Ao ver "Configuração conferida para criar uma versão.", clique em "Criar versão imutável".
6. Confira a revisão em "Versões de configuração".
<!-- screenshot: validação aprovada e histórico de versões -->

## Resultado esperado
A versão preserva a configuração. Criar versão não ativa a sequência nem inscreve pessoas.

## Regras e limites
Conexões, permissões e modelos são conferidos de novo antes de cada disparo. O histórico mostra até 25 versões.

## Erros comuns
- "Salve o rascunho para criar versões.": salve primeiro.
- "Não foi possível concluir. Confira suas permissões, as conexões e se o rascunho foi alterado em outra sessão.": revise e repita.
- "Não foi possível carregar o histórico de versões.": tente novamente.

## Relacionados
- [Reservar o público de uma sequência](/ajuda/crm/reservar-publico-de-sequencia)
- [Iniciar e pausar execuções de sequência](/ajuda/crm/iniciar-pausar-sequencia)
