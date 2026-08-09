# Preencher CNPJs das empresas e reprocessar contratos ao salvar

## Situação atual (verificada)

- As 7 empresas do workspace estão sem CNPJ: CMK Kologeski, CW Kologeski, Fluxo, GM Kologeski & Cia, Kologeski & Kologeski, Polo, WK Technology.
- Os CNPJs das nossas empresas já existem nos contratos importados (chaves `*_cnpj_extracted` em `contracts.metadata`). Candidatos por ocorrência:
  - CMK KOLOGESKI LTDA — 45.009.766/0001-75 (71 contratos)
  - GM KOLOGESKI & CIA LTDA — 19.133.530/0001-36 (52 contratos)
  - CW KOLOGESKI LTDA — 42.296.945/0001-42 (29 contratos)
  - Fluxo, Polo, Kologeski & Kologeski e WK Technology não têm CNPJ nos contratos — precisam ser digitados.
- Já existem as funções de diagnóstico e correção em lote de papéis (`diagnoseContractRoles` / `recalcContractRoles`), hoje acionadas apenas pelo botão em `/contracts/links`.
- Bug encontrado na tela de empresas: o formulário de edição carrega os dados da listagem resumida, que não traz `trade_name`, `ie` e `im`; ao salvar, esses campos são apagados. Isso atinge diretamente o fluxo de preencher CNPJ.

## O que será construído

### 1. Assistente "Preencher CNPJs" em Configurações › Empresas

Um diálogo com uma linha por empresa do workspace contendo:

- campo de CNPJ com máscara `00.000.000/0000-00` e validação de dígito verificador;
- quando houver candidato vindo dos contratos, um botão "Usar 45.009.766/0001-75 · 71 contratos" para preencher com um clique, e "Preencher todos os sugeridos" no topo;
- aviso quando o mesmo CNPJ for informado para duas empresas;
- salvar apenas as empresas alteradas.

```text
Preencher CNPJs das empresas                       [Preencher todos os sugeridos]
CMK Kologeski Ltda    [45.009.766/0001-75]  sugerido em 71 contratos  [usar]
CW Kologeski Ltda     [__.___.___/____-__]  sugerido em 29 contratos  [usar]
WK Technology         [__.___.___/____-__]  sem sugestão
...
[x] Regravar títulos dos contratos corrigidos      [Cancelar] [Salvar e reprocessar]
```

### 2. Reprocessamento automático ao salvar

Ao confirmar, na mesma ação:

1. grava os CNPJs informados;
2. roda o diagnóstico de papéis com as empresas já atualizadas;
3. corrige automaticamente todos os contratos cujo papel gravado divergir do papel inferido pelos CNPJs (opcionalmente regravando o título — marcado por padrão);
4. registra `role_recalculated` em `contract_events` para cada contrato corrigido, como já acontece hoje;
5. mostra o resultado ("3 empresas atualizadas · 41 contratos corrigidos") e um resumo com link para `/contracts/links`.

Contratos sem evidência das partes continuam intocados; nada é alterado sem confirmação explícita nesse diálogo.

### 3. Correção do formulário de empresas

O formulário de edição passa a carregar a empresa completa antes de abrir, para não apagar nome fantasia, IE e IM ao salvar apenas o CNPJ.

## Detalhes técnicos

- `src/lib/legal-entities.functions.ts`: nova `suggestLegalEntityCnpjs` (lê nomes/CNPJs extraídos dos contratos do workspace, normaliza os nomes com `normalizeEntityName` e casa com as empresas, devolvendo candidato + contagem); nova `getLegalEntity` para o formulário completo; nova `fillLegalEntityCnpjsAndRecalc` que valida os CNPJs, faz o update em lote e chama internamente a lógica de recálculo — reaproveitando os helpers de `role-recalc` extraídos para `role-recalc.server.ts` para não duplicar regra nem chamar server fn de dentro de server fn. Todas com `requireSupabaseAuth` + permissão de atualização (empresas e contratos).
- `src/lib/cnpj.ts` (novo, puro): `formatCnpj`, `onlyDigits`, `isValidCnpj` (dígitos verificadores) — com testes em `src/lib/__tests__/cnpj.test.ts`.
- `src/components/finance/legal-entity-cnpj-fill-dialog.tsx` (novo): diálogo com `Dialog`, `Input`, `Checkbox`, `Badge`, `LoadingSkeleton`, `EmptyState` e `ErrorState`, pt-BR, dark mode, foco visível e labels acessíveis.
- `src/components/finance/legal-entities-page.tsx`: botão "Preencher CNPJs" no `PageHeader`, coluna CNPJ com formatação, e `openEdit` passando a buscar a empresa completa.
- Sem migration, sem alteração de RLS ou de schema.
- Validação: `tsgo --noEmit`, `eslint --fix` nos arquivos alterados e `vitest` (testes de CNPJ + suíte de contratos existente).
