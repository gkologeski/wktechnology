## Objetivo

Na tela de detalhe do Lead, quando o lead já foi qualificado (convertido em negócio), exibir o **negócio associado** (e opcionalmente o contato criado), com link para abrir o registro.

Hoje, ao qualificar um lead, `convertLead` já grava em `leads`:
- `status = 'qualified'`
- `converted_at`
- `converted_contact_id`
- `converted_deal_id`

Mas o painel direito do lead (`AssociationsPanel entity="lead"`) não mostra nada sobre o deal/contato resultantes.

## Escopo

- Exibir o negócio associado (e o contato) no painel direito de `/leads/$id` quando o lead estiver convertido.
- Somente leitura + link "Abrir". Sem alterar `convertLead`, sem alterar schema/RLS, sem alterar fluxo de qualificação.

Fora do escopo: mudar o dialog de conversão, criar/reassociar deals a partir do lead, tocar em outras entidades.

## Alterações

**`src/components/record/associations-panel.tsx`**

- Adicionar um novo card `ConvertedFromLeadCard` que só renderiza quando `entity === "lead"`.
- O card recebe `entityId` (leadId), busca em `leads` os campos `converted_contact_id, converted_deal_id, converted_at, status` e, se houver `converted_deal_id`, faz join/select em `deals(id, name, value, currency, stage)` e em `contacts(id, first_name, last_name)` para o `converted_contact_id`.
- Renderiza:
  - Se não convertido → não mostra o card (evita ruído).
  - Se convertido → dois blocos compactos:
    - **Negócio**: nome (link `/deals/$id`), valor formatado (`formatCurrency`), stage como badge. Botão `Eye` para abrir.
    - **Contato criado** (se houver): nome (link `/contacts/$id`).
  - Rodapé: `Convertido em {formatDateTime(converted_at)}`.
- Reusa `AssocCard`, `EntityAvatar`, `AssocItemActions` (só `link`, sem `onUnlink` — a associação de conversão é histórica, não desvinculável aqui).

**`src/routes/_authenticated/leads.$id.tsx`**

- Nenhuma mudança de layout. O card aparece automaticamente porque já se usa `<AssociationsPanel entity="lead" entityId={lead.id} />`.
- Após qualificar (quando `CreateDealFromLeadDialog` chama `onCreated`), o `load()` do lead já é disparado, o que faz o `AssociationsPanel` remontar/recarregar e o novo card aparece.

## Detalhes técnicos

- Cliente Supabase browser (mesmo padrão dos demais cards do arquivo). RLS já filtra deals/contacts do usuário.
- Consulta em duas etapas simples (sem depender de FK inferida pelo PostgREST):
  1. `select converted_contact_id, converted_deal_id, converted_at from leads where id = :leadId`
  2. Se `converted_deal_id`: `select id, name, value, currency, stage from deals where id = ...`
  3. Se `converted_contact_id`: `select id, first_name, last_name from contacts where id = ...`
- Se o deal foi excluído posteriormente (retorno vazio), o card mostra estado "Negócio removido" só com a data de conversão, ainda sem link quebrado.

## Validação

- `bunx tsgo --noEmit`
- Manual: abrir um lead ainda `new` → não aparece card. Qualificar via botão de status → depois de confirmar, o card "Convertido em negócio" aparece com link para `/deals/$id`. Abrir um lead já qualificado antigo → card aparece direto.

## Riscos

- Nenhum impacto em regras de negócio ou RLS; alteração puramente aditiva na UI.
- Se um lead tiver `status = qualified` sem `converted_deal_id` (dados legados de conversão manual), o card só mostra a data de conversão ou nada — não quebra a página.
