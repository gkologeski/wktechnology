# Auditoria de acesso (RLS/GRANT)

```bash
psql "$DATABASE_URL" -f tests/access-audit/access-audit.sql
psql "$DATABASE_URL" -v prefixo=help_ -f tests/access-audit/access-audit.sql   # só tabelas help_*
```

Somente leitura. Cada linha é um achado `categoria | tabela | detalhe`:
`SEM_RLS`, `ACESSO_TRAVADO`, `SEM_GRANT`, `TO_PUBLIC`, `ANON_ESCRITA`,
`POLITICA_SEM_ESCOPO`.

`baseline-2026-11-05.txt` é a fotografia do banco do rascunho antes das
tabelas da Ajuda (39 achados herdados, não tratados nesta entrega). Uma entrega
não pode introduzir achado novo:

```bash
psql "$DATABASE_URL" -At -F'|' -f tests/access-audit/access-audit.sql | diff tests/access-audit/baseline-2026-11-05.txt -
```

`ACESSO_TRAVADO` pode ser intencional (tabelas usadas só pelo servidor com
service_role); confirme antes de tratar como falha.
