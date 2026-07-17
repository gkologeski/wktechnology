## Objetivo

Na tela de detalhe do Lead (`/leads/$id`), exibir na coluna direita o card "Empresa", com a mesma dinâmica dos cards já existentes em Contato e Negócio: buscar/vincular empresa existente, criar nova empresa, trocar, desvincular e ver detalhes (domínio, telefone, link para a página da empresa).

## Estado atual

- `AssociationsPanel` já tem um `CompanyCard` completo, mas hoje só aceita `entity: "contact" | "deal" | "ticket"` e atualiza `company_id` na tabela correspondente.
- A tabela `leads` **não tem** coluna `company_id` — hoje só existe `company_name` (texto). Ou seja, o vínculo formal com uma empresa do CRM não existe para leads.
- No `leads.$id.tsx`, o `AssociationsPanel` é renderizado com `entity="lead"` e o `CompanyCard` é explicitamente excluído para leads.

## Mudanças

### 1. Backend (migration mínima)

Adicionar suporte a vínculo real de empresa em leads:

- `ALTER TABLE public.leads ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;`
- Índice `CREATE INDEX ON public.leads(company_id);`
- Backfill best-effort: para leads com `company_name` preenchido, popular `company_id` quando existir uma `companies.name` idêntica (case-insensitive) dentro do mesmo `owner_id`. Deixar `NULL` quando não houver match.
- Sem alteração em RLS/GRANTs (herda das políticas atuais de `leads`, que já cobrem update do próprio owner).

### 2. `CompanyCard` (src/components/record/associations-panel.tsx)

- Ampliar o tipo `entity` do `CompanyCard` para incluir `"lead"`.
- Estender `tableFor` para mapear `lead → "leads"`.
- Nada mais muda: as operações `associate`, `unlink`, refresh e o dialog de período já funcionam de forma genérica.

### 3. `AssociationsPanel` dispatcher

- Passar a renderizar `<CompanyCard entity="lead" ... companyId={lead.company_id} />` quando `entity === "lead"`.

### 4. `leads.$id.tsx`

- Passar `companyId={lead.company_id}` para `AssociationsPanel`.
- Manter o link textual atual (empresa por nome) no cabeçalho como fallback quando `company_id` é nulo, sem alterar o cabeçalho quando já existir vínculo.

### 5. Sincronização `company_name` ↔ `company_id` (opcional, mínimo)

Quando o usuário vincular/desvincular via card:
- Ao vincular: se `leads.company_name` estiver vazio, preencher com o `name` da empresa escolhida. Se já tiver texto, preservar (não sobrescrever entrada do usuário).
- Ao desvincular: não mexer em `company_name`.

Isso mantém compatibilidade com telas e workflows que ainda leem `company_name`.

## Fora do escopo

- Não alterar policies RLS, não mexer em outras entidades.
- Não redesenhar o cabeçalho do lead nem o `PropertiesPanel` (a exibição de `company_name` como texto continua igual).
- Não migrar automaticamente todos os `company_name` para `company_id` além do backfill best-effort exato.

## Verificação

1. Build passa (typecheck).
2. Em `/leads/<id>`: card "Empresa" aparece na coluna direita, com "Adicionar" quando não há vínculo, mostrando dados quando vinculado, botão "Trocar" e ação "Remover associação".
3. Ao vincular uma empresa nova, ela também aparece no header (link) se antes não havia `company_name`.
