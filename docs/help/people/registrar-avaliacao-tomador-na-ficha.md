---
module_key: people
slug: registrar-avaliacao-tomador-na-ficha
title: Registrar avaliações do tomador na ficha
summary: Documentar avaliações por período, notas e feedback qualitativo.
article_type: howto
route_pattern: /people/$id
min_permission: techpeople.reviews.view.own
audience: internal
sort_order: 126
version: 1
is_published: true
---
# Registrar avaliações do tomador na ficha

**Para que serve:** Documentar avaliações por período, notas e feedback qualitativo.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. Criar depende da capacidade de criar registros para a pessoa; editar e excluir dependem da autorização do registro, não apenas da edição do perfil.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Avaliações (`/people/$id`).
**Antes de começar:** Tenha o período avaliado e o feedback autorizado para registro.

## Passo a passo
1. Clique em "Nova avaliação" para abrir "Nova avaliação do tomador". Preencha Avaliador (nome) e Cargo do avaliador quando necessário.
2. Escolha a Cadência e o Status. Informe Início do período e Fim do período.
3. Em Notas por dimensão, atribua as estrelas de Entrega, Qualidade técnica, Comunicação, Colaboração e Confiabilidade.
4. Preencha Pontos fortes, A desenvolver e Comentários adicionais. Revise a classificação antes de clicar em "Salvar".
5. Confira o cartão e a nota geral. Para revisar, use o lápis e salve as alterações; para excluir, use a lixeira e confirme quando autorizado.

## Resultado esperado
A tela informa "Avaliação criada" ou "Avaliação atualizada" e exibe o registro na lista.

## Regras e limites
- Cadências: Mensal, Trimestral, Semestral, Anual e Pontual. Status: Rascunho, Enviada e Reconhecida.
- As duas datas são necessárias para habilitar Salvar. Nome do avaliador até 160 caracteres; cargo até 120; cada texto de feedback até 4.000.
- Notas no servidor ficam entre 0 e 5. Na ausência de nota geral explícita, o servidor calcula a média das notas numéricas recebidas.
- O status Enviada grava a data de envio no registro; este fluxo não demonstra disparo de e-mail ao avaliador.

## Erros comuns
- Salvar desabilitado: preencha início e fim do período.
- Falha de autorização: confira o acesso à avaliação; editar a pessoa não concede edição das avaliações.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)
