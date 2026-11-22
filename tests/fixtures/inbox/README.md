# INBOX-REVISAO — fixtures descartáveis

`data.sql` contém somente fixtures QA, não é catálogo oficial nem exemplo para novos ambientes.
Nunca incluir em `db/seed.sql`, migrations ou bootstrap do app.

Execução explícita: `bun scripts/isolated-db/gmail-queue-local.ts --disposable-draft`
e `bun scripts/isolated-db/inbox-producers-local.ts --disposable-draft`.
O loader recusa contexto fora do draft local, endereço/porta/banco diferentes,
destino remoto e qualquer workspace que não seja fixture. Essa recusa ocorre antes
de carregar fixtures ou executar o teste/finally. Usa a stack descartável já disponível,
sem iniciar outro PostgreSQL. Os dados vivem apenas nessa stack; descartar o draft
descarta o banco. Não há credenciais ou contas do proprietário.

`bun scripts/isolated-db/inbox-review-local.ts --disposable-draft` carrega também
`unipile.sql`: identidade sem senha e conta sem credenciais reais, somente para
comprovar ingestão/replay no banco descartável. Não é um login QA provisionado no app.

Esses scripts usam JWT de serviço local. Não certificam os cinco cenários JWT de usuário,
equivalência RLS, Gmail real ou envio externo.
