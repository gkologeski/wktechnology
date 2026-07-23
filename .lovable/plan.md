## Problema

`src/routes/_authenticated/settings.branding.tsx` renderiza abas apenas para `crm` e `ats`, mas o registro de módulos (`src/lib/modules/registry.ts`) define 7: `crm`, `ats`, `contracts`, `services`, `projects`, `finance`, `people`. Além disso, a server function `saveModuleBranding`/`getModuleBranding` em `src/lib/modules/module-branding.functions.ts` valida via Zod `z.enum(["crm","ats"])`, então mesmo se a UI expusesse mais abas o backend rejeitaria.

## Escopo

Expandir o branding por módulo para cobrir todos os módulos do registry, exceto `services` (que foi consolidado dentro de Contratos na decisão 1+2 anterior — não deve ter identidade visual própria no seletor).

Módulos com aba de branding após a correção: `crm`, `ats`, `contracts`, `projects`, `finance`, `people`.

## Alterações

1. **`src/lib/modules/module-branding.functions.ts`**
   - Trocar `const MODULE_IDS = ["crm", "ats"] as const;` por lista alinhada ao registry (sem `services`): `["crm","ats","contracts","projects","finance","people"]`.
   - Mantém o resto do handler intacto (upsert em `module_branding` por `workspace_id,module_id`).

2. **`src/routes/_authenticated/settings.branding.tsx`**
   - Gerar `TabsTrigger` e `TabsContent` iterando sobre a lista de módulos suportados, usando `MODULES[id].productName` como rótulo.
   - Manter a aba "Workspace (ERP)" como default.
   - Ajustar o texto descritivo para não citar apenas TechSales/TechHire.

## Fora de escopo

- Não alterar RLS nem schema de `module_branding` (a tabela já usa `module_id text`, aceita qualquer valor; a restrição estava só no Zod).
- Não incluir `services` (decisão prévia de consolidar em Contratos).
- Nenhuma mudança no `BrandingBuilder` (workspace ERP).

## Validação

- `bun run tsgo` para garantir tipos.
- Abrir `/settings/branding` e conferir as 6 abas de módulo + aba workspace; salvar em uma delas (ex. `contracts`) e recarregar para ver o valor persistido.