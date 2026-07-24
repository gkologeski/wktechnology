ALTER TABLE public.scoring_rules DROP CONSTRAINT IF EXISTS scoring_rules_entity_check;
ALTER TABLE public.scoring_rules
  ADD CONSTRAINT scoring_rules_entity_check
  CHECK (entity IN ('lead','contact','company'));