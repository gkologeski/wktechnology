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

## Revisão independente — 17/10/2026

`classifier-v2.sql` contém DDL complementar validado no isolado, **ainda não aplicado na base compartilhada**. Aplicar seu conteúdo com a ferramenta de migration, registrar o caminho retornado, então executar `catalog-v2.sql` como operação de dados. O catálogo v1 permanece imutável; v2 tem 45 regras e exclusões explícitas. Não ativar v2 sem o novo classificador.

HRBP/Business Partner, People Partner, Talent Acquisition Partner, Product Owner e Partner Manager não viram Sócio. Co-Founder & CTO preserva a especialidade; CEO + CTO é ambíguo. Diretor Técnico mantém título sem presumir TI. Desenvolvimento de negócios recebe Comercial. A marcação de edição mantém NULL→NULL explícito, mas um import que reenvia o mesmo cargo não vazio continua legado e sincroniza o raw atualizado.

`backfill-v2.sql` limita cada transação a 1.000 linhas por entidade, só WK, sem escrever cargo/size originais, e exige v2 ativo. Reclassifica inclusive registros preenchidos com v1, não só campos vazios. Não foi executado em produção: Cloud indisponível. O preenchimento original permanece pendente, não substituído por esta revisão.

Provas atualizadas: 92 assertions isoladas, incluindo HRBP via UPDATE real do gatilho; nenhum uso de service_role nas assertions. `bunx vitest run`: 1.004 testes passaram; `bun run lint`: 0 erros/1.325 avisos. Verify completo não executado manualmente pois inclui typecheck, vedado pelo harness; build/typecheck dependem de sinais automáticos.
