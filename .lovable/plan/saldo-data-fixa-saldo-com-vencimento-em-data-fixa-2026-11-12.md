# SALDO-DATA-FIXA — Saldo com vencimento em data fixa

Porte: P/M · Estimativa: 1h30–2h (inclui testes, Ajuda e verificação no preview).

## O que muda para o usuário
- Em "Saldo", nova opção **"Em uma data"** ao lado de Mensal / Parcelas periódicas / Por entregas/marcos.
- Ao escolher, aparece um seletor de data (padrão pt-BR: Personalizado no topo, Ontem, Hoje, Amanhã e calendário). O saldo inteiro vira uma única parcela "Saldo" com essa data.
- A opção vale na cotação, na proposta (e PDF), no contrato e nas contas a receber geradas na ativação — mesma regra para todos.
- Todos os campos de data fixa das telas de cotação e proposta (validade da cotação, validade da proposta, vencimento da entrada e o novo vencimento do saldo) ficam com o mesmo seletor pt-BR. Hoje eles já usam o componente da skill; reviso cada um para garantir o padrão (presets, fechar ao escolher, "Limpar" onde o campo é opcional).

## Regras
- Data do saldo obrigatória quando a opção estiver marcada ("Escolha a data de vencimento do saldo.").
- Se houver entrada com data fixa, o saldo não pode vencer antes dela.
- Condições antigas continuam válidas sem alteração.

## Detalhes técnicos
- `src/lib/sales/payment-terms.ts`: novo `InstallmentPlan { kind: "fixed_date"; date: string }` no tipo, no zod (`installmentPlanSchema`), em `validatePaymentTerms`, `buildPaymentSchedule` (1 parcela `dueDate = date`) e no resumo textual.
- `src/components/sales/payment-terms-editor.tsx`: novo item no ToggleGroup e `IsoDatePicker` do saldo.
- Conferir consumidores do `plan.kind` (proposta/PDF, `contract-payment-terms-card.tsx`, `service_activate_with_terms`) — o RPC recebe o cronograma já calculado; se ele interpretar `kind`, ajuste por migração aditiva.
- Quote/proposal wizards: revisar `IsoDatePicker`/`DatePicker` existentes (sem troca de componente se já conformes).
- Testes em `payment-terms.test.ts`: parcela única na data, data obrigatória, saldo antes da entrada recusado.
- Ajuda: atualizar artigo de condições de pagamento (bump de versão). Sem nova permissão (mesma ação de editar cotação/proposta); contrato de permissões atualizado para arquivos alterados.
- Validação: `permissions:check`, testes, `help:coverage`, verificação no preview com Playwright.
