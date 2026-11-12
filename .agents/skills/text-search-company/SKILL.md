---
name: text-search-company
description: Campo de busca de empresa por texto (CompanyPicker) com sugestões "Empresas parecidas", vínculo por company_id e criação rápida. Use sempre que um formulário do TechERP precisar escolher ou vincular uma Empresa (contato, lead, negócio, cotação), em vez de select ou input livre.
---

# Busca de empresa por texto (CompanyPicker)

Componente oficial: `@/components/ui/company-picker` (`CompanyPicker`). Reutilize-o; nunca crie outro campo de empresa. Código de referência em `references/company-picker.tsx`.

## Contrato
```ts
type CompanyPickerValue = { id: string | null; name: string };
<CompanyPicker value={company} onChange={setCompany}
  mode="pick_or_create" // ou "pick"
  onCreateNew={(name) => abrirQuickCreateCompany(name)} />
```
- `pick`: só aceita empresa existente (FK `company_id`).
- `pick_or_create`: aceita texto livre e mostra "Criar “nome”" quando nada é encontrado (use `QuickCreateCompanyDialog` de `@/components/record/quick-create-dialogs`).
- Grave `company_id: value.id` e, se a tabela tiver, `company_name: value.name.trim() || null`.

## Regras (não alterar)
1. Busca a partir de 2 caracteres, debounce de 300 ms.
2. Sanitizar o termo (remover `, ( ) %`) antes do `.or()` do PostgREST.
3. Procurar em `name`, `domain` e `phone` com `ilike`, ordenado por nome, limite 500, pelo cliente do usuário (RLS decide o que aparece).
4. Em paralelo chamar a RPC `rep_find_companies` (cargos restritos acham empresas de outra carteira só por id/nome, sem duplicar); mesclar sem repetir ids.
5. Com empresa vinculada (`id`), não mostrar sugestões; digitar de novo desvincula.
6. Mostrar o selo "Vinculada a <nome>", lista "Empresas parecidas" (nome + domínio · telefone), botão "Limpar" com `aria-label`.
7. Erro de busca não vira "nenhuma encontrada" silenciosa de outra regra; não ler dados fora da RLS.
8. Apenas tokens semânticos; textos em PT-BR.
