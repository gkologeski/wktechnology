## Objetivo

No detalhe do lead (`/leads/:id`), remover o card "Convertido em negócio" e passar a exibir a mesma dinâmica dos outros registros: um card **Contatos** e um card **Negócios** na coluna direita, com o mesmo visual e ações (abrir, desvincular) usados em contato/negócio.

## Escopo

Somente presentacional. Sem mudança de schema, RLS ou lógica de conversão. Continua-se lendo `leads.converted_contact_id` e `leads.converted_deal_id` como fonte dos vínculos existentes.

## Alterações

### `src/components/record/associations-panel.tsx`

1. Remover a renderização do `ConvertedFromLeadCard` do `AssociationsPanel` para `entity === "lead"` (a função em si pode ficar ou ser removida; será removida para evitar código morto).
2. Adicionar dois novos cards leves (somente leitura, no mesmo estilo visual de `ContactsCard`/`DealsCard`):
   - `LeadContactsCard`: mostra o contato vinculado via `leads.converted_contact_id` (0 ou 1 item). Reusa `AssocCard`, `EntityAvatar`, `DetailRow`, `AssocItemActions` e o footer "Exibir todos os Contatos associados".
   - `LeadDealsCard`: mostra o negócio vinculado via `leads.converted_deal_id` (0 ou 1 item). Mesma estrutura visual do `DealsCard` (valor, data de fechamento, pipeline, fase — fase e pipeline em modo somente leitura para não introduzir mutação nova nesse card do lead).
3. No `AssociationsPanel`, para `entity === "lead"`, renderizar na ordem: `CompanyCard` (já existente) → `LeadContactsCard` → `LeadDealsCard` → `TasksCard` → `EmailsCard` → `AttachmentsCard`.
4. Empty states: "Nenhum contato vinculado." / "Nenhum negócio vinculado." — mesmos textos usados nos cards equivalentes.

### Ações do item
- Abrir registro (link para `/contacts/$id` ou `/deals/$id`) via `AssocItemActions` já existente.
- **Sem** botão de desvincular nesta iteração (o vínculo vem da conversão do lead e desfazê-lo teria implicações fora do escopo desta task de UI).

## Fora do escopo
- Criar novos vínculos many-to-many entre lead ↔ contatos/negócios.
- Mudar comportamento da conversão de lead.
- Alterar schema, RLS ou queries de outras entidades.

## Validação manual
1. Abrir um lead já convertido (com `converted_contact_id` e `converted_deal_id` preenchidos) — deve exibir os dois cards com os dados do contato e do negócio, com o mesmo visual dos cards em `/contacts/:id` e `/deals/:id`.
2. Abrir um lead não convertido — os dois cards devem aparecer vazios ("Nenhum contato vinculado." / "Nenhum negócio vinculado.").
3. Confirmar que o antigo card "Convertido em negócio" não aparece mais.
