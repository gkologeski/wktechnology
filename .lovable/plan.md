## Contexto

O “controle de empresa” é o componente `CompanyPicker` (`src/components/ui/company-picker.tsx`). Ele já suporta criação inline via prop `onCreateNew` + `QuickCreateCompanyDialog`, mas em vários lugares essa prop **não está conectada**, então quando a empresa não é encontrada o usuário não consegue criá-la de dentro do próprio campo.

## Mapeamento das ocorrências

Levantamento via `rg "CompanyPicker" src/`:

| Local | Status atual | Ação |
| --- | --- | --- |
| `src/components/leads/create-lead-dialog.tsx` (linha 233) | Já usa `onCreateNew` + `QuickCreateCompanyDialog` | Nenhuma — referência de padrão |
| `src/components/contacts/create-contact-dialog.tsx` (linha 178) | Sem `onCreateNew` | Adicionar criação inline |
| `src/components/properties-panel.tsx` – edição inline (linha 325) | Sem `onCreateNew` | Adicionar criação inline |
| `src/components/properties-panel.tsx` – diálogo “Ver todas as propriedades” via `CompanyFieldAll` (linha 719) | Sem `onCreateNew` | Adicionar criação inline |

Fora do escopo (usam `EntityCombobox` de companies, não o `CompanyPicker`): `workflow-builder`, `quick-create-contract-dialog`, `deal-detail-drawer`, `quick-create-dialogs`, `associations-panel`, `create-deal-from-lead-dialog`, rota `companies.$id.tsx`, rota `tickets.tsx`. Esses controles têm outra semântica (seleção estrita/associação) e ficam preservados sem alteração — o `AddAssociation` do painel de associações já expõe “Criar novo” separado, então não trava a operação.

## Mudanças

Padrão único (mesmo já usado em `create-lead-dialog`):

```tsx
const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
const [pendingCompanyName, setPendingCompanyName] = useState("");
// ...
<CompanyPicker
  ...
  onCreateNew={(name) => {
    setPendingCompanyName(name);
    setCreateCompanyOpen(true);
  }}
/>
<QuickCreateCompanyDialog
  open={createCompanyOpen}
  onOpenChange={setCreateCompanyOpen}
  initialName={pendingCompanyName}
  onCreated={({ id, name }) => { /* set value + persist */ }}
/>
```

### 1. `src/components/contacts/create-contact-dialog.tsx`
- Importar `QuickCreateCompanyDialog`.
- Adicionar estado local para o diálogo e o nome pendente.
- Plugar `onCreateNew` no `CompanyPicker` existente.
- No `onCreated`, atualizar `setCompany({ id, name })` para o form salvar com o `company_id` já vinculado (comportamento consistente com o create-lead).

### 2. `src/components/properties-panel.tsx`
- Importar `QuickCreateCompanyDialog`.
- Adicionar `createCompanyOpen` / `pendingCompanyName` e um handler `handleCompanyCreated` no componente raiz.
- Bloco de edição inline (`p.type === "company"`, linha 325): passar `value={{ id: null, name: value }}` com `onCreateNew`, e no `handleCompanyCreated` gravar o nome no campo (`p.key`) e chamar `save(p.key)`. Se `table === "leads"` também atualizar `company_id` na mesma persistência (mantém a correção anterior de vínculo estruturado).
- `CompanyFieldAll` (linha 689): aceitar nova prop `onCreateNew` e repassar ao `CompanyPicker`; reaproveitar o mesmo `QuickCreateCompanyDialog` renderizado uma única vez no componente raiz.
- Renderizar `<QuickCreateCompanyDialog />` uma única vez no final do JSX do `PropertiesPanel`.

### 3. Nenhuma mudança em `CompanyPicker`, `QuickCreateCompanyDialog` ou schema.

## Verificação

- `tsgo` (typecheck).
- Manual: em `/leads/:id`, `/contacts/:id` (e demais telas que usam `PropertiesPanel` com `type: "company"`) e no diálogo Novo Contato — digitar um nome inexistente, ver “Criar «Nome»” dentro do campo, criar via popup, confirmar que o registro passa a exibir o vínculo com a empresa sem precisar sair da tela.

## Fora do escopo

- `EntityCombobox` de companies (associações, workflows, contratos, deals, tickets, rota de company).
- Ajustes de RLS, schema ou lógica de negócio.
