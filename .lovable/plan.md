## Problema

Estando em `crm.wktechnology.com.br`, clicar em TechHire faz fallback SPA pra `/jobs` (sem trocar de host). Mas o menu continua mostrando TechSales porque `useActiveModule` em `src/lib/modules/active-module.ts` decide assim:

1. host → casa `^crm\.` → retorna `"crm"` (ganha aqui)
2. path → só é consultado se host não casou

Resultado: rota é ATS, menu é CRM.

## Correção (mínima, escopo: 1 arquivo)

Em `src/lib/modules/active-module.ts`, inverter a precedência para **path-first quando o path indica claramente outro módulo**:

```
moduloFinal =
  detectModuleFromPath(path)         // se path é claramente ATS → "ats"
  ?? detectModuleFromHost(hostname)  // senão, host
  ?? "crm"
```

Hoje só temos `ATS_PATH_PREFIXES`, então `detectModuleFromPath` retorna `"ats"` ou `null` — nunca retorna `"crm"` indevidamente. Path `/dashboard`, `/leads`, `/deals` continua caindo no host (ou no default `crm`). Path `/jobs`, `/candidates`, etc. força `ats` independente do host.

Isso resolve:
- `crm.*` + `/jobs` → menu ATS ✅
- `ats.*` + `/jobs` → menu ATS ✅ (host e path concordam)
- `crm.*` + `/deals` → menu CRM ✅
- preview/local + `/jobs` → menu ATS ✅ (já funcionava)

## Fora de escopo

- Sem mexer em RLS, schema, auth, server functions, regras de negócio.
- Sem alterar `HostRouterGuard`, `ModuleSwitcher`, `hosts.ts` (Wave anterior já estabilizou loop e fallback).
- Sem mexer no menu/sidebar — ele já reage a `useActiveModule`.

## Validação manual

1. Em `crm.wktechnology.com.br`, clicar em TechHire → URL vira `/jobs`, sidebar troca para itens ATS (Vagas, Candidatos, Pipelines…) e header mostra "TechHire ATS".
2. Voltar para `/dashboard` ou `/deals` → menu volta para TechSales.
3. Em `ats.wktechnology.com.br` (quando ativo) → comportamento inalterado.
