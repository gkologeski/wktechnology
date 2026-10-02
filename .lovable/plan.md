# Wizard de geração de proposta (igual ao da cotação)

## Objetivo
"Gerar proposta" (no Negócio e em Cotações) deixa de criar a proposta direto. Abre um assistente passo a passo, no mesmo visual do assistente de cotação, onde o usuário revisa e altera tudo antes de criar.

## Passos do assistente
1. **Identificação**: título, empresa, contato, responsável e validade, já preenchidos a partir da cotação.
2. **Itens e valores**: itens da cotação, só para leitura, com forma de cobrança e total. O valor total da proposta pode ser ajustado. Os itens continuam sendo editados na cotação.
3. **Conteúdo**: texto da proposta já montado com as seções do tipo de serviço (Hunting, Outsourcing, Fábrica ou Consultoria). O usuário edita as seções no mesmo editor da tela de proposta e pode inserir cláusulas prontas.
4. **Revisão**: resumo do que vai ser criado. Botão "Criar proposta", que abre a proposta criada.

## Comportamento
- Se a cotação já tiver proposta, o assistente não abre e o sistema vai direto para a proposta que já existe, como acontece hoje.
- Fechar ou cancelar o assistente não cria nada. A proposta só é gravada no último passo.
- O assistente pode ser usado nos dois lugares: no Negócio e em Cotações.
- Telas de carregamento, erro e botões desativados enquanto a proposta é salva. Tudo em português.

## Fora do escopo
- Fluxo de aprovação, travamento e assinatura da proposta.
- Geração de contrato.
- Permissões e estrutura do banco: nada muda.

## Detalhes técnicos
- `sales-flow.server.ts`: separar `proposalDraftFromQuote(quoteId)`, que só monta o rascunho (título, corpo, valores, vínculos, `reused`/`existingId`) sem gravar, de `proposalFromQuote`, que passa a aceitar ajustes opcionais (`title`, `body`, `total_amount`, `expires_at`, `assigned_to`). A checagem de duplicidade por `quote_id` continua.
- `sales-flow.functions.ts`: nova `getProposalDraftFromQuote` e `createProposalFromQuote` com os ajustes opcionais, validados com zod.
- Novo `src/components/proposals/proposal-wizard.tsx`, com o mesmo stepper, layout e botões Voltar/Próximo do `QuoteWizard`. O editor é o mesmo da ficha de proposta.
- `deal-quotes.tsx` e `settings.quotes.tsx`: "Gerar proposta" abre o assistente. Se `reused` for verdadeiro, navega direto para a proposta existente.
- Validação: typecheck e Playwright (abrir o assistente, avançar pelos passos, cancelar sem criar e criar uma proposta numa cotação sem proposta, com sua autorização).
