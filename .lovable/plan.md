# Propostas e Contratos com o mesmo padrão das Cotações

## Objetivo
No Negócio, os quadros **Cotações**, **Propostas** e **Contratos** passam a funcionar do mesmo jeito:
- cada quadro tem um cabeçalho com o total e o botão "+ Adicionar";
- cada item aparece num cartão com título, situação, número e valor, e um menu "..." de ações;
- toda criação e edição abre um assistente passo a passo (Avançar / Voltar / Concluir), como o da cotação.

Os botões soltos "Gerar proposta" e "Gerar contrato" saem de baixo de cada cotação e passam para o menu "..." da cotação. Também saem os links "Gerar do negócio" e "Gerar de modelo" do quadro de Contratos.

## Quadro Propostas
- **"+ Adicionar"** abre o assistente de proposta com duas origens: a partir de uma cotação do negócio ou em branco, com os dados do negócio.
- **Assistente (4 passos):** Identificação, Itens e valores, Conteúdo e Revisão. É o assistente que já existe, adaptado para também começar em branco.
- **Menu "..." de cada proposta:** Abrir, Editar (no assistente), Enviar para aprovação, Enviar ao cliente, Gerar contrato, Baixar PDF e Excluir (com confirmação). Cada ação só aparece quando a situação da proposta permite. Proposta travada não pode ser editada.

## Quadro Contratos
- **"+ Adicionar"** abre o assistente de contrato.
- **Assistente (5 passos):**
  1. **Origem:** em branco, a partir do negócio, de uma cotação, de uma proposta ou de um modelo.
  2. **Tipo:** prestação, compra ou aditivo. Se a empresa já tem contrato ativo, o assistente oferece criar um termo aditivo.
  3. **Dados:** os campos do contrato, já com os padrões do workspace.
  4. **Serviços:** os itens da origem, que você marca ou desmarca.
  5. **Revisão:** resumo e botão "Criar contrato".
- **Menu "..." de cada contrato:** Abrir, Ver fluxo do contrato, Editar, Adicionar aditivo, Enviar para assinatura e Excluir (com confirmação), conforme a situação do contrato.

## Quadro Cotações
- O menu "..." da cotação ganha **Gerar proposta** (abre o assistente de proposta) e **Gerar contrato** (abre o assistente de contrato já com a cotação como origem).

## Também em Cotações e na ficha da proposta
Os botões "Gerar proposta" e "Gerar contrato" da tela de Cotações e da ficha da proposta passam a abrir os mesmos assistentes.

## Fora do escopo
- Regras de aprovação, assinatura e numeração: tudo continua igual.
- Permissões e estrutura do banco: nada muda.

## Detalhes técnicos
- Novo componente compartilhado `DealDocumentCard`, com o cartão (título, situação, metadados e menu de ações), para os três quadros. O visual sai do cartão de cotação atual.
- `ProposalWizard` passa a aceitar a origem `{ quoteId } | { dealId }` e a edição de uma proposta existente (`proposalId`). A criação em branco usa `createProposal`, e a edição usa `updateProposal`.
- Novo `ContractWizard`, que reaproveita `useContractForm`, `ContractKindPicker`, `ContractFieldsForm` e `DealServicesPreview`, mais `createContractFromSales`, `createContractFromTemplate`, `listActiveContractsForSales` e `createContract`.
- `GenerateContractButton` passa a abrir o `ContractWizard`. A pergunta "novo contrato ou aditivo" vira o passo 2 do assistente.
- `DealProposals` e `DealContracts` são reescritos com o novo cartão e o menu de ações. `deal-quotes.tsx` move as ações de geração para o menu "...".
- As exclusões usam `deleteRowGuarded` com `confirmDialog`.
- Validação: typecheck, lint e Playwright (abrir cada assistente, avançar pelos passos e cancelar sem criar). A criação real de proposta e de contrato só com a sua autorização.
