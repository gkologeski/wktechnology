## Problema

**1) Menus do TechHire voltam para TechSales**
`src/lib/modules/active-module.ts` detecta o módulo ATS por path apenas com 3 prefixos:
```
const ATS_PATH_PREFIXES = ["/jobs", "/candidates", "/ats"];
```
Rotas como `/pipelines`, `/scorecards`, `/interview-kits`, `/offers`, `/stage-emails`, `/match-scores`, `/fraud-flags`, `/insights`, `/dei-analytics` não estão na lista → `useActiveModule()` cai no default `"crm"` → `AppSidebar` troca para `SIDEBAR_GROUPS` (TechSales) assim que a navegação se assenta.

**2) Página de Carreiras abre fora do shell**
O item aponta para `/careers`, que é rota pública (não fica sob `_authenticated`), então renderiza sem sidebar/header.

## Correções

### A) Ampliar a detecção de módulo ATS
Em `src/lib/modules/active-module.ts`, adicionar todos os paths exclusivos do TechHire:
```ts
const ATS_PATH_PREFIXES = [
  "/jobs",
  "/candidates",
  "/ats",
  "/pipelines",
  "/scorecards",
  "/interview-kits",
  "/offers",
  "/stage-emails",
  "/match-scores",
  "/fraud-flags",
  "/insights",
  "/dei-analytics",
];
```
(Conferir nomes finais com `src/lib/menu-config-ats.ts` antes de aplicar para não esquecer nenhum item.)

### B) Página de Carreiras dentro do shell
`/careers` é a página pública dos candidatos — não deve substituir o shell autenticado. Duas opções:

- **Opção 1 (recomendada):** trocar o item do menu para abrir em nova aba (`target="_blank"`) com rótulo "Ver site público de Carreiras". Mantém o app principal intacto e deixa claro que é uma visualização externa. Requer um pequeno ajuste no item de menu do ATS para suportar `external: true` e o `AppSidebar` renderizar `<a target="_blank">` quando presente.
- **Opção 2:** criar `/_authenticated/careers-admin` que renderiza a listagem pública embutida (iframe ou reuso do componente) dentro do shell. Mais trabalho e duplica UI.

Sugiro Opção 1.

## Arquivos afetados
- `src/lib/modules/active-module.ts` — ampliar `ATS_PATH_PREFIXES`.
- `src/lib/menu-config-ats.ts` — marcar item "Página de Carreiras" como `external: true`.
- `src/components/app-sidebar.tsx` — renderizar `<a target="_blank" rel="noopener">` quando `item.external`.

## Validação
1. Navegar em `/pipelines`, `/scorecards`, `/interview-kits`, `/offers`, `/stage-emails`, `/match-scores`, `/fraud-flags`, `/insights`, `/dei-analytics` — sidebar continua ATS.
2. Clicar "Página de Carreiras" — abre `/careers` em nova aba; shell ATS permanece.
