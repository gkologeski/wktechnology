# Contrato de compra ligado a várias vendas e negócios

Porte M, cerca de 3 a 4 horas.

## Problema
Hoje um contrato de compra se liga a uma única venda e a um único negócio. No caso NEXID existem duas vendas de consultoria (150 h e 111 h), cada uma com seu negócio, atendidas por uma única compra da Am It (desenvolvimento).

## O que muda para o usuário
- Na aba "Aditivos e vínculos" da compra: seção **"Vendas atendidas"** com a lista de contratos de venda ligados (número, cliente, horas/valor, vigência, negócio) e o botão **"Adicionar venda"** (busca por título/número) e "Remover vínculo" com confirmação.
- Ao criar com "Contratar fornecedor" é possível marcar mais de uma venda do mesmo cliente.
- Na venda e na ficha de cada negócio, a compra aparece em "Contratos de compra ligados", mesmo que a compra tenha sido criada a partir da outra venda.
- A vigência sugerida passa a considerar todas as vendas ligadas (início mais cedo futuro, fim mais longo).
- Regras: só vendas do mesmo workspace; uma compra precisa ter pelo menos uma venda; a venda "principal" continua sendo a usada na criação (compatibilidade).

## Caso NEXID
Ligar a compra C-202611-1816 às vendas C-202611-3015 (150 h) e C-202611-5749 (111 h), com os dois negócios; sugerir fim em 24/12/2026. Feito pela própria tela, com confirmação.

## Detalhes técnicos
- Nova tabela `contract_purchase_sales` (purchase_contract_id, sale_contract_id, workspace_id, is_primary, created_by), única por par; GRANT, RLS por workspace/membership ativo seguindo as funções de acesso de contratos; negócios derivados do `deal_id` de cada venda (sem duplicar).
- Migração aditiva preenche a tabela a partir do `parent_contract_id` atual; a coluna permanece como venda principal.
- Gravação via RPC SECURITY DEFINER (adicionar/remover) validando `techcontracts.contracts.update`, papel client/provider, mesmo workspace, deny e inativo.
- `purchase-from-sale.server.ts` aceita lista de vendas; `purchase-term-defaults` recebe várias vendas.
- Permissões: reutiliza `techcontracts.contracts.view/update`; contrato registrado em `permission-contracts.json` com os 5 cenários.
- Ajuda: atualizar `aninhar-contratos.md` (versão 9).
- Testes: unitários da vigência com várias vendas; testes de banco de permissão (preparados).

## Fora do escopo
Rateio de custo da compra entre as vendas (margem por negócio) — pode vir depois.
