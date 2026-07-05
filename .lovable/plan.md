## Diagnóstico

Ao entrar em uma vaga e clicar em um candidato, a rota `/candidates/$id` chama `getCandidateDetail`, que faz:

```ts
supabase.from("ats_candidates")
  .select(...)
  .eq("id", data.id)
  .eq("owner_id", userId)   // ← filtro redundante
  .maybeSingle();
```

O filtro `owner_id = userId` exclui candidatos criados por **outros membros do mesmo workspace** — mesmo que a RLS permita a leitura (candidatos compartilhados, ex.: capturados por outro recrutador, ou associados via vaga do workspace). Resultado: `cand = null` → a página renderiza "Candidato não encontrado".

É exatamente o mesmo problema que causou os erros recentes em `ats_pipelines` / `ats_jobs` (`saveAtsJob`). A RLS já garante que o usuário só verá candidatos permitidos; o `.eq("owner_id", userId)` no servidor é redundante e quebra visibilidade compartilhada.

## Correção

Arquivo: `src/lib/ats/candidate-detail.functions.ts`

1. Em `getCandidateDetail` (linha ~144): remover `.eq("owner_id", userId)`. Manter `.maybeSingle()` e o retorno `null` quando a RLS de fato bloquear.
2. Auditar as demais queries do mesmo handler (`ats_applications`, `ats_talent_pool_members`, `ats_interviews`, `ats_offers`, `ats_candidate_flags`, eventos): elas já filtram por `candidate_id` e dependem da RLS — nenhuma mudança extra prevista, mas confirmar em leitura rápida que não há outro `.eq("owner_id", userId)` filtrando indevidamente relacionamentos do candidato.

Escopo: **somente leitura do detalhe do candidato**. Não altero `saveAtsCandidate`, `deleteAtsCandidate` nem RLS — mutações continuam protegidas pela RLS/policies existentes (padrão idêntico ao fix anterior de `saveAtsJob`).

## Validação manual

1. Logar como usuário A no workspace.
2. Abrir uma vaga que contenha candidatos criados por outro usuário B do mesmo workspace.
3. Clicar em um desses candidatos → a página de detalhe deve carregar normalmente, sem "Candidato não encontrado".
4. Verificar que candidatos próprios continuam abrindo.
5. Confirmar que um candidato de outro workspace (sem permissão RLS) continua retornando "não encontrado".

## Riscos

Baixo. A visibilidade real permanece governada pela RLS de `ats_candidates`. Se a policy hoje já permite SELECT de candidatos do workspace inteiro (que é o comportamento esperado, conforme o fix anterior de jobs/pipelines), o efeito é apenas destravar o que a RLS já autorizava.
