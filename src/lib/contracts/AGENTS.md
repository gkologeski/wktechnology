# Contratos

- Imported PDF bodies are read server-side (`pdf-body.server.ts`, unpdf) and every imported body passes `stripControlChars` before insert; why: browser pdf.js failed silently and NUL chars from PDFs make the database reject the whole body.
- Pending legacy discard is append-only and uses the caller's contract view/update/delete plus legacy-view access; why: originals and history must survive, while operationally linked or regularized contracts must not be discarded.
- Purchase contracts for a sale are created by `purchase-from-sale.server.ts` (user RLS, nested under the sale, reusing its proposal as annex, PJ or PF counterparty); why: one place in /contracts instead of the separate supplier-request area.
