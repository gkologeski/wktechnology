---
module_key: contracts
slug: fechar-provisao
title: Calcular, fechar e revisar provisão mensal
summary: Calcular, fechar e revisar provisão mensal no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id/medicoes
min_permission:
audience: internal
sort_order: 76
version: 1
is_published: true
---
# Calcular, fechar e revisar provisão mensal
**Para que serve:** Calcular, fechar e revisar provisão mensal.
**Quem pode fazer:** Leitura de techfinance.provisions e techprojects.rates; calcular exige provisions.manage.workspace; fechar/revisar também provisions.approve.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Mês encerrado, acesso ao contrato e fechamento integrado habilitado no workspace.

## Passo a passo
1. Em "Provisão mensal", informe "Competência (AAAA-MM)", "Origem / modelo" e "Fuso da competência".
2. Clique em "Calcular prévia".
3. Confira receita sem cobrança, horas pendentes, custo conhecido, custos sem cobertura e composição.
4. Preencha "Justificativa do fechamento ou da revisão".
5. Clique em "Fechar provisão mensal" ou, se já houver fechamento, "Registrar revisão".
6. Consulte "Histórico da competência".
<!-- screenshot: Calcular, fechar e revisar provisão mensal, sem dados pessoais reais -->

## Resultado esperado
Snapshot gerencial registrado; nenhum título, obrigação, cobrança ou pagamento criado.

## Regras e limites
- Justificativa de 10–2.000 caracteres. Competência padrão: mês anterior.
- Fechamento só para mês encerrado; revisão cria nova versão sem sobrescrever histórico.
- Composição pagina até 50 receitas e 50 custos por página.
- Custo ausente/ambíguo é desconhecido, nunca zero. Estimativas pendentes não autorizam faturamento.
- Campos financeiros ocultos/mascarados podem negar acesso; custo de profissional exige também acesso à pessoa e employment.view.workspace.
- Não somar novamente custo de origem e seus rateios de clientes.

## Erros comuns
"Fechamento integrado ainda não ativado neste workspace.": solicite configuração. PREVIEW_STALE: recalcule. REVISION_STALE: confira a última revisão.

## Relacionados
- [Consultar rentabilidade](/ajuda/contracts/consultar-rentabilidade)
- [Preparar medição](/ajuda/contracts/preparar-medicao)
- [Permissões](/ajuda/contracts/permissoes)
