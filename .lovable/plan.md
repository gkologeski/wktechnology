# Título padronizado dos contratos importados

Hoje, na importação em massa, quando a IA não devolve um título ele cai no nome do arquivo (`fields.title ?? item.file.name`) e, no servidor, em "Contrato importado". Resultado: títulos como `contrato-gralha-assinado-v2.pdf`.

## Padrão proposto

Formato: `PREFIXO CONTRATANTE X CONTRATADA`

- Prefixo pelo tipo de documento/serviço:
  - `CPS` — contrato de prestação de serviços
  - `CC` — contrato de compra
  - `CD` — desenvolvimento, `CM` — manutenção, `CCO` — consultoria, `CL` — licenciamento
  - Aditivo: `ADT N` na frente, ex.: `ADT 1 CPS WK TECHNOLOGY X GRALHA IMÓVEIS`
- Nomes das partes em maiúsculas, sem sufixos societários (LTDA, S.A., ME, EIRELI) e sem CNPJ, limitados a ~40 caracteres cada para não estourar a coluna da grid.
- Sempre CONTRATANTE primeiro, CONTRATADA depois, independente de sermos prestador ou cliente.

### Sugestão adicional (opcional)

Uma variação que ajuda muito em bases grandes é acrescentar vigência ou número no fim:

`CPS WK TECHNOLOGY X GRALHA IMÓVEIS — 2026` (ano de início)

Fica legível, ordena bem por empresa e diferencia renovações do mesmo par de partes. Posso ativar isso como padrão ou deixar de fora — a implementação prevê um único ponto de montagem do título, então trocar depois é trivial.

## Onde aplica

1. **Importação em massa e importação individual**: o título passa a ser gerado pelo padrão sempre que houver contratante e contratada identificados. Se faltarem as partes, cai para o título da IA e, em último caso, para `Contrato importado` — nunca mais o nome do arquivo.
2. **Aditivos criados na importação**: prefixo `ADT` + número informado, usando as partes do próprio documento (ou do contrato principal, se o aditivo não trouxer).
3. **Contratos criados manualmente**: sugestão automática do título ao preencher contratante/contratada, ainda editável — sem sobrescrever se o usuário já digitou algo.
4. **Base existente**: uma ação opcional "Padronizar títulos" na grid de `/contracts`, aplicada só aos contratos selecionados, com pré-visualização do antes/depois. Nada é renomeado em massa automaticamente.

## Detalhes técnicos

- Novo módulo client-safe `src/lib/contracts/title.ts` com `buildContractTitle({ role, serviceType, documentKind, amendmentNumber, contractingName, counterpartyName, startsAt })` + helper `normalizePartyName` (uppercase, remoção de sufixos societários, colapso de espaços, truncamento).
- `src/lib/contracts/import.functions.ts`: em `createContractFromImport`, substituir `title: f.title?.trim() || "Contrato importado"` pela chamada a `buildContractTitle`, usando `contracting_name`/`counterparty_name` extraídos (fallback para a entidade própria já resolvida em `ownEntity`).
- `src/components/contracts/batch-import-contracts-dialog.tsx`: trocar `title: fields.title ?? item.file.name` pelo título gerado; manter `item.file.name` apenas como rótulo da linha na UI de progresso.
- Aditivos: aplicar o prefixo no mesmo ponto onde o `document_kind`/`amendment_number` já é definido no fluxo de importação.
- Formulário de contrato: preencher o campo título via `buildContractTitle` quando estiver vazio ou igual à sugestão anterior.
- Testes unitários de `buildContractTitle` (prestação, compra, aditivo, nomes longos, partes ausentes). Validações: typecheck, lint, build e testes.
