---
module_key: people
slug: gerenciar-metas-na-ficha
title: Criar e acompanhar metas na ficha
summary: Registrar metas KPI, OKR ou Entrega e atualizar seu progresso.
article_type: howto
route_pattern: /people/$id
min_permission: techpeople.goals.view.own
audience: internal
sort_order: 124
version: 1
is_published: true
---
# Criar e acompanhar metas na ficha

**Para que serve:** Registrar metas KPI, OKR ou Entrega e atualizar seu progresso.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. Criar depende da capacidade de criar registros para a pessoa; editar e excluir dependem da autorização do registro, não apenas da edição do perfil.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Metas (`/people/$id`).
**Antes de começar:** Defina o objetivo e como acompanhar seus valores e progresso.

## Passo a passo
1. Clique em "Nova meta" e informe Título e Descrição.
2. Escolha Tipo (KPI, OKR ou Entrega) e Status (Rascunho, Ativa, Concluída ou Cancelada).
3. Informe Unidade, Peso, Valor atual, Valor alvo e Progresso (%), conforme o acompanhamento desejado.
4. Defina Início e Fim quando aplicável e clique em "Salvar".
5. Confira o cartão. Para atualizar valores ou concluir, use o lápis, ajuste os campos e salve. Para remover, use a lixeira e confirme.

## Resultado esperado
A tela informa "Meta criada" ou "Meta atualizada" e atualiza a listagem.

## Regras e limites
- Título entre 2 e 200 caracteres; descrição até 4.000; unidade até 20.
- Progresso entre 0 e 100; peso não negativo.
- Valor atual, alvo e progresso são campos enviados separadamente; confira o progresso informado, sem presumir cálculo automático.

## Erros comuns
- Salvar indisponível ou validação de título: preencha pelo menos 2 caracteres.
- Lápis ou lixeira indisponível: confira o acesso específico à meta.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)
