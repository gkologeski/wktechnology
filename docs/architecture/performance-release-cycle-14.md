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

Em andamento. Resultados finais e URL publicada serão registrados após validação; este documento não afirma implantação.
