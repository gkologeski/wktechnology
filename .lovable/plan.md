## Problema

No `ExtraFieldsEditor` (workflow), os campos carregados via `getEntityFieldCatalog` seguem uma ordem "amigável" própria (select → outros → data, depois alfabético por label). Isso não bate com a ordem que o usuário vê nos formulários reais de criação (ex.: QuickCreateContractDialog, criar deal, criar contato), causando estranheza.

## Objetivo

Fazer com que a ordem dos campos no editor de ações do workflow espelhe a ordem canônica dos formulários de criação de cada entidade, para que o usuário reconheça a sequência.

## Abordagem

1. **Definir ordem canônica por entidade** em um novo arquivo `src/lib/workflows/entity-field-order.ts`:
   - Mapear, por entidade suportada (`contracts`, `deals`, `contacts`, `companies`, `leads`, `tickets`, `activities`, `projects`, `project_tasks`, `financial_entries`, `quotes`, `proposals`, `products`, `services`, `ats_jobs`, `ats_candidates`, etc.), a lista ordenada dos campos principais espelhando o respectivo formulário de criação (ler `quick-create-*`, `create-*-dialog.tsx` e páginas de criação para extrair a ordem real).
   - Ex. `contracts`: title, contract_number, role, type, status, contact_id, company_id, deal_id, parent_contract_id, value, currency, start_at, end_at, description...
   - Campos não listados na ordem canônica caem depois, mantendo o ordenamento atual como fallback.

2. **Aplicar a ordem** onde os campos são consumidos:
   - Em `src/components/workflows/extra-fields-editor.tsx` (e/ou onde o array de fields do catálogo é iterado para renderização), reordenar `fields` com base no mapa canônico antes de agrupar/renderizar.
   - Preservar o layout personalizado do usuário (via `field-layout.ts`) quando existir — a nova ordem só vale para o grupo padrão / entidades sem layout salvo.

3. **Não alterar** `getEntityFieldCatalog` no servidor (a ordem "amigável" continua sendo o fallback para entidades sem mapa canônico e para o filter builder que também consome esse endpoint).

## Arquivos

- Criar: `src/lib/workflows/entity-field-order.ts`
- Editar: `src/components/workflows/extra-fields-editor.tsx` (aplicar reordenação antes de renderizar; manter respeito ao layout persistido)

## Validação

- Abrir uma ação "Criar Contrato" no workflow builder e conferir que a ordem dos campos bate com o `QuickCreateContractDialog`.
- Repetir para "Criar Negócio", "Criar Contato", "Criar Ticket".
- Confirmar que entidades sem mapa canônico continuam funcionando (fallback = ordem atual).
- Confirmar que layouts personalizados salvos continuam sendo respeitados.
