# Por que a IA disse "Compra (somos a CONTRATANTE)" nesse contrato

## O que os dados mostram

Consultei os dois contratos da evidência:

| Contrato            | Papel salvo (`role`)   | CONTRATANTE extraída       | CONTRATADA extraída                       |
| ------------------- | ---------------------- | -------------------------- | ----------------------------------------- |
| C-202608-7678 (CPS) | Prestação (`provider`) | CITEL · 51.212.892/0001-25 | CW KOLOGESKI · 42.296.945/0001-42 (nossa) |
| C-202608-3746 (CC)  | Compra (`client`)      | CITEL · 51.212.892/0001-25 | CW KOLOGESKI · 42.296.945/0001-42 (nossa) |

Ou seja: os dois documentos foram extraídos com exatamente as mesmas partes — a CW é a CONTRATADA nos dois — mas um deles ficou gravado como contrato de **Compra**.

O rótulo "Papel: Compra (somos a CONTRATANTE)" no diálogo de evidências vem do campo `role` do contrato, não dos CNPJs. Os CNPJs vêm de outro lugar (`metadata`). Como o `role` está errado, a linha de papel contradiz as linhas de CNPJ logo abaixo.

De onde veio o erro: o `role` é definido na **importação** (extração por IA do documento), não na análise de vínculo. No C-202608-7678 a própria extração registrou um aviso dizendo que os papéis estavam ambíguos no documento e que ele parece ser um aditivo, sem rótulos claros de CONTRATANTE/CONTRATADA. No C-202608-3746 o `role` saiu como Compra apesar de a CW aparecer como CONTRATADA.

Resumo: não foi a análise de vínculo que "decidiu" o papel — ela apenas confiou no `role` gravado na importação, que está incorreto para o C-202608-3746.

## O que propor corrigir

1. **Coerência de papel na análise**: antes de sugerir, recalcular o papel a partir dos nossos CNPJs do workspace (`legal_entities`): se a nossa empresa é a CONTRATADA ⇒ prestação; se é a CONTRATANTE ⇒ compra. Quando o papel calculado divergir do `role` gravado, a sugestão não usa o `role` gravado como verdade.
2. **Alerta visível na evidência**: quando houver divergência, mostrar um aviso na linha ("Papel gravado divergente dos CNPJs extraídos — revise o contrato") e rebaixar a confiança, em vez de exibir dois blocos que se contradizem.
3. **Bloquear par impossível**: dois contratos em que a nossa empresa é CONTRATADA nos dois não formam par prestação ↔ compra; essa sugestão passa a ser descartada (ou marcada como "requer revisão de papel") em vez de aparecer como Confiança Alta.
4. **Ação de correção rápida**: no diálogo, link para o contrato divergente para ajustar Papel/Tipo de documento antes de aplicar o vínculo.
5. **Diagnóstico da base**: listar em `/contracts/links` os contratos cujo papel gravado contradiz os CNPJs extraídos, para correção em lote manual (nada é alterado automaticamente).

## Detalhes técnicos

- `src/lib/contracts/link-suggest.ts`: nova função pura `inferRoleFromParties(meta, ownEntities)` devolvendo `"provider" | "client" | null`, e `roleMismatch(meta, ownEntities)`. `buildSuggestionEvidence` passa a incluir `pending.role_inferred`, `target.role_inferred` e `role_conflict: boolean`. Testes em `src/lib/contracts/__tests__/link-suggest.test.ts`.
- `isValidSuggestion` recebe as entidades próprias e recusa pares em que o papel inferido dos dois lados é igual; quando o papel inferido é `null` mantém o comportamento atual.
- `src/lib/contracts/link-suggest.functions.ts`: usa o papel inferido ao montar o prompt e ao classificar; rebaixa confiança para `low` quando `role_conflict`; grava `evidence.role_conflict` em `contract_link_ai_suggestions`.
- `src/components/contracts/ai-link-suggestions-dialog.tsx`: badge de aviso, papel inferido ao lado do gravado e link para o contrato. Componentes oficiais, pt-BR, dark mode.
- Sem alteração de schema, RLS ou correção automática do `role` dos contratos existentes.
