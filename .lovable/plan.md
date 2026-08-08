# Vínculo direto, histórico de aninhamento e tipo de documento

Verificado no código antes de planejar: o card "Contratos de compra aninhados" já tem o botão "Aninhar contrato de compra" com um diálogo de busca; `contract_events` já recebe `parent_linked`/`parent_unlinked` e `amendment_linked`/`amendment_unlinked`, mas nenhuma tela mostra esses eventos; o formulário de detalhe não tem campo de tipo de documento, embora `updateContract` já valide "aditivo exige contrato principal".

## 1. Vincular contrato de compra direto do card

O diálogo existe, mas hoje lista qualquer contrato de compra sem contexto. Melhorias:

- Mostrar na lista empresa, vigência e valor de cada contrato de compra, além de título/número/status.
- Marcar contratos já aninhados sob outro contrato de prestação com um aviso ("já aninhado em X") e pedir confirmação antes de mover o vínculo.
- Botão "Aninhar" direto em cada linha do resultado, com feedback e atualização imediata do card (sem sair da tela).
- Estados de carregando, vazio e erro no diálogo; botão desabilitado com tooltip quando o usuário não tem permissão de atualizar contrato.

## 2. Histórico de aninhamento/desaninhamento

- Novo card **Histórico de vínculos** no detalhe do contrato, listando aninhar/desaninhar de compras e aditivos: o que aconteceu, qual contrato envolvido, quem fez e quando.
- Os eventos já são gravados hoje; passam a incluir também o outro lado do vínculo (contrato pai e filho) para o histórico ficar legível, e o evento passa a ser gravado nos dois contratos envolvidos.
- Card com loading skeleton, estado vazio ("nenhuma alteração de vínculo registrada") e erro com ação de tentar novamente.

## 3. Tipo de documento no formulário

- No card "Dados principais", novo campo **Tipo de documento** (Principal / Aditivo).
- Ao escolher Aditivo, o contrato principal passa a ser obrigatório: o campo de seleção do principal fica em evidência e o salvar é bloqueado com mensagem clara enquanto estiver vazio.
- Ao voltar para Principal, o vínculo de aditivo (contrato principal, número e vigência do aditivo) é limpo, com confirmação.
- A validação equivalente no servidor é reforçada para cobrir também a mudança direta de tipo, sem depender da tela.

## Detalhes técnicos

- `src/lib/contracts.functions.ts`: `listLinkableContracts` passa a retornar `parent_contract_id`, `starts_at`, `ends_at` e empresa; `linkContractParent` grava evento nos dois contratos com payload contendo `parent_contract_id`, `child_contract_id` e títulos; nova `listContractEvents` (filtrada por `contract_id` ou `payload` relacionado) resolvendo nome do ator via `profiles`; `updateContract` valida `document_kind === 'amendment' → amendment_of_id` também quando o tipo muda de main para amendment e limpa campos de aditivo quando volta para main.
- `src/components/contracts/contract-parent-link.tsx`: `LinkPickerDialog` com colunas extras, aviso de "já aninhado" + `confirmDialog`, loading/empty/error.
- Novo `src/components/contracts/contract-links-history-card.tsx`, renderizado em `src/routes/_authenticated/contracts.$id.tsx`.
- `src/routes/_authenticated/contracts.$id.tsx`: select de tipo de documento usando os componentes oficiais, gate de salvar e integração com `linkContractAmendment`/`MainContractPicker` já existentes.
- Sem alteração de schema, RLS ou grants. Validações: `tsgo`, lint e os testes de `pending-link`.
