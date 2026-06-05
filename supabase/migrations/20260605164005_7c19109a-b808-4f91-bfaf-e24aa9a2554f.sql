ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS parent_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_companies_parent ON public.companies(parent_company_id) WHERE parent_company_id IS NOT NULL;

-- Prevent self-reference
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_no_self_parent;
ALTER TABLE public.companies ADD CONSTRAINT companies_no_self_parent CHECK (parent_company_id IS NULL OR parent_company_id <> id);

-- Recursive function to detect cycles
CREATE OR REPLACE FUNCTION public.check_company_hierarchy_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current uuid;
  v_depth int := 0;
BEGIN
  IF NEW.parent_company_id IS NULL THEN RETURN NEW; END IF;
  v_current := NEW.parent_company_id;
  WHILE v_current IS NOT NULL AND v_depth < 50 LOOP
    IF v_current = NEW.id THEN
      RAISE EXCEPTION 'company hierarchy cycle detected';
    END IF;
    SELECT parent_company_id INTO v_current FROM public.companies WHERE id = v_current;
    v_depth := v_depth + 1;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_check_hierarchy ON public.companies;
CREATE TRIGGER companies_check_hierarchy
  BEFORE INSERT OR UPDATE OF parent_company_id ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.check_company_hierarchy_cycle();