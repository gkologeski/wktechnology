---
module_key: people
slug: registrar-um-a-um-na-ficha
title: Agendar e registrar reuniões 1:1 na ficha
summary: Manter pauta, notas e itens de ação de reuniões individuais.
article_type: howto
route_pattern: /people/$id
min_permission: techpeople.one_on_ones.view.own
audience: internal
sort_order: 125
version: 1
is_published: true
---
# Agendar e registrar reuniões 1:1 na ficha

**Para que serve:** Manter pauta, notas e itens de ação de reuniões individuais.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. Criar depende da capacidade de criar registros para a pessoa; editar e excluir dependem da autorização do registro, não apenas da edição do perfil. Notas privadas têm autorização adicional do recurso privado one_on_ones_private.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > 1:1s (`/people/$id`).
**Antes de começar:** Confirme a pessoa da ficha e o que deve constar nas notas visíveis.

## Passo a passo
1. Clique em "Nova 1:1". Preencha Data e hora, Duração (min) e Status.
2. Informe Mood (1-5), se desejado, e registre a Pauta.
3. Preencha "Notas (visível para a pessoa)" apenas com conteúdo adequado a essa visibilidade. Se o campo de notas privadas estiver disponível e editável, use-o para o conteúdo restrito.
4. Em Itens de ação, digite o texto e adicione o item; marque os itens concluídos ou remova os desnecessários.
5. Clique em "Salvar" e confira a reunião. Após o encontro, use o lápis, atualize status e notas e salve novamente. A lixeira permite remover com confirmação quando autorizado.

## Resultado esperado
A tela informa "1:1 criada" ou "1:1 atualizada" e atualiza a lista.

## Regras e limites
- Status disponíveis: Agendada, Realizada, Não realizada e Cancelada.
- Duração deve ser um inteiro não negativo; mood, quando preenchido, um inteiro de 1 a 5.
- Pauta até 4.000 caracteres, notas visíveis até 8.000 e notas privadas até 4.000. Cada item de ação tem texto de 1 a 500 caracteres.
- Poder editar a reunião não libera automaticamente notas privadas; a interface só envia esse campo quando há autorização privada de atualização.

## Erros comuns
- Notas privadas ausentes ou bloqueadas: confira a autorização privada, não copie o conteúdo para notas visíveis.
- Falha ao salvar: confira duração, mood e tamanho dos textos.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)
