# Hiring preparation requests

- Preparation has independent professional/supplier permissions and only draft/ready/cancelled revisions; why: ready never authorizes approval, recruitment or operational effects.
- Writes run through a dedicated NOLOGIN, non-BYPASSRLS RPC owner inheriting authenticated; why: canonical references remain subject to the caller's RLS while direct table writes are unavailable.
- Keep pending schema SQL under docs/architecture/prepared-migrations until human review; why: local preparation must not apply changes to the shared backend or migration journal.
- Reference amounts live in a separate RLS table and never in ordinary rows/events; why: request-view access must not expose sensitive conditions through lists, history, idempotency payloads or RPC results.
