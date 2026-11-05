# Contratação integrada — etapa 5

## Resultado

Provisão mensal gerencial, separada da medição, título financeiro, nota fiscal, cobrança bancária e pagamento. Reutiliza modelos, tarifas, medições, dono da cobrança, aprovação segregada, vínculo de legado e estorno existentes. Não cria um segundo gerador de faturamento.

## Uso e modelos

Em **Contrato → Medições → Provisão mensal**, escolher o modelo vigente, competência e fuso, calcular a prévia e registrar fechamento de mês já encerrado com justificativa. A provisão congela CNPJ WK, contrato, moeda, fontes, estimativas pendentes e custos conhecidos/desconhecidos. Não cria nenhum título. Uma revisão referencia a anterior e preserva ambas; fonte ou revisão alterada exige nova prévia.

O modelo comercial sugere, sem ativação automática: por hora → por hora; headcount/mês ou fixo mensal → mensalidade; percentual de base → sucesso. Unidade/fixo único são ambíguos: escolher explicitamente marco, pacote ou outra regra contratual. Configuração nova continua sem retroatividade; conciliação histórica pertence à etapa 6.

- Por hora: somente tempo aprovado, não importado, dentro da vigência, realmente fechado no escopo correspondente e sem faturamento anterior. Limites e aceite do cliente do contrato continuam válidos.
- Pacote: franquia e valor contratados; somente horas elegíveis consomem saldo. Pendências não são consumo aprovado.
- Mensalidade/capacidade: quantidade e preço do serviço ou valor mensal contratual/explicitamente revisado, com pró-rata configurado. Não exige apontamento fictício.
- Marco: conclusão é diferente de aceite. Registrar a referência de aceite no detalhe do rascunho; alterações do marco invalidam a correspondência. É uma atestação humana, não validação criptográfica de documento.
- Hunting percentual: candidatura contratada com evento confirmado na competência, vinculada ao negócio do contrato. Oferta assinada não basta. Oferta e candidatura normalizam para a mesma candidatura, impedindo dupla cobrança do mesmo sucesso. Reversão da contratação barra geração posterior.

Depois da provisão, seguir a medição existente: preparar → enviar → outra pessoa aprova → resolver pendências/legado → gerar título interno. Aprovação de horas, fechamento financeiro, aprovação de medição e geração são decisões diferentes. Revisar provisão não altera títulos já emitidos. Complemento por horas/marcos, vinculação de título legado e estorno preservam suas proteções; modelos que não aceitam complemento exigem estorno/nova medição, sem apagar pagamentos.

## Custos internos e gestão compartilhada

O mesmo painel no contrato de compra do profissional permite fechar o custo do vínculo, sem negócio, cliente ou configuração de faturamento. Exige acesso HR à pessoa/vínculo além de contrato, custo e provisões. Custo mensal da pessoa é contado uma vez, com data efetiva de admissão, vigências e pró-rata. As parcelas rateadas nos contratos de venda são visões dessa origem; não somar ambos como despesas diferentes. Nenhuma conta a pagar nasce automaticamente. Vínculos simultâneos, tarifas ou cobertura de dias ambíguos permanecem desconhecidos para revisão, sem inferir salário.

## Custos e histórico

Custos por hora mantêm origem; mensais são contabilizados uma vez por alocação, na moeda contratada, com vigência e pró-rata. Custo mensal da pessoa respeita percentual da alocação; tarifa mensal específica da alocação representa seu valor acordado. Tarifas ambíguas ou mudanças de valor com mês integral exigem revisão, nunca somam dois meses. Ausente não vira zero. Não se convertem salários/custos mensais em tarifa horária presumida e moedas não são misturadas. Importados bloqueados não se tornam aprovados ou faturáveis.

## Segurança e rollout

Migrações 0316–0319 aditivas, flag `finance_gate_enabled` desligada por padrão. Ativar somente WK após verificar commit/CI/hash publicado. Nenhuma configuração, provisão, aceite ou título de cliente é criado automaticamente pela migração. Modelos nativos e históricos não são ativados em massa. Leitura não grava.

Permissões gerenciáveis: `techfinance.provisions.view/manage/approve.workspace` e `techprojects.billing_acceptance.approve.workspace`. Provisões também exigem tarifa/custo visível e contrato acessível; regras de campo hidden/masked bloqueiam o snapshot sensível. Membership ativo, workspace selecionado, deny e Ver Como somente leitura são conferidos na fronteira SQL e nos handlers. Tabela de provisão permite só SELECT autenticado sob RLS; escrita pelas RPCs, revisões imutáveis. Funções internas e guard de worker não são APIs públicas.

A geração financeira revalida o contrato assinado na versão atual e segura seu registro durante a criação. Contrato encerrado pode acertar competência dentro da vigência; mês posterior não pode ser cobrado. Isso não reabre recrutamento nem permite nova alocação após o encerramento. Workflows governados não geram parcelas antecipadas e workers legados cedem quando a medição já é dona da cobrança do negócio: usar provisão e medição; há guarda no worker antes do efeito e gatilho de banco para títulos legados dessa origem.

## Validação

PostgreSQL descartável executa os códigos reais de provisões e medições: cinco cenários de autorização, idempotência e duas conexões concorrentes, stale preview/revisão, preservação do histórico, assinatura, contrato encerrado, horas pendentes/importadas/não fechadas, franquia, rateio, Hunting e ausência de duplicidade. Identidade é fixture SQL, não login GoTrue. Workers têm teste de recusa antes da gravação. Gate final: permissões, tipos, lint, suíte completa, build, performance, CI e hash servido. Ensaios de DDL usam rollback antes da aplicação; aceite de negócio e documentos reais não são simulados em produção.

Título legado de Hunting com origem exata na candidatura vira pendência antes de gerar outro, mesmo sem serviço preenchido. A classificação/vinculação exige conferência no Financeiro; histórico ambíguo sem origem exata permanece no escopo de conciliação assistida da etapa 6.
