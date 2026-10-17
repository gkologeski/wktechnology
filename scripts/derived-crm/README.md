# Cargo e porte: execução e segurança

Migrações aplicadas: `0142_crm_cargo_porte_derivation.sql`, `0143_crm_explicit_cargo_catalog_validation.sql`.
`schema.sql` é fixture DDL para o banco descartável, não reaplicação de produção. `hardening.sql` testa a migração complementar. `catalog-seed.sql` é DML, só ferramentas de alteração de dados. `catalog.json` contém a primeira proposta do catálogo; a fonte efetivamente aplicada é `catalog-seed.sql`/`crm_derivation_catalog`.

## Fonte de verdade

- Contatos: `job_title` original. Leads: `job_title` editável; no INSERT sem valor vem de `hs_raw.properties.hs_contact_job_title`, depois `cargo_formatado`. UPDATE OF job_title registra edição explícita inclusive NULL→NULL. Enquanto legado, mudanças do raw sincronizam; edição explícita/limpeza nunca é sobrescrita pelo raw.
- Não escrever derivados em JS. Todos os INSERT/UPDATE/UPSERT passam pelo gatilho invoker; tentativa de sobrescrever derivados recalcula. Outros workspaces sem catálogo ativo não são classificados.
- Catálogo é versionado, com regras imutáveis; alterações exigem nova versão. Ativação de nova versão não reclassifica automaticamente o histórico: executar backfill autorizado para essa versão. Patterns validam tamanho, estrutura/prioridade e sintaxe; não aceitar regex arbitrárias de usuários comuns.
- `size` permanece intacto. Inteiro >=0 ou agrupamento de milhar inequívoco (1.500/1,500) é aceito; negativo, decimal, nulo/texto desconhecido não vira zero. Range inteiramente contido recebe faixa; cruzando limites recebe Faixa abrangente. 1.001 começa a faixa seguinte para não sobrepor 1.000.

## Backup e preenchimento

Backup protegido em `crm_derivation_backup`, execução `wk-2026-10-16`. Somente fontes necessárias, derivados e updated_at; não copiar PII extra.
Preencher WK em lotes <=1500. Antes de cada lote, `set_config('app.crm_derivation_backfill','wk-2026-10-16',true)`. Contatos/Leads: atualizar só cargo_catalog_version; Empresas: size_description. Não tocar fonte original. Repetição escolhe só registros incompletos.
A guarda só suprime efeitos audit/workflow/updated_at no papel SQL backend sem auth.uid, WK e diferenças limitadas a novos campos. Nenhuma policy RLS/Ver Como é removida. Não há envio, ferramenta externa ou ativação de agente.
Após timeout, verificar resultado antes de repetir; não presumir commit. Instabilidade do pool impede completar até recuperar acesso.

## Provas isoladas

```sh
bun scripts/isolated-db/extract-schema.ts
bash scripts/isolated-db/start.sh
# carregar schema.sql e hardening.sql com iso_guard/iso_psql, nunca conexão compartilhada
# gerar /tmp/derived-catalog-seed.sql a partir de catalog-seed.sql
# executar isolated-test.sql (transação descartada)
```

73 assertions SQL passaram: limites/faixas, Unicode, siglas/cargos, INSERT/UPDATE/UPSERT, raw/fallback, clear, forjado, outro workspace, efeitos e readonly. Assertions de RLS usam authenticated, não service_role. Não equivalem a REST/JWT real: essas provas ainda não foram executadas.

## Rollback conservador

Não remover schema. Desativar catálogo por nova operação autorizada e restaurar somente os novos campos/canônico a partir do backup, em lotes, com verificação de updated_at e alterações posteriores. Nunca restaurar cegamente fontes ou edição legítima posterior. Rollback completo de proveniência precisa operação específica revisada; não executar automaticamente.
