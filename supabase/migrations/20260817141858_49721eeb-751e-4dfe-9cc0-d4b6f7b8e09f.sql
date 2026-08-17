DROP INDEX IF EXISTS public.companies_name_order_idx;
DROP INDEX IF EXISTS public.contacts_first_name_order_idx;
CREATE INDEX IF NOT EXISTS companies_name_order_idx ON public.companies USING btree (name);
CREATE INDEX IF NOT EXISTS contacts_first_name_order_idx ON public.contacts USING btree (first_name);