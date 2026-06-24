# Onda C — Ofertas com eSign + Parser de CV (PDF multimodal)

## Entregas

### Schema (migration aplicada)
- `ats_offers` (owner, candidate_id, application_id, job_id, title, body, salary, currency, start_date, status, esign_document_id, promote_to_stage, sent/signed/declined_at) + RLS por owner.
- Trigger `ats_offers_sync_on_esign` em `esign_signers`: quando todos assinam → oferta = signed e promove `ats_applications.stage_value` para `promote_to_stage`. Se algum signer recusa → oferta = declined.

### Server functions (`src/lib/ats/offers.functions.ts`)
- `listOffers` / `getOffer` / `createOffer` / `updateOffer` / `cancelOffer` / `deleteOffer`.
- `sendOffer`: cria documento eSign com o candidato como signatário único, marca como `sent` e linka `esign_document_id`. Cancela também o doc de eSign quando a oferta é cancelada.

### Parser de CV em PDF (multimodal)
- `src/lib/ats/cv-parse-pdf.functions.ts`: baixa o PDF da URL assinada, encaminha como `type: file` para o Lovable AI Gateway (Gemini 2.5 Flash) com `response_format=json_object`, e devolve o mesmo schema de `parseCv`.
- `candidates.tsx`: quando o upload do PDF tem URL, prefere o parser server-side (mais preciso, dispensa pdfjs no browser).

### UI
- Rota nova `/offers`: tabela completa (candidato, vaga, salário, status, ações enviar/cancelar/excluir).
- Botão "Nova oferta" no `ScorecardEvalDialog` (mostra apenas quando `candidateId` está disponível) → abre `CreateOfferDialog`.
- `CreateOfferDialog`: título, salário/moeda, data de início, texto livre, ações "Salvar rascunho" e "Salvar e enviar".
- Sidebar ATS: novo grupo "Contratação" com item "Ofertas".

## Validação
- `tsgo --noEmit`: OK
- Migration: OK (warnings pré-existentes).

## Próximos passos sugeridos
- Página `/offers/[id]` com timeline do eSign (audit) e link público para o candidato.
- Webhook/cron de lembrete para ofertas enviadas sem ação em N dias.
- Templates de oferta reutilizáveis (similar a `quote_templates`).
- Admin público da página de carreiras (logo, cores, descrição da empresa).
