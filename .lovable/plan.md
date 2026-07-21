## Objetivo

Ao configurar ações como "Criar Contrato" no Workflow Builder, exibir **todos os campos da entidade já renderizados** com seus inputs tipados (incluindo suporte a variáveis/pills), em vez do fluxo atual "Adicionar campo → escolher da lista → preencher".

## Mudanças

**Arquivo único:** `src/components/workflows/extra-fields-editor.tsx`

1. Renderizar **todos os campos do catálogo** (`catalog.filter(f => !hidden.has(f.name))`) diretamente, sem o Popover "Adicionar campo".
2. Cada campo aparece com seu `FieldInput` já pronto (Select/Switch/Datepicker/FkPicker/TokenInput) — o mesmo comportamento atual, mas visível de cara.
3. Manter agrupamento visual:
   - **Campos preenchidos** (com valor não-nulo) aparecem primeiro, destacados.
   - **Campos vazios** listados abaixo em uma seção "Outros campos" colapsável (para não poluir), já com input pronto — basta digitar/selecionar para começar a usar.
4. Persistência: escrever no `extraFields` só quando o usuário efetivamente insere valor (evita gravar `null` para todos os 30+ campos no JSON do workflow).
5. Manter suporte a `custom_fields` e o botão de remover valor (limpa a chave do JSON).
6. Manter o header colapsável do bloco e o contador de campos preenchidos.

## Fora de escopo

- Sem mudanças no catálogo de entidades (`entity-fields.functions.ts`), na engine, no schema ou em RLS.
- Sem alterações no `GenericRecordForm` — ele já usa `ExtraFieldsEditor` com `defaultOpen`.
- Sem mudanças nos formulários das ações específicas (create_activity, create_ticket, etc.) — o editor genérico usado por elas herda o novo comportamento automaticamente.

## Resultado

O usuário abre "Criar Contrato" (ou qualquer ação create/update genérica) e vê imediatamente todos os campos disponíveis prontos para preencher, com pills de variáveis em cada campo texto — sem cliques extras.
