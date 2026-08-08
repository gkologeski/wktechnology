# Associação de contratos com IA em /contracts/links

Adicionar um botão "Analisar com IA" na tela de vinculação que examina os contratos pendentes e propõe as associações: pai de prestação (CONTRATADA = um CNPJ do workspace), filho de compra (CONTRATANTE = um CNPJ do workspace) e aditivos ligados ao seu principal.

As sugestões nunca são gravadas automaticamente: a IA propõe, o usuário revisa e aplica (individual ou em lote).

## Fluxo na tela

1. Botão "Analisar com IA" no cabeçalho, ao lado de "Contratos".
2. Ao clicar, a análise roda sobre as pendências atuais (respeitando o filtro de tipo) e abre um painel de revisão.
3. Cada sugestão mostra:
   - contrato pendente (número · título, tipo);
   - contrato sugerido como par/principal;
   - confiança (Alta / Média / Baixa) e o motivo em linguagem simples (ex.: "CNPJ da CONTRATANTE é a WK Technology" / "cita o contrato C-202608/0031" / "aditivo do contrato X").
4. Checkbox por linha, com "Selecionar todas as de alta confiança" e botão "Aplicar selecionadas".
5. A aplicação usa exatamente as mesmas funções já existentes de vínculo, então a auditoria em `contract_events` e a padronização de título continuam funcionando.
6. Estados de loading, vazio ("A IA não encontrou associações confiáveis"), erro (com ação "Tentar novamente") e limite/creditos de IA tratados com mensagem clara.

## Como a associação é decidida

Camada determinística primeiro (rápida e sem custo de IA):

- Casamento por número citado no documento (`referenced_contract_numbers` × `number`/`self_contract_number`) — já existe e é reaproveitado.
- Papel confirmado pelos CNPJs próprios do workspace (`legal_entities`): CONTRATADA própria ⇒ contrato pai de prestação; CONTRATANTE própria ⇒ contrato filho de compra.
- Aditivo casado com principal do mesmo papel, mesma contraparte e vigência compatível.

Camada de IA para o que sobrar (casos sem número citado, nomes divergentes, razão social vs nome fantasia):

- Envia apenas metadados dos contratos (número, título, papel, tipo de documento, contraparte, contratante/contratada extraídos, CNPJs, vigência, valores) — nunca o arquivo inteiro.
- Recebe uma lista de pares `{ pendente, sugerido, tipo de vínculo, confiança, motivo }`.
- Sugestões que apontem para IDs inexistentes, para o próprio contrato, ou que violem as regras de papel/tipo são descartadas antes de chegar à tela.

## Detalhes técnicos

- Nova server function `suggestContractLinks` em `src/lib/contracts/link-suggest.functions.ts`:
  - `requireSupabaseAuth` + `resolveActiveWorkspace` + `assertAnyPermission` (`techcontracts.contracts.update.own|workspace`);
  - carrega pendências com o mesmo critério de `computePendingLinks` e candidatos via `contracts`;
  - reusa `loadOwnLegalEntities`, `matchOwnEntity`, `normalizeContractNumber` e `resolveReferencedContract` de `src/lib/contracts/import-link.server.ts`;
  - chama o Lovable AI Gateway no mesmo padrão de `import.functions.ts` (`google/gemini-2.5-flash`, `response_format: json_object`, tratamento de 429/402);
  - valida a resposta com Zod e devolve apenas sugestões coerentes.
- Regra pura de validação/classificação das sugestões em `src/lib/contracts/link-suggest.ts` (sem imports de servidor), com testes em `src/lib/contracts/__tests__/link-suggest.test.ts`.
- UI em `src/components/contracts/ai-link-suggestions-dialog.tsx`, acionada por `src/routes/_authenticated/contracts.links.tsx` (única alteração na rota: botão + montagem do diálogo).
- Aplicação reusa `linkContractParent` e `linkContractAmendment` de `src/lib/contracts.functions.ts`; nenhuma mudança de schema, RLS ou regra de negócio.
- Invalidações após aplicar: `contracts-pending-link`, `contracts`, `["contracts","pending-link-count"]`.
- Componentes oficiais do design system (PageHeader, Dialog, Badge, Skeleton, EmptyState/erro), rótulos em pt-BR, foco visível e dark mode.
