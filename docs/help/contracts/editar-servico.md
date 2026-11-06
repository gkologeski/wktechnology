---
module_key: contracts
slug: editar-servico
title: Editar a ficha de um serviço
summary: Editar a ficha de um serviço no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /services/$id
min_permission:
audience: internal
sort_order: 81
version: 1
is_published: true
---
# Editar a ficha de um serviço
**Para que serve:** Editar a ficha de um serviço.
**Quem pode fazer:** Leitura e atualização de techservice.services no escopo do registro.
**Onde fica:** TechContracts > Contratos (/services/$id).
**Antes de começar:** Abrir um serviço existente.

## Passo a passo
1. Na lista, clique no nome do serviço.
2. Edite "Nome", "Descrição", "Status", "Quantidade", "Preço unitário", "Início" e "Fim".
3. Para serviço recorrente, escolha "Cadência": Mensal, Trimestral ou Anual.
4. Clique em "Salvar".
5. Consulte "Valor por ciclo", "Próxima cobrança", "Direção" e "Lançamentos gerados".
<!-- screenshot: Editar a ficha de um serviço, sem dados pessoais reais -->

## Resultado esperado
A mensagem "Alterações salvas." confirma a gravação.

## Regras e limites
- Nome obrigatório; quantidade e preço não podem ser negativos.
- Tipo, moeda, direção e próxima cobrança não são editáveis nesse formulário.
- Direção é A receber quando a WK presta o serviço; no caso contrário, A pagar.
- Lançamentos gerados mostram até 50 registros recentes por vencimento, com acesso financeiro próprio.
- Salvar o status Ativo não executa o mesmo procedimento da ação "Ativar".

## Erros comuns
"Serviço não encontrado.": volte à lista. "Nenhum lançamento ainda." não significa falha; pode não haver lançamento ou acesso financeiro.

## Relacionados
- [Ativar serviço](/ajuda/contracts/ativar-servico)
- [Consultar serviços](/ajuda/contracts/consultar-servicos)
