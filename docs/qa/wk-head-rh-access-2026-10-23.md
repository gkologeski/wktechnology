# WK — Head de RH: TechHire e TechPeople

Autorização do usuário em 23/10/2026: acesso completo aos dois módulos para o
cargo Head de RH. Workspace WK: `184b9435-0a9b-4334-9e89-8854dc883f5d`.

## Aplicado

- 326 chaves TechHire e 191 TechPeople, via overrides locais de cargo.
- Priscila Alves do Nascimento é membro ativo e possui o cargo. O resolvedor
  efetivo confirmou as 517 chaves; seu papel de workspace continua `member`.
- Onboarding/offboarding, tarefas e modelos tinham gravação admin-only,
  independentemente das chaves cadastradas. A migração 0189 acrescenta o caminho
  autorizado para Head de RH da WK, validando chave efetiva, membro ativo,
  workspace e relações com pessoa/plano. Preserva restrições de Ver como.
- Documentos, benefícios, edição/exclusão de alocações, eventos de pessoas e
  incidentes recebem o caminho equivalente nos pontos legados admin/owner-only.
  Incidentes sem pessoa também passam nas restrições de leitura e edição.
- Documentos/benefícios derivam workspace da pessoa antes da RLS. Registros
  legados sem workspace são preenchidos somente quando a pessoa pertence à WK;
  a pré-verificação ao vivo encontrou zero linhas para esse backfill e nenhum
  workspace conflitante. Vínculos cruzados são recusados.
- O helper local não aceita identidade fornecida pelo cliente. Não pode ser
  executado por anon; o trigger não tem EXECUTE direto para authenticated/anon.
- Não foram alterados presets globais, papéis de administrador ou outros cargos
  e workspaces. Hashes dos demais overrides e de todos os memberships permaneceram
  iguais antes/depois da aplicação das políticas.

## Validação

Migração aplicada transacionalmente e registrada em `drizzle.__drizzle_migrations`:
`ee07a9f07f7bb47f1d9355642e30ac4dd31dc46d96f37d6bca41e0f9ef36f42f`.

44 testes de comportamento em PostgreSQL 15 descartável passaram. A fixture
reproduz a negação original no onboarding; usa funções RBAC extraídas do catálogo,
as políticas anteriores das três tabelas de onboarding e todas as restritivas
existentes nas oito tabelas modificadas. Nas demais tabelas, as permissivas legadas
são fechadas/minimizadas para isolar o novo caminho. Os dados são sintéticos;
tabelas de negócio contêm apenas colunas necessárias aos predicados. O helper
administrativo auxiliar da fixture é simplificado: não se trata de clone integral.

Cobertura: criação/leitura/edição/exclusão, tarefas e modelos, documentos e benefícios,
incidente sem pessoa, outro workspace, pessoa/plano cruzados, owner forjado,
cargo diferente mesmo com chaves, deny explícito, membro inativo, ator NULL,
proibição de anon e Ver como somente leitura.

Reprodução, com PostgreSQL 15+ instalado:

```sh
PG_BIN=/opt/homebrew/opt/postgresql@15/bin bash tests/sql/run-wk-head-rh.sh
```

O runner cria cluster próprio por socket, sem TCP; recusa outro nome de banco,
para o cluster ao terminar e mantém logs temporários. Não usa conexão de produção.
Somente a nova migração é aplicada à fixture; não reaplica o histórico do sistema.

A verificação ao vivo foi de permissões efetivas, políticas e grants. Não foi
criado plano fictício em produção nem acessada a sessão da Priscila. Os testes SQL
não equivalem a aceite visual/GoTrue/PostgREST nem validam cada fluxo dos módulos.
Ao voltar à tela, recarregar a página para atualizar o cache de permissões.

## Escopo e manutenção

É uma ponte local para o cargo explicitamente autorizado; não torna qualquer
membro com uma chave isolada administrador e não concede acesso ao restante do ERP.
A revisão geral de RLS e das demais lacunas da auditoria de permissões é separada.
Novas chaves futuras exigem decisão explícita; este grant não é wildcard dinâmico.
