# Prefixos de título em português, entre colchetes

Trocar os prefixos siglados (`CPS`, `CC`, `CD`, `CM`, `CCO`, `CL`, `ADT`) por rótulos legíveis entre colchetes.

## Novo formato

- Prestação (nosso CNPJ é CONTRATADA): `[PRESTAÇÃO] CONTRATANTE X CONTRATADA — 2026`
- Compra (nosso CNPJ é CONTRATANTE): `[COMPRA] CONTRATANTE X CONTRATADA — 2026`
- Aditivo: prefixo próprio na frente, com número quando existir:
  `[ADITIVO 1] [PRESTAÇÃO] GRALHA IMÓVEIS X WK TECHNOLOGY — 2026`
- Tipos de serviço específicos ganham rótulo em português no lugar da sigla:
  desenvolvimento → `[DESENVOLVIMENTO]`, manutenção → `[MANUTENÇÃO]`,
  consultoria → `[CONSULTORIA]`, licenciamento → `[LICENCIAMENTO]`.
  Sem tipo identificado, cai para `[PRESTAÇÃO]`.

O resto do padrão não muda: partes em maiúsculas, sem sufixos societários, truncadas em 40 caracteres, sufixo do ano da vigência.

## Onde aplica

Um único ponto de montagem (`buildContractTitle`) já é usado por importação em massa, importação individual, formulário de contrato e a ação "Padronizar títulos" da grid de `/contracts` — então a troca vale automaticamente para todos. Contratos já existentes só mudam de título quando o usuário rodar "Padronizar títulos" nos selecionados (com pré-visualização antes/depois); nada é renomeado em massa sem ação.

## Detalhes técnicos

- `src/lib/contracts/title.ts`: substituir `SERVICE_PREFIX` pelos rótulos entre colchetes, `prefixFor` retornar `[COMPRA]` para `role === "client"`, e o bloco de aditivo montar `[ADITIVO N]`/`[ADITIVO]`.
- `src/lib/contracts/__tests__/title.test.ts`: atualizar as expectativas dos casos de prestação, compra, aditivo, tipo de serviço e sufixo de ano.
- Validações: `vitest run` dos testes de título, typecheck, lint e build.
