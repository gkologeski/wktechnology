# Lançamento e recuperação — ciclo 14

## Critérios de liberação

1. Integrar as mudanças mais recentes da branch principal, preservando ajustes concorrentes.
2. `verify` e `build` completos, sem interrupção e com fingerprint igual ao código atual; `perf:check` aprovado.
3. Backend reconstruído em stack separada: 76 verificações aprovadas, zero falhas. Três placeholders de UI continuam não executados no harness; provas manuais ficam separadas.
4. Executar o artefato Cloudflare emitido no workerd: login SSR, navegação autenticada, ausência de diagnósticos DEV e endpoint autenticado recusando requisição anônima.
5. Conferir versão servida e exercitar retorno ao artefato anterior no ambiente isolado.
6. Conferir definições reais do banco compartilhado antes de aplicar SQL. Snapshot de definições, policies, defaults e publicação preservado localmente; nenhum dado de cliente copiado.
7. Integrar pelo Lovable, repetir o gate completo, alinhar migrações 0103–0114 e publicar. Não marcar publicação por screenshot antiga ou flag `is_published` de release anterior.
8. Conferir `build-info.json`, login, assets e resposta da versão publicada.

## Sequência de banco

As migrações 0099–0102 já estão refletidas no snapshot compartilhado revisado. Aplique somente diferenças comprovadas, em transação, na ordem de dependências.

- 0103: policies SELECT restritivas em canais e históricos, sem ampliar permissões existentes.
- 0104–0111: defaults seguem a sessão; todos os escritores sem sessão devem fornecer workspace da entidade de origem. Código integrado deve anteceder essas mudanças.
- 0112: default exige membership ativa e falha fechado para workspace selecionado inacessível.
- 0113: publicação de reuniões e itens de negócio.
- 0114: sinais opacos de exclusão com RLS e escrita restrita ao trigger.

Antes/depois: contar defaults fixos, inspecionar funções/policies e presença nas publicações. Nenhuma migração deve atualizar ou apagar registros comerciais.

## Recuperação

- Referência anterior no início do lançamento: `d1dee82098b2cd30e24d7bbf9b3cc36f6939e6b0`.
- Cópia local do artefato anteriormente aceito: `.techerp-isolated.local/release-previous/`, com inventário de hashes. Serve apenas o banco sintético local.
- Se falhar antes da publicação, mantenha o release público anterior; preserve logs e corrija o pacote.
- Se falhar depois da publicação, restaure o artefato/commit anterior pelo mecanismo de versões do Lovable, mantendo a segurança do banco. Gravadores antigos incompatíveis exigem correção adiante; nunca restabeleça workspace fixo para aparentar funcionamento.
- Reverter automaticamente todas as migrações é inadequado: reintroduziria falhas de isolamento. Snapshot de DDL serve para revisão direcionada; recuperação de dados depende do backup gerenciado do provedor.
- Conferir a identidade servida, login e endpoint protegido depois de qualquer restauração.

## Evidências de lançamento

Em andamento: gates finais registrados abaixo; publicação ainda não executada. Este documento não afirma implantação.

## Fechamento do ciclo 14 (11/10/2026)

**Status:** 15 tarefas concluídas **no escopo local**; a tarefa 16 está **em lançamento** (publicação e alinhamento do banco ainda não executados). Nada foi publicado e nenhuma migração foi aplicada de forma permanente ao banco compartilhado.

### Ajuste final de código
- `src/components/workspace-realtime-signals.tsx`: `queryKeys` passa a incluir `["tasks"]` (atividades são a tabela de Tarefas), para que a exclusão opaca também reconcilie a lista de Tarefas. Validado localmente pelo operador com conta restrita: tarefa sintética excluída direto no banco local sumiu sem recarregar (lista 1→0). Nenhuma outra função ou migração alterada.

### Harness SDK × prova manual (distinção obrigatória)
Os três cenários `rt-delete-event`, `ui-event-to-screen` e `view-as-gotrue-session` **não são executados pelo runner SDK** e continuam `not_executed` → exit 3 no harness. Não viram verde automático. A prova foi feita separadamente, manualmente, pelo operador no navegador conectado ao app local:
- `rt-delete-event`: nota e tarefa excluídas fora da tela sumiram sem reload; fixtures removidas.
- `ui-event-to-screen`: 14 cenários conciliados neste checklist; troca de workspace A→B→A verificada em duas abas.
- `view-as-gotrue-session`: teste real do "Ver como" do ciclo 13 e teste específico próprio passaram.

### Outras provas locais (operador)
- Reprodução SDK isolada: 76 aprovações / 0 falhas. Carga sintética: 7/7.
- Rollback local: artefato anterior serviu login 200 e dashboard autenticado; retorno ao final com outra identidade de assets, `build-info.json` 200 e fingerprint exato; zero erros no navegador; diagnóstico DEV ausente.
- Formulário público sem sessão no worker local: lead, envio e nota gravados no workspace B correto; depois removidas apenas as fixtures.
- Migrações 0103–0114 executadas em transação de compatibilidade com `ROLLBACK`, sem dados de clientes: dentro da transação, zero defaults fixos e publicação com 3 tópicos; após o rollback, 49 defaults fixos e tabela de sinais inexistente (estado preservado). Helpers de membership/admin exigem `status = active`. Snapshot de DDL compartilhado preservado.

### Gates nesta sandbox (Lovable)
| Execução | verify | build | client | ssr | nitro | entrada gzip | módulos Nitro |
|---|---|---|---|---|---|---|---|
| Integração do pacote (antes do ajuste) | 32,5 s | 158,0 s | 40,6 s | 48,1 s | 65,8 s | 251.085 B | 3.104 |
| Após ajuste `["tasks"]` (final) | 29,4 s (tipos 21,9 · lint 1,3 · testes 6,2) | 130,2 s | 40,8 s | 38,3 s | 47,3 s | 251.106 B | 3.104 |

- verify: `complete=true`, 773 testes / 120 arquivos, 0 erros de lint. build: `complete=true`, saída 0. `bun run perf:check`: aprovado.
- Fingerprint (source_hash) final: `1bae558d954f8494f6b51aaa4fc467e0835f03040de51cfecd9f5b8100a0f08b` — idêntico em `.verification/verify.json`, `.verification/build.json` e `dist/client/build-info.json`.
- Commit no início desta rodada: `9b570ff9eed6adb3a8d0088e611044aae81153be` (o ajuste entra no próximo registro automático da plataforma).
- Tempos locais anteriores do operador (verify 26,2 s, build 100,3 s, Nitro 38,9 s) são de outra máquina e **não são SLA**.

### Próximo passo (não executado)
Publicar o código primeiro; só então aplicar defaults/policies 0103–0114 na transação validada, para não quebrar gravadores da versão pública anterior.
