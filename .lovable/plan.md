# Valores de contrato com variáveis do negócio + nova skill de data única

Duas entregas independentes.

## 1. Valores do contrato aceitando variáveis do negócio

Hoje o passo "Criar contrato a partir do negócio" no workflow só oferece tipo, papel, título, início da vigência, modelo e as duas chaves (copiar itens / não recriar). Não existe nenhum campo de valor, e por isso não há como dizer "valor total do contrato = valor do negócio".

O que muda:

- O passo passa a ter um bloco "Mais campos do contrato" com os campos reais de contrato (valor total, valor mensal, moeda, forma de pagamento, dia de pagamento, vigência, local de execução, etc.), no mesmo padrão já usado pelos passos de criar lead/contato/empresa.
- Cada campo de valor/número/data ganha a opção de usar variável: o usuário alterna entre digitar um número e escolher uma variável do negócio (valor do negócio, valor previsto, quantidade e valores dos itens de linha, salário alvo, etc.) em pílulas, como nos campos de texto.
- Na hora em que o workflow roda, a variável é substituída pelo valor do negócio e convertido corretamente para número/data — inclusive quando vem formatado em real (R$ 3.200,00) — antes de gravar no contrato.
- Precedência preservada: padrões de contrato do workspace < padrões por tipo < dados do negócio < campos preenchidos no passo do workflow.
- Se a variável vier vazia ou não numérica, o campo fica sem valor e o passo registra o aviso no log da execução, sem derrubar o workflow.
- Nenhum valor já gravado é alterado e nada é removido do passo atual.

## 2. Skill de seletor de data única (pt-BR)

Nova skill irmã da `date-range-picker-br`, para **data única** em vez de intervalo:

- Presets, nesta ordem: `Personalizado`, `Ontem`, `Hoje`, `Amanhã`.
- `Personalizado` fica no topo e apenas habilita o calendário; os outros três aplicam a data e fecham.
- Calendário de um mês ao lado da lista, rótulo `dd/MM/yyyy`, locale pt-BR, foco visível, `aria-label`, responsivo e compatível com dark mode.
- Retorna uma única `Date` (e a chave do preset), com adaptador opcional para telas que guardam a data como texto `YYYY-MM-DD`.

A skill inclui o texto de instruções e os dois arquivos de referência prontos para copiar (cálculo dos presets + componente). Esta entrega cria a skill; substituir os campos de data única já existentes no sistema fica para um pedido posterior.

## Detalhes técnicos

- `src/lib/workflows/types.ts`: `create_contract_from_deal` ganha `extra_fields?: Record<string, unknown>`.
- `src/components/workflows/builder/step-forms/contract-forms.tsx`: renderiza `ExtraFieldsEditor` com `entity="contracts"`, `hiddenKeys` para os campos já no formulário e `triggerEntity="deals"`.
- `src/components/workflows/extra-fields-editor.tsx`: campos `number`/`currency`/`date` ganham alternância "valor fixo / variável"; no modo variável usam `TokenInput` com o catálogo de tokens do negócio (incluindo `line_items.*`). `validateField` já tolera tokens.
- `src/lib/workflows/engine/actions-contracts.server.ts`: aplica `resolveExtraFields` e passa o resultado em `fields` de `createContractShared`; nova coerção pós-token (número pt-BR → `number`, texto → ISO em datas) em helper próprio com testes unitários.
- Skill: rascunho em `.agents/skills/date-picker-br/` (`SKILL.md`, `references/date-presets-single.ts`, `references/date-picker.tsx`) e ativação via `skills--apply_draft`.
- Validação: `bun run typecheck`, `bun run lint`, `bun run test` e conferência do passo no builder.
