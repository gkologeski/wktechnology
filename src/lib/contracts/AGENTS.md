# Contratos

- Imported PDF bodies are read server-side (`pdf-body.server.ts`, unpdf) and every imported body passes `stripControlChars` before insert; why: browser pdf.js failed silently and NUL chars from PDFs make the database reject the whole body.
- Pending legacy discard is append-only and uses the caller's contract view/update/delete plus legacy-view access; why: originals and history must survive, while operationally linked or regularized contracts must not be discarded.
- Purchase contracts for a sale are created by `purchase-from-sale.server.ts` (user RLS, nested under the sale, reusing its proposal as annex, PJ or PF counterparty); why: one place in /contracts instead of the separate supplier-request area.
- Purchase payables are proposed by pure `purchase-payables.ts` and only created by Finance through the `contract_purchase_payables_generate` RPC after signature; why: no automatic finance entries and one idempotent, sum-checked path.
- Purchase contract term is suggested by pure `purchase-term.ts` (start not in the past; end = latest of sale, active amendments, linked project due date); why: the supplier must cover the delivery period without retyping.
- A purchase contract may serve several sales: primary = parent_contract_id, extra sales only via `contract_purchase_sale_set` into `contract_purchase_sales`; why: one supplier contract can cover a sale plus amendments with their own deals without moving the nesting.
- Main contracts show consolidated terms from active amendments via pure `effective-terms.ts` (end date, monthly value, hours/month, notice and scope replaced when different, even shorter; value and hour packages summed; amendment start never replaces the contract start); why: one rule for the contract page and next-step deadline.
