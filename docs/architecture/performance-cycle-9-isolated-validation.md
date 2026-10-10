# Ciclo 9 — Validação isolada: ambiente, permissões e tempo real

Base: `5b0e697d`. Preview apenas, nada publicado, nenhum envio, nenhum dado de cliente alterado.
Foco: frentes 2 (ambiente isolado), 1 (permissões) e 3 (tempo real ponta a ponta).

## 1. Precheck do ambiente

| Recurso                        | Situação                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Docker / podman / Supabase CLI | **ausentes**                                                                                                                      |
| PostgreSQL 17.9 (nix store)    | disponível (o `/usr/bin/initdb` direto falha por `$libdir`; o harness usa o caminho do nix)                                       |
| Extensões locais               | pgcrypto, uuid-ossp, pg_trgm, test_decoding; **sem** pg_cron, pg_net, supabase_vault, pgmq                                        |
| PostgREST                      | existe no nixpkgs (14.1), não usado: as asserções rodam no mesmo mecanismo do PostgREST (`SET LOCAL ROLE` + `request.jwt.claims`) |
| Supabase Realtime              | **indisponível** (sem contêiner; não existe no nixpkgs)                                                                           |
| GoTrue (Auth)                  | indisponível; `auth.uid()/role()/jwt()` reproduzidos com a mesma definição da plataforma                                          |
| Usuário do SO                  | `useradd` bloqueado (`/etc/passwd` travado); o banco roda como `nobody`                                                           |

Nenhum serviço pago/externo ou projeto novo foi criado.

## 2. Harness (`scripts/isolated-db/`)

| Arquivo                | Papel                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env.sh`               | limpa `PG*`, fixa socket em `/tmp/techerp-isolated/sock` (sem TCP), `iso_guard` recusa alvo que não seja o socket local com o marcador `__isolated_marker`, ou que contenha o ref do projeto/`supabase.co`/`pooler`                                                                                                                                                                                                 |
| `bootstrap.sql`        | papéis (`anon`, `authenticated`, `service_role`…), schema `auth` (funções iguais às da plataforma), `storage`, `realtime.messages/topic()`, e **stubs inertes** de `cron`, `net` (grava em `net.blocked_requests`, nunca chama rede) e `vault`; publicação `supabase_realtime`                                                                                                                                      |
| `extract-schema.ts`    | lê **só o catálogo** do projeto (acesso de leitura) e gera `schema.sql`: enums, sequências, tabelas, funções (`pg_get_functiondef`), defaults, restrições, índices, views, triggers (inclui `auth.users`), RLS/políticas, GRANTs de tabela/coluna/função/sequência e a publicação. Exporta também os catálogos globais `permissions` e `modules` (sem workspace, sem dado pessoal). Nenhuma tabela de tenant é lida |
| `start.sh` / `stop.sh` | sobe/derruba o PostgreSQL descartável; `stop` só apaga dentro de `/tmp/techerp-isolated`                                                                                                                                                                                                                                                                                                                            |
| `seed.sql`             | fixtures sintéticas idempotentes (ids fixos, `[ISO]`, e-mails `@techerp-test.invalid`, telefones `+5500000000xxx`); recusa rodar sem o marcador                                                                                                                                                                                                                                                                     |
| `compare-schema.ts`    | compara projeto × isolado em 11 categorias; gera `fidelity.json`; exit 1 se houver divergência                                                                                                                                                                                                                                                                                                                      |
| `permission-matrix.ts` | 43 casos; cada um numa transação com `ROLLBACK`, como `authenticated`/`anon` com claims sintéticos; gera JSON + JUnit                                                                                                                                                                                                                                                                                               |
| `realtime-wal.ts`      | camada WAL do tempo real (slot lógico `test_decoding`) + registro explícito do que **não** foi executado                                                                                                                                                                                                                                                                                                            |
| `run.sh`               | ciclo completo; exit 0 = tudo passou e nada pendente, 1 = falha, 2 = bloqueado, **3 = incompleto**                                                                                                                                                                                                                                                                                                                  |
| `apply-migrations.ts`  | diagnóstico: reexecuta o histórico de migrations (ver §3)                                                                                                                                                                                                                                                                                                                                                           |

Comando: `bun run test:isolated` (equivale a `bash scripts/isolated-db/run.sh`). `ISO_KEEP=1` mantém o banco.
Recursos: ~200 MB em `/tmp/techerp-isolated`, socket Unix porta 54329, sem TCP. Artefatos em
`/tmp/techerp-isolated/artifacts/*.{json,xml}`. Nenhum processo fica rodando ao final (conferido).

Integração ao pipeline: **opt-in local**. A extração exige leitura do catálogo do projeto, que o CI não tem;
por isso não foi ligado em `.github/workflows/ci.yml`. O código 3 (incompleto) nunca é verde de publicação.

## 3. Fidelidade

- **Reaplicar o histórico de migrations não reproduz o banco**: `supabase/migrations` + `drizzle/migrations`
  (640 arquivos) → 593 aplicam, 47 falham mesmo com stubs (ex.: `20260527033156` altera
  `activities.workspace_id` antes de qualquer migration criar a coluna; a coluna veio de alteração fora do
  repositório). Por isso o harness carrega a estrutura **atual** do catálogo.
- Resultado da comparação (após 0099/0100), divergência **zero** em todas as categorias:

| Categoria                             | Projeto | Isolado |
| ------------------------------------- | ------: | ------: |
| Políticas                             |   2.203 |   2.203 |
| Funções (`public`, sem extensões)     |     205 |     205 |
| Colunas (tipo, nulo, default, gerada) |   4.822 |   4.822 |
| GRANTs de tabela/sequência            |   8.152 |   8.152 |
| GRANTs de função                      |     646 |     646 |
| RLS ligada/forçada                    |     348 |     348 |
| Triggers                              |     526 |     526 |
| Restrições                            |   1.425 |   1.425 |
| Índices                               |   1.354 |   1.354 |
| Views                                 |       5 |       5 |
| Publicação realtime                   |      27 |      27 |

Diferenças conhecidas, fora de `public` (não comparadas): `auth` mínimo (sem GoTrue), políticas de
`storage.objects` e `realtime.messages` não copiadas, `cron`/`net`/`vault` como stubs inertes, sem `pgmq`.

## 4. Matriz de permissões — 43/43 passaram

Identidades: 1 admin A, 2 escopo próprio A, 3 escopo equipe A (time com 7), 4 escopo workspace A,
5 removido (inativo) A, 6 admin B (outro tenant com dados), 7 par A, anônimo. Cargos com chaves reais do
catálogo (`techsales.activities.view.{own,team,workspace}` etc.).

| Área               | Casos | O que cobre                                                                                                                                                                             |
| ------------------ | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timeline           |    20 | atividades por escopo (tabela e `get_timeline_activity_page`), histórico, agenda, corpo de e-mail, id direto de outro tenant, busca por texto de B, removido, anônimo, admin desativado |
| Dashboard          |     3 | `get_sales_dashboard_deal_aggregates` com workspace adulterado; positivo de B; `dashboard_metrics` anônimo                                                                              |
| Inbox              |     8 | unificada (positivo, busca de B, removido), canal com workspace adulterado, mensagem WA de B, chat privado membro/não membro                                                            |
| Branding           |     6 | leitura por tenant, removido, escrita de membro comum, módulo de outro tenant, anônimo                                                                                                  |
| Escrita/identidade |     4 | inserir em B, criar lead fora do tenant original, revogação, troca de identidade na mesma conexão                                                                                       |
| "Ver como"         |     2 | sessão de papel não altera registro real; sem permissão de update fora do modo                                                                                                          |

Não coberto nesta matriz: ranking do dashboard (`get_sales_dashboard_secondary_v2`), escopo de equipe em
Inbox/negócios, contrato completo do "Ver como" modo usuário (exige magic link/GoTrue).

## 5. Bugs reais encontrados e corrigidos

1. **0099 `stage_history_use_record_workspace`** — 81 colunas `workspace_id` têm DEFAULT fixo com o id do
   tenant original. `track_stage_entries` e `log_property_changes` não informavam `workspace_id`; o default
   entrava e `set_workspace_on_insert` barrava (42501). Efeito: **em qualquer workspace que não o original,
   criar lead/negócio falhava** e o histórico de propriedade iria para o tenant errado. Hoje só há 1
   workspace (latente). Correção: as duas funções gravam o workspace do próprio registro. Para o tenant
   atual o valor é idêntico.
2. **0100 `admin_of_requires_active_member`** — `is_workspace_admin_of` não checava `status`; um admin
   desativado continuava lendo e-mails de membros (`email-detail-removed-admin` falhou antes, passa depois).
   Correção: exige `status = 'active'` nos ramos de membro. Hoje há 0 admins inativos (sem efeito em
   usuários atuais). O criador do workspace continua tratado como admin.

Risco remanescente (não corrigido, fora do escopo mínimo): outras funções gravam sem `workspace_id` em
tabelas com o DEFAULT fixo (`create_ticket_survey`, `subscription_after_insert`,
`subscription_invoice_after_paid`); e o próprio DEFAULT fixo em 81 colunas.

## 6. Tempo real

- **Executado (camada WAL, banco isolado, RLS real)**: 4/4 — UPDATE de branding por admin sai com
  `workspace_id` (base do filtro `workspace_id=eq.`); UPDATE negado por RLS não gera evento; INSERT de chat
  sai; **DELETE em tabela com REPLICA IDENTITY DEFAULT só traz a PK** — o filtro por workspace não casa e o
  cliente depende da reconciliação (já existente no White Label ao voltar à aba).
- **Não executado** (14): assinatura via SDK → confirmação → evento → UI para branding, e-mail, WhatsApp,
  chat, histórico; negado entre tenants; update/delete; reconexão; revogação; troca de contexto; rajada;
  nova mensagem lendo antigas; rascunho/rolagem. Bloqueio exato: serviço Supabase Realtime indisponível
  localmente (sem Docker/podman; não há pacote no nixpkgs). Nenhuma escrita foi feita no banco compartilhado
  para contornar.

## 7. Gates

- `bun run verify`: exit 0 (tipos + lint global + 104 arquivos / 723 testes).
- `bun run build` não foi rodado: nenhum arquivo de `src/` nem configuração de build mudou (só `scripts/`, docs,
  migrations SQL e a entrada `test:isolated` em `package.json`). As 2 verificações automáticas da plataforma
  após as edições deram "build OK".
- Timeout de 240 s: sem nova evidência; não declarado resolvido.

## 8. Rollback

- Harness: apagar `scripts/isolated-db/` e o script `test:isolated` (nada do app depende dele).
- 0099/0100: `CREATE OR REPLACE` com as definições anteriores (o corpo antigo está em
  `/tmp/techerp-isolated/schema.sql` de uma extração anterior ou no histórico do git das migrations
  de origem). Não há mudança de dados.

## 9. Pendências

1. RLS não-admin **no banco real** continua não validada (requisito de publicação). O banco isolado tem
   estrutura idêntica, mas não substitui sessão autorizada no ambiente real.
2. Tempo real ponta a ponta (SDK/UI) bloqueado por infraestrutura.
3. DEFAULT fixo de `workspace_id` em 81 colunas e três funções restantes sem `workspace_id`.
4. Ranking do dashboard e "Ver como" modo usuário na matriz.
