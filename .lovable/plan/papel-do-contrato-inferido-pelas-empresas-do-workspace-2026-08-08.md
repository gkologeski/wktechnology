# Papel do contrato inferido pelas empresas do workspace

Objetivo: parar de confiar no campo `role` que a IA grava na importação e passar a derivar o papel (somos CONTRATANTE ou CONTRATADA) das empresas do próprio workspace — na importação e, em lote, nos contratos já importados.

## Achado importante antes de implementar

Consultei a base do workspace:

- As 7 empresas em `legal_entities` (GM Kologeski, CW Kologeski, CMK Kologeski, WK Technology, Polo, Kologeski & Kologeski, Fluxo) estão **todas sem CNPJ preenchido**. Nenhum contrato casa por CNPJ hoje.
- Casando por **nome** das partes extraídas: dos 157 contratos, **36 estão com papel divergente** (20 gravados como Compra onde somos a CONTRATADA, 16 gravados como Prestação onde somos a CONTRATANTE), 59 estão coerentes e 62 não têm nome de parte extraído suficiente para decidir.

Ou seja: inferir "exclusivamente pelos CNPJs" hoje não decide nada. O plano usa CNPJ como evidência primária e nome normalizado como evidência secundária, e sinaliza na tela de contratos divergentes que preencher os CNPJs das empresas aumenta a precisão.

## O que será feito

### 1. Importação passa a decidir o papel pelas nossas empresas

Na criação do contrato importado, o papel deixa de vir do `role` da IA quando há evidência das partes:

- nossa empresa aparece como CONTRATADA ⇒ Prestação;
- nossa empresa aparece como CONTRATANTE ⇒ Compra;
- sem evidência (nenhum lado casa, ou os dois casam) ⇒ mantém o `role` extraído como hoje.

Quando o papel inferido diferir do extraído, o contrato guarda essa origem nos metadados (`role_source`, `role_extracted`) para auditoria, e o aviso entra na lista de avisos de importação. O título padronizado (CPS/CC) passa a usar o papel inferido, ficando coerente com as partes.

Vale para o fluxo unitário e para a importação em massa, já que ambos passam pela mesma criação.

### 2. Reprocessamento em lote dos contratos já importados

Nova ação "Recalcular papéis" em `/contracts/links`, ao lado de "Analisar com IA":

1. Roda um diagnóstico e mostra um resumo antes de alterar: quantos contratos estão coerentes, quantos divergentes (com lista de número, título, papel gravado e papel inferido) e quantos sem evidência.
2. O usuário confirma e escolhe se o título padronizado também deve ser regravado.
3. A correção é aplicada apenas nos divergentes, registrando um evento em `contract_events` por contrato (papel anterior, novo papel, evidência usada e quem executou).

Nada é alterado sem confirmação explícita e contratos sem evidência ficam intocados. Também fica disponível a correção individual do próprio card de contratos divergentes, para tratar um por um.

### 3. Coerência com a análise de vínculos

A análise de vínculos por IA já usa o papel inferido. Depois do reprocessamento, os avisos de "Papel divergente — revisar" devem desaparecer para os contratos corrigidos; contratos sem evidência continuam mostrando o aviso quando aplicável.

## Detalhes técnicos

- `src/lib/contracts/link-suggest.ts`: reaproveitar `inferRoleFromParties` / `effectiveRole` (já existem e são puros). Nenhuma regra nova de papel é criada.
- `src/lib/contracts/import.functions.ts` (`createContractFromImport`): carregar as entidades do workspace uma vez, montar o `ContractLinkMeta` a partir dos campos extraídos e usar `inferRoleFromParties(...) ?? f.role ?? "provider"` como `role`. Passar esse papel para `buildContractTitle`. Gravar `metadata.role_source = "inferred" | "extracted"` e `metadata.role_extracted`.
- Novo `src/lib/contracts/role-recalc.functions.ts` com duas server functions autenticadas (`requireSupabaseAuth`), permissão `techcontracts.contracts.update.*`:
  - `diagnoseContractRoles` — lê `id, number, title, role, metadata` do workspace, devolve `{ coherent, unknown, conflicts: [...] }` sem escrever;
  - `recalcContractRoles` — recebe os ids a corrigir e `retitle: boolean`, atualiza `role` (e opcionalmente `title` via `buildContractTitle`) e insere em `contract_events` um evento `role_recalculated` com `{ from, to, evidence, source: "role-recalc" }`.
- UI: card/diálogo em `src/routes/_authenticated/contracts.links.tsx` reutilizando os componentes oficiais (`DataTable`/lista, `StatusBadge`, `EmptyState`, `LoadingSkeleton`, `ErrorState`), pt-BR, dark mode, confirmação para a ação destrutiva.
- Testes em `src/lib/contracts/__tests__/link-suggest.test.ts` (ou arquivo irmão) cobrindo: papel inferido sobrepõe o extraído, fallback quando não há evidência, e seleção de contratos divergentes no diagnóstico.
- Sem alteração de schema, RLS ou permissões.
