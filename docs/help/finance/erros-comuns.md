---
module_key: finance
slug: erros-comuns
title: Erros comuns do TechFinance
summary: Erros comuns do TechFinance no TechFinance: operação, acesso e limites confirmados no código.
article_type: troubleshooting
route_pattern: /finance
min_permission: 
audience: internal
sort_order: 340
version: 1
is_published: true
---
# Erros comuns do TechFinance

## Não vejo o menu ou a tela
Confira workspace, membership ativo, licença e permissões. Menu oculto e URL negada devem ser respeitados. Falha de consulta não prova ausência de registros.

## Lançamento indisponível ou sem permissão para esta ação.
Mensagem de finance_entry_access: peça revisão do acesso ao registro e da ação. Não tente outro identificador de registro.

## Sem permissão para esta operação de baixa.
A autorização de pagamento/estorno é específica. Acesso à ficha não basta.

## Preencha descrição e valor.
Informe descrição não vazia e valor positivo; use o formato decimal aceito pelo campo.

## Informe um valor válido. / Valor maior que o saldo em aberto.
Revise valor e saldo atualizado. Pode haver outra baixa registrada desde que a tela foi aberta. Reconsulte antes de repetir.

## Parcelas ou intervalo rejeitados
São 2–120 parcelas. Intervalo personalizado validado no servidor: 1–365 dias. Confira soma e centavos; não confirme uma prévia incorreta.

## Recorrência não gerou título
Confira ativa, próxima execução, início/fim, limite e capacidade de geração. Não presuma que cron esteja operacional. Consulte contagens e falhas devolvidas.

## Não foi possível autorizar a ação financeira.
Autorização de negócio falhou. Confira acesso; não reenvie tentando outro workspace.

## Emissão fiscal indisponível: o adaptador NFS-e não está habilitado. Nenhuma nota foi emitida.
É o comportamento atual do servidor: não houve emissão. Não prometer nota sandbox a partir do comentário no código.

## Aprovação bancária não liquidou
Aprovação, execução e liquidação são etapas distintas. Consulte o status e o modo; mock não prova movimentação real.

## DRE e carteira não coincidem
Confira competência/caixa, período, filtros, pagamentos, escopo e eliminação intercompany. Não ajuste títulos apenas para igualar indicadores.

## Cobrança não chegou
Template ou régua salva não prova envio.

## Quando abrir chamado
Informe rota, ação, mensagem e horário aproximado sem credenciais, documentos ou dados financeiros privados. Anexe apenas captura sanitizada.
