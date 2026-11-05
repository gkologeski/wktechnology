---
module_key: people
slug: gerenciar-alocacoes-na-ficha
title: Criar e manter alocações na ficha
summary: Vincular a pessoa a contratos e projetos e manter período, capacidade e rateio.
article_type: howto
route_pattern: /people/$id
min_permission: techpeople.allocations.view.own
audience: internal
sort_order: 120
version: 1
is_published: true
---
# Criar e manter alocações na ficha

**Para que serve:** Vincular a pessoa a contratos e projetos e manter período, capacidade e rateio.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. Criar depende da capacidade de criar registros para a pessoa; editar e excluir dependem da autorização do registro, não apenas da edição do perfil.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Alocações (`/people/$id`).
**Antes de começar:** Tenha a pessoa cadastrada e os contratos, projetos e vínculos aplicáveis disponíveis.

## Passo a passo
1. Clique em "Nova alocação". Para alterar uma existente, use o ícone de lápis no cartão autorizado.
2. Selecione o contrato de prestação e, se aplicável, o contrato de compra do prestador. Confira o vínculo de contratação apresentado para novas alocações governadas.
3. Informe projeto, gestor e Cargo/Função na alocação conforme o caso. Se houver sugestões de serviços do contrato, revise antes de aplicá-las; confira senioridade e competências.
4. Defina Alocação (%), Status, Início e, se houver, Fim. Se alterar o período herdado, preencha a justificativa de período diferente do vínculo.
5. Quando necessário, informe horas contratadas por semana e ajuste "Pode apontar horas no projeto". Se o painel indicar excesso de capacidade, registre a justificativa correspondente.
6. Quando autorizado, preencha taxa faturada e custo por hora. Se usar o rateio por empresa, confira os percentuais antes de salvar.
7. Preencha observações e clique em "Salvar". Confira o cartão. Para excluir, use a lixeira e confirme somente se o registro permitir.

## Resultado esperado
A criação informa "Alocação criada"; a lista apresenta status, percentual e período.

## Regras e limites
- Rateio vazio é permitido; se preenchido, exige empresas únicas, percentuais maiores que zero e soma de 100%. Contratos de prestação e de compra devem corresponder ao papel do campo; aditivos não são aceitos.
- Percentual de 0 a 100 no schema; horas semanais, se informadas, devem ser positivas e no máximo 168.
- Observações: até 4.000 caracteres. Valores financeiros dependem de acesso privado específico; visualizar a alocação não libera automaticamente taxas ou margem.
- Alocações vinculadas à contratação têm exclusão desabilitada no painel. Use o fluxo do vínculo para encerramento.
- O resumo financeiro soma alocações ativas e só aparece quando todas as linhas permitem visualizar os dados financeiros.

## Erros comuns
- "Contrato indisponível.": confira disponibilidade e acesso ao contrato.
- "Rateio não salvo": revise as empresas e os percentuais e tente novamente.
- Botão ausente ou desabilitado: confira a capacidade da pessoa ou do registro; editar o perfil não substitui essa autorização.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)
