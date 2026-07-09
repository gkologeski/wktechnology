## Objetivo
Permitir editar uma cotação enquanto ela ainda estiver com status `draft` (rascunho), reaproveitando o mesmo dialog usado hoje para criação.

## Escopo
- Componente: `src/components/deals/deal-quotes.tsx` (única superfície onde as cotações são geridas hoje).
- Campos editáveis (os mesmos que já existem no dialog de criação e no server fn `updateQuote`):
  - Modelo de cotação (`template_id`)
  - Título (`title`)
  - Válida até (`valid_until`)
  - Observações (`notes`)
  - Termos e condições (`terms`)
- Fora do escopo: itens de linha da cotação, moeda, número, itens copiados do negócio (o usuário não pediu).

## Mudanças

1. **Dialog em modo dual (criar/editar)** em `deal-quotes.tsx`:
   - Adicionar estado `editingId: string | null` além do `draft`.
   - Título do dialog dinâmico: "Nova cotação" ou "Editar cotação".
   - Botão principal chama `createMut` quando `editingId` é null, senão chama `updateMut`.
   - Ao fechar, resetar `editingId` e `draft`.

2. **Ação "Editar" no dropdown do card**:
   - Aparece apenas quando `status === "draft"` (cotações enviadas/aceitas/recusadas/expiradas permanecem imutáveis).
   - Ao clicar, popula `draft` com os valores atuais da cotação (`title`, `valid_until`, `notes`, `terms`, `template_id`) e abre o dialog em modo edição.

3. **Mutation de update**:
   - `updateMut` usando o `useServerFn(updateQuote)` já importado, enviando `{ id: editingId, patch: { title, valid_until, notes, terms, template_id } }`.
   - `valid_until` normalizado: string vazia vira `null`.
   - `template_id`: string vazia vira `null`.
   - Em `onSuccess`: toast "Cotação atualizada.", fechar dialog, invalidar `["deal-quotes", dealId]`.

4. **UX**:
   - Não alterar comportamento existente (criar, marcar enviada/aceita, gerar link etc.).
   - Não expor "Editar" quando a cotação já saiu do rascunho, para evitar mudar termos após envio ao cliente.

## Validação manual
- Abrir um negócio com cotação em rascunho → menu "…" → "Editar" → alterar título/observações/termos → salvar → card reflete mudança e reabrir mostra valores persistidos.
- Cotações com status `sent`/`accepted`/`declined`/`expired` não devem exibir a opção "Editar".
- Criar uma nova cotação continua funcionando exatamente como antes.

## Riscos
- Baixo: alteração restrita a um componente de UI + reuso de server fn já existente (`updateQuote`), sem tocar em RLS, schema ou lógica de negócio.
