ALTER TABLE public.project_time_entries
  ADD COLUMN IF NOT EXISTS allocation_id uuid NULL REFERENCES public.people_allocations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS person_id uuid NULL REFERENCES public.people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pte_allocation ON public.project_time_entries(allocation_id) WHERE allocation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pte_person ON public.project_time_entries(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pte_user_date ON public.project_time_entries(user_id, entry_date);