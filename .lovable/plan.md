# Wizard de Cotação

Substituir o `Dialog` atual de "Nova cotação" (`src/components/deals/deal-quotes.tsx`) por um wizard em várias telas, que salva progressivamente a cada avanço e, na etapa final, oferece três ações: **Salvar como rascunho**, **Publicar** ou **Publicar e enviar**.

## Fluxo (etapas)

1. **Modelo & Identificação** — modelo de cotação, título, validade.
2. **Itens de linha** — reaproveitar o editor existente (`DealLineItems`) embutido como passo, exibindo subtotal/impostos/desconto/total calculados.
3. **Observações & Termos** — `RichHtmlEditor` para observações e termos e condições.
4. **Revisão & Publicação** — resumo (cliente/empresa, validade, totais, link público após publicação) e três ações finais.

Barra de progresso no topo (steps clicáveis apenas para etapas já visitadas). Botões `Voltar` / `Avançar` no rodapé. `Cancelar` fecha mantendo o que já foi salvo.

## Autosave

- Ao clicar **Avançar** na etapa 1, se ainda não existe cotação para a sessão do wizard, cria via `createQuoteFromDeal` (status `draft`) e guarda `quoteId` no estado local. As etapas seguintes usam `updateQuote` (patch parcial) ao avançar.
- Etapa 2 (itens) já persiste imediatamente através das mutations existentes de `deal_line_items`; ao avançar, chama uma nova função `recomputeQuoteTotals({ id })` para sincronizar totais do quote com os itens atuais do deal.
- Etapa 3 salva `notes`/`terms` via `updateQuote` ao avançar.
- Debounce/indicador "Salvando…" ao lado do título do wizard; falha exibe toast e mantém o usuário na etapa.

## Ações finais (etapa 4)

- **Salvar como rascunho**: fecha o wizard, mantém `status = draft`.
- **Publicar**: `updateQuote` → `status = 'sent'`, `sent_at = now()`, copia link público para clipboard e mostra toast com o link.
- **Publicar e enviar**: publica (idem acima) e abre em seguida o `SendEmailDialog` já existente pré-preenchido com destinatário do contato principal do deal, assunto `"Cotação {number} — {title}"` e corpo contendo o link público. Após o envio, fecha o wizard.

## Edição

Editar uma cotação em `draft` (item já existente no menu) reabre o mesmo wizard começando na etapa 1 com `quoteId` pré-carregado (nenhum insert é feito; apenas patches). Cotações não-draft permanecem somente-leitura como hoje.

## Detalhes técnicos

- Novo arquivo `src/components/deals/quote-wizard.tsx` contendo:
  - `QuoteWizard({ dealId, quoteId?, onClose })` renderizado dentro de um `Dialog` largo (`sm:max-w-3xl`).
  - Componente interno `Stepper` (usa tokens semânticos do design system).
  - Sub-componentes por etapa: `StepBasics`, `StepItems`, `StepNotes`, `StepReview`.
- `src/lib/quotes.functions.ts`: adicionar `recomputeQuoteTotals` (recebe `id`, lê `quote_line_items`, aplica `recompute`, dá `update` no `quotes`). Permitir `updateQuote` também atualizar itens via ID já é desnecessário — usar a função nova.
- `src/components/deals/deal-quotes.tsx`: remover o `Dialog` inline atual e trocar `openDialog` / `openEditDialog` por abrir o `QuoteWizard`. Botão "Adicionar" e item "Editar" (draft) passam a acionar o wizard.
- Não alterar RLS, schema (nenhuma migration necessária), nem o modal de itens de linha em si — apenas incorporá-lo como passo.
- Manter os states loading/error/empty já presentes no editor de itens.
- Acessibilidade: `role="dialog"`, foco no primeiro campo de cada etapa, `aria-current="step"` no stepper, botões com labels claras.
- Responsividade: stepper vertical em telas <640px.

## Fora de escopo

- Não alterar templates de cotação, nem função pública `getQuoteByToken`.
- Não mexer em pagamento (Stripe) — segue disponível no menu de contexto do card.
- Não redesenhar o card de cotação na lateral do deal.

## Validação

- `bunx tsc --noEmit`
- `bun run build:dev`
- Verificação manual: criar cotação em um deal com itens, avançar pelas 4 etapas confirmando autosave em cada uma, testar as 3 ações finais e reabrir para editar um rascunho.
