
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS cnpj_enriched_at timestamptz;

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_cnpj_format_chk;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_cnpj_format_chk
  CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$');

-- Backfill deduplicated: keep earliest created company per (owner, cnpj)
WITH candidates AS (
  SELECT id, owner_id, created_at,
    regexp_replace(
      COALESCE(
        hs_raw->'properties'->>'cnpj',
        hs_raw->'properties'->>'cnpj_da_empresa',
        hs_raw->'properties'->>'tax_id',
        hs_raw->'properties'->>'br_cnpj',
        hs_raw->'properties'->>'documento',
        hs_raw->>'cnpj'
      ),
      '[^0-9]', '', 'g'
    ) AS digits
  FROM public.companies
  WHERE cnpj IS NULL AND hs_raw IS NOT NULL AND deleted_at IS NULL
),
valid AS (
  SELECT id, owner_id, digits,
    ROW_NUMBER() OVER (PARTITION BY owner_id, digits ORDER BY created_at ASC, id ASC) AS rn
  FROM candidates
  WHERE digits ~ '^[0-9]{14}$'
)
UPDATE public.companies c
SET cnpj = v.digits
FROM valid v
WHERE c.id = v.id AND v.rn = 1;

CREATE UNIQUE INDEX IF NOT EXISTS companies_owner_cnpj_uniq
  ON public.companies (owner_id, cnpj)
  WHERE cnpj IS NOT NULL AND deleted_at IS NULL;
