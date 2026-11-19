# Hiring preparation requests

- Preparation has independent professional/supplier permissions and only draft/ready/cancelled revisions; why: ready never authorizes approval, recruitment or operational effects.
- Writes run through a dedicated NOLOGIN, non-BYPASSRLS RPC owner inheriting authenticated; why: canonical references remain subject to the caller's RLS while direct table writes are unavailable.
- Schema migrations require independent review, isolated tests and CI before production application; why: approved UI prototypes do not replace authorization and database validation.
- Reference amounts live in a separate RLS table and never in ordinary rows/events; why: request-view access must not expose sensitive conditions through lists, history, idempotency payloads or RPC results.
