# Hiring preparation requests

- Preparation has independent professional/supplier permissions and only draft/ready/cancelled revisions; why: ready never authorizes approval, recruitment or operational effects.
- Writes run through a dedicated NOLOGIN, non-BYPASSRLS RPC owner inheriting authenticated; why: canonical references remain subject to the caller's RLS while direct table writes are unavailable.
- Schema migrations require independent review, isolated tests and CI before production application; why: approved UI prototypes do not replace authorization and database validation.
- Reference amounts live in a separate RLS table and never in ordinary rows/events; why: request-view access must not expose sensitive conditions through lists, history, idempotency payloads or RPC results.
- Approval cycles bind the saved revision, private reference revision and canonical policy snapshot, with ordered manager/CEO decisions and explicit substitutes; why: ready is not approval and edits invalidate decisions without operational effects.
- Approval notifications use a distinct internal-only type and scoped request link; why: existing ATS email enqueue triggers must never send mail for preparation approvals.
- Formalization uses a separate current-approval boundary and a single request-owned client contract/draft; expiring capabilities require a delivered one-use HMAC code to the canonical counterparty email, and all signing paths recheck the bound cycle; why: local approval work stays mergeable while sales and historical signatures remain unchanged.
- Formalization reasons use immutable private notes gated by request, formalization, reference and contract reads; document preparers may explicitly review but demand authors/requesters cannot approve; why: auditability must not leak conditions or conflate document review with demand approval.
- In-flight/completed signature bodies cannot be overwritten; completion requires the actual full native roster or service-recorded ForSign roster/evidence, while preview access is independent from dispatch; why: preserve signed history without granting execution or blocking legal review.
