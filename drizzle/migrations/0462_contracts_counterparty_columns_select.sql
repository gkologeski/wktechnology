-- Counterparty kind/contact columns (0461) were not readable; row access stays under contracts RLS.
GRANT SELECT (counterparty_kind, counterparty_contact_id) ON TABLE public.contracts TO authenticated;
