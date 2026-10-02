# Avaliação: Cotação -> Proposta -> Contrato para Hunting, Outsourcing, Fábrica e Consultoria

## Diagnóstico (conferido no banco e no código)


| Etapa    | O que já atende                                                                                                                                                                      | O que falta                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cotação  | Itens com catálogo de serviços, perfil de vaga, senioridade, forma de cobrança (por hora, headcount/mês, % de base, fixo), recorrência, validade, aceite público e link de pagamento | Nada ligado à proposta; sem "linha de serviço" (hunting/outsourcing/fábrica/consultoria)                                                              |
| Proposta | Texto livre, versões, travamento, aprovação, variáveis, assinatura eletrônica, valor total                                                                                           | Não tem itens nem ligação com a cotação de origem; valor digitado à mão; sem seções por linha de serviço (escopo, SLA, garantia de reposição, marcos) |
| Contrato | Cria a partir do negócio ou de modelo; tem valor mensal, horas/mês, tipo e escopo de serviço, reajuste, multas, aditivos, assinatura                                                 | Não guarda de qual proposta/cotação veio; os itens da cotação não viram serviços do contrato automaticamente                                          |


Conclusão: o processo é cabível, mas hoje as três etapas são ilhas — só o Negócio as une. O vendedor redigita valores e condições em cada etapa.

## Adequação por linha de serviço

- **Hunting:** Cotação (% do salário por vaga) -> Proposta (Perfil, Garantia, Prazos) -> Contrato de prestação com garantia de reposição. 
- **Outsourcing:** Cotação (headcount/mês ou hora por perfil) -> Proposta (SLA, substituição, reajuste) -> Contrato recorrente + aditivo por novo profissional.
- **Fábrica de software:** Cotação (estimativa) -> Proposta obrigatória (escopo, marcos, aceite) -> Contrato por marcos.
- **Consultoria:** Cotação (horas/pacote) -> Proposta (metodologia, entregáveis) -> Contrato.
- **Cliente com contrato vigente:** Cotação -> Aditivo direto, sem nova proposta.

## Plano proposto (por fases, sem mudar o que já funciona)

1. **Ligação entre etapas:** proposta passa a guardar a cotação de origem; contrato guarda proposta e cotação de origem. Botões "Gerar proposta a partir da cotação" e "Gerar contrato a partir da proposta/cotação", trazendo empresa, contato, valores e itens.
2. **Linha de serviço:** campo "Linha de serviço" (Hunting, Outsourcing, Fábrica de software, Consultoria) no negócio/cotação, que sugere o caminho recomendado acima e o modelo de proposta/contrato.
3. **Modelos por linha:** um modelo de proposta e de contrato para cada linha, usando as variáveis já existentes.
4. **Itens no contrato:** itens aceitos da cotação viram serviços do contrato (e, a partir dele, cobranças no TechFinance pelo fluxo atual).
5. **Atalho de aditivo:** em cliente com contrato ativo, cotação aceita gera aditivo.
6. **Corrigir a tela de Propostas:** título "Contratos" e botão "Novo contrato" passam para "Propostas"/"Nova proposta".
7. **Validação:** testes automáticos e Playwright de ponta a ponta por linha de serviço.

## Detalhes técnicos

- Migração aditiva: `proposals.quote_id`, `contracts.proposal_id`, `contracts.quote_id` (nullable, FK, sem alterar RLS); `service_line` em deals/quotes com valores em PT-BR mapeados.
- Novas server functions `createProposalFromQuote` e `createContractFromProposal` reaproveitando `createContractFromDeal` e `computeBillingAmount`.
- Conversão de `quote_line_items` em serviços do contrato reaproveita `contract_template_services`/serviços existentes.
- Cada fase revisada, testada e relatada separadamente.