---
module_key: finance
slug: criar-lancamento
title: Criar lançamento financeiro
summary: Criar lançamento financeiro no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/receivable
min_permission: techfinance.entries.view.own
audience: internal
sort_order: 60
version: 2
is_published: true
---
# Criar lançamento financeiro

**Para que serve:** Criar lançamento financeiro, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Criar lançamento financeiro (`/finance/receivable`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Clique em Novo lançamento no Dashboard, A receber ou A pagar.
2. Escolha o tipo; informe descrição, valor total, competência e vencimento.
3. Selecione categoria compatível com receita/despesa, empresa contraparte e notas, se necessário.
4. Mantenha Parcelar desligado para um único título e salve.
5. Abra o título na listagem e confira saldo e datas.

## Resultado esperado
Um lançamento manual em BRL, sem baixa automática.

## Regras e limites
- Exige criação de entries no escopo autorizado.
- Descrição não vazia e valor positivo são obrigatórios.
- O cadastro rápido não emite nota, boleto ou transferência.
- Categoria é filtrada por receita ou despesa conforme o tipo.

### Campos e controles
Tipo; descrição; valor total (R$); categoria; competência; vencimento; empresa contraparte (intercompany); notas.

## Erros comuns
“Preencha descrição e valor.”: informe descrição e valor maior que zero. Falhas de referência ou permissão devem ser corrigidas antes de reenviar.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Criar lançamento financeiro](/help-media/finance/criar-lancamento.webp)
<!-- evidência: src/components/finance/quick-create-entry-dialog.tsx -->
