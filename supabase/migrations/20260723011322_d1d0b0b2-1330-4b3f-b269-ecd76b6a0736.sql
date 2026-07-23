
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS shirt_size text,
  ADD COLUMN IF NOT EXISTS emergency_phone text,
  ADD COLUMN IF NOT EXISTS emergency_relationship text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS spouse_name text,
  ADD COLUMN IF NOT EXISTS bank text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS simples_optante boolean;

-- Backfill a partir do campo notes (importado do Google Forms).
-- Cada UPDATE só preenche quando a coluna alvo está NULL.

UPDATE public.people SET education = trim(m[1])
FROM (SELECT id, regexp_match(notes, 'Escolaridade:\s*([^\r\n]+)') AS m FROM public.people) s
WHERE public.people.id = s.id AND s.m IS NOT NULL AND public.people.education IS NULL;

UPDATE public.people SET shirt_size = trim(m[1])
FROM (SELECT id, regexp_match(notes, 'Camiseta:\s*([^\r\n]+)') AS m FROM public.people) s
WHERE public.people.id = s.id AND s.m IS NOT NULL AND public.people.shirt_size IS NULL;

UPDATE public.people SET marital_status = trim(m[1])
FROM (SELECT id, regexp_match(notes, 'Estado civil:\s*([^\r\n]+)') AS m FROM public.people) s
WHERE public.people.id = s.id AND s.m IS NOT NULL AND public.people.marital_status IS NULL;

UPDATE public.people SET spouse_name = trim(m[1])
FROM (SELECT id, regexp_match(notes, 'C[ôo]njuge:\s*([^\r\n]+)') AS m FROM public.people) s
WHERE public.people.id = s.id AND s.m IS NOT NULL AND public.people.spouse_name IS NULL;

UPDATE public.people SET pix_key = trim(m[1])
FROM (SELECT id, regexp_match(notes, 'PIX:\s*([^\r\n]+)') AS m FROM public.people) s
WHERE public.people.id = s.id AND s.m IS NOT NULL AND public.people.pix_key IS NULL;

UPDATE public.people SET address = trim(m[1])
FROM (SELECT id, regexp_match(notes, 'Endere[çc]o:\s*([^\r\n]+)') AS m FROM public.people) s
WHERE public.people.id = s.id AND s.m IS NOT NULL AND public.people.address IS NULL;

UPDATE public.people SET trade_name = trim(m[1])
FROM (SELECT id, regexp_match(notes, 'Nome Fantasia:\s*([^\r\n]+)') AS m FROM public.people) s
WHERE public.people.id = s.id AND s.m IS NOT NULL AND public.people.trade_name IS NULL;

UPDATE public.people SET legal_entity_name = trim(m[1])
FROM (SELECT id, regexp_match(notes, 'Raz[ãa]o Social:\s*([^\r\n]+)') AS m FROM public.people) s
WHERE public.people.id = s.id AND s.m IS NOT NULL AND public.people.legal_entity_name IS NULL;

UPDATE public.people SET simples_optante =
  CASE WHEN trim(m[1]) ILIKE 'Sim%' THEN true
       WHEN trim(m[1]) ILIKE 'N%o%' OR trim(m[1]) ILIKE 'Nao%' THEN false
       ELSE NULL END
FROM (SELECT id, regexp_match(notes, 'Optante Simples:\s*([^\r\n]+)') AS m FROM public.people) s
WHERE public.people.id = s.id AND s.m IS NOT NULL AND public.people.simples_optante IS NULL;

-- Banco: "Banco: <nome> — Ag <ag> / Conta <conta>" (— pode ser hifen ou traco longo)
UPDATE public.people SET
  bank = COALESCE(public.people.bank, trim(m[1])),
  bank_agency = COALESCE(public.people.bank_agency, NULLIF(trim(m[2]), '-')),
  bank_account = COALESCE(public.people.bank_account, NULLIF(trim(m[3]), '-'))
FROM (
  SELECT id, regexp_match(notes, 'Banco:\s*(.+?)\s*[—-]\s*Ag\s*([^/]*)/\s*Conta\s*([^\r\n]+)') AS m
  FROM public.people
) s
WHERE public.people.id = s.id AND s.m IS NOT NULL;

-- Fallback: "Banco: X" sem estrutura reconhecida — grava tudo em bank.
UPDATE public.people SET bank = trim(m[1])
FROM (SELECT id, regexp_match(notes, 'Banco:\s*([^\r\n]+)') AS m FROM public.people) s
WHERE public.people.id = s.id AND s.m IS NOT NULL AND public.people.bank IS NULL;

-- Recado: separa a maior sequência de dígitos (com hífens/espaços) do restante.
UPDATE public.people SET
  emergency_phone = COALESCE(public.people.emergency_phone, trim(m[1])),
  emergency_relationship = COALESCE(
    public.people.emergency_relationship,
    NULLIF(trim(BOTH ' -,' FROM regexp_replace(full_line, regexp_replace(m[1], '([\.\+\*\?\(\)\[\]\{\}\|\\\^\$])', '\\\1', 'g'), '')), '')
  )
FROM (
  SELECT
    id,
    regexp_match(notes, 'Recado:\s*([^\r\n]+)') AS full_match,
    (regexp_match(notes, 'Recado:\s*([^\r\n]+)'))[1] AS full_line,
    regexp_match(notes, 'Recado:[^\r\n]*?([0-9][0-9\- ]{6,}[0-9])') AS m
  FROM public.people
) s
WHERE public.people.id = s.id AND s.m IS NOT NULL;

-- Se não achou telefone válido, grava tudo em relationship.
UPDATE public.people SET emergency_relationship = trim(m[1])
FROM (SELECT id, regexp_match(notes, 'Recado:\s*([^\r\n]+)') AS m FROM public.people) s
WHERE public.people.id = s.id
  AND s.m IS NOT NULL
  AND public.people.emergency_phone IS NULL
  AND public.people.emergency_relationship IS NULL;
