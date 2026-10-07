-- Questionário sem pontuação grava score nulo (não zero). Aditivo: valores existentes intactos.
ALTER TABLE public.prospecting_qualifications ALTER COLUMN score DROP NOT NULL;