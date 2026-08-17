# Vagas criadas pela Priscila invisíveis para os demais usuários

## Causa confirmada

Verificado no banco:

- A Priscila (`priscila.nascimento@`) é **membro** (`role = member`) do mesmo workspace do Guilherme (`184b9435-…`), e é dona de 4 vagas (3 publicadas + 1 preenchida) em `ats_jobs`.
- `ats_jobs` não tem coluna de workspace: a dona é gravada em `owner_id` com o **id do usuário** criador.
- As três políticas de leitura de `ats_jobs` não cobrem esse caso:
  - `ats_jobs_owner_all` / `owner_id = auth.uid()` → só a própria Priscila;
  - `ats_jobs_admin_select` usa `is_workspace_admin_of(owner_id, …)`, que interpreta `owner_id` como **id de workspace**; com um id de usuário retorna falso (testado: `false` para o Guilherme);
  - `ats_jobs_perm_select` usa `user_has_permission(auth.uid(), resolve_workspace_id(owner_id), 'techhire.jobs.view.workspace')`, e `resolve_workspace_id` só resolve quem **criou** um workspace. A Priscila não criou nenhum, então retorna `NULL` e a checagem falha (testado: `resolve_workspace_id(priscila) = NULL`).
  - `ats_jobs_team_select` só libera quem é hiring manager/recruiter da vaga.
- O Guilherme **tem** a permissão `techhire.jobs.view.workspace` no workspace (testado: `true`) — o bloqueio é exclusivamente na resolução do workspace da dona.
- A política que cobria isso, `ats_jobs_workspace_shared_select`, existiu e foi removida na migration de 14/07 ("add tenant scope"), substituída apenas pela regra de time. O comentário em `src/lib/ats/ats.functions.ts` (`listAtsJobs`) ainda cita essa política como se existisse — por isso a função não filtra por `owner_id` e simplesmente não retorna nada dos colegas.

Efeito colateral do mesmo padrão: qualquer registro ATS criado por um membro que não seja o criador do workspace fica invisível para os colegas. Hoje existem 13 candidatos, 5 candidaturas, 3 publicações e 6 pipelines nessa situação.

## Correção

### 1. Restaurar leitura por workspace com gate de permissão (migration)

Já existe a função `techhire_rbac_gate(_user, _owner, _perm)`, que resolve corretamente os workspaces do dono (criador **ou** membro) e valida a permissão efetiva do usuário. Ela é usada hoje só em INSERT/UPDATE/DELETE de `ats_jobs`.

Adicionar políticas de SELECT baseadas nela, sem remover as existentes (leitura é permissiva, então nada perde acesso):

- `ats_jobs` → `techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.view.workspace')`
- `ats_candidates` → `techhire.candidates.view.workspace`
- `ats_applications`, `ats_interviews`, `ats_job_postings`, `ats_offers`, `ats_pipelines` → permissão correspondente de cada recurso, mantendo também o caminho já existente por `can_access_ats_job(job_id)`

Isso mantém o isolamento entre workspaces (o gate exige um workspace em comum **e** a permissão concedida) e deixa de depender de o dono ter criado o workspace.

### 2. Alinhar UPDATE/DELETE ao mesmo critério

Nas mesmas tabelas, revisar as políticas de escrita que hoje usam `resolve_workspace_id(owner_id)` para também aceitar `techhire_rbac_gate(...)`, evitando o sintoma "vejo mas não consigo editar" logo após a correção de leitura. Nenhuma ampliação além das permissões já concedidas em Configurações → Permissões.

### 3. Atualizar o comentário desatualizado

Em `src/lib/ats/ats.functions.ts` (`listAtsJobs`), corrigir a referência à política removida para o nome real, mantendo o comportamento atual (sem filtro por `owner_id`).

## Fora de escopo

- Não migrar o ATS para coluna `workspace_id` (mudança estrutural grande); fica registrado como dívida técnica, já que o padrão `owner_id`-como-usuário é a raiz do problema.
- Não alterar `resolve_workspace_id`, que é usada por muitas políticas de outros módulos.
- Nenhuma mudança em autenticação, schema, RBAC concedido ou telas do ATS.

## Como validar

1. Logado como Guilherme, abrir Vagas: as 3 vagas publicadas da Priscila passam a aparecer, além das próprias.
2. Um usuário sem `techhire.jobs.view.workspace` continua vendo só as próprias vagas e as em que é hiring manager/recruiter.
3. Usuário de outro workspace continua sem ver nada.
4. Abrir uma vaga da Priscila e confirmar candidaturas/pipeline visíveis; editar conforme a permissão concedida.
