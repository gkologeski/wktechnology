# Corrigir campo "Pipeline" em branco na vaga

## Diagnóstico (verificado)

A vaga "Desenvolvedor Fullstack" usa o pipeline `Pipeline padrão` que pertence à Priscila (mesmo workspace). Já o seletor da tela lista apenas os pipelines **criados pelo próprio usuário logado**: a função de listagem filtra por `owner_id = usuário atual`.

Resultado: o pipeline da vaga não existe na lista de opções, então o `Select` não encontra correspondência e aparece vazio (e o selo "Pipeline: ..." no cabeçalho também não aparece). No print, as duas opções mostradas ("RH – Seleção (padrão)" e "Pipeline padrão") são os pipelines do Guilherme — nenhuma é a da vaga.

Observações adicionais confirmadas no banco:

- As regras de acesso do banco já permitem que colegas do workspace vejam os pipelines (existe política por workspace/RBAC); o bloqueio está apenas no filtro do código.
- Existem pipelines duplicados: a Priscila tem dois "Pipeline padrão", ambos marcados como padrão.

## O que fazer

1. **Listagem por workspace** (`src/lib/ats/pipelines.functions.ts`): remover o filtro manual por `owner_id` na listagem, deixando as políticas do banco decidirem a visibilidade — igual ao que já foi feito em Vagas e Candidatos. A criação automática do pipeline padrão passa a ocorrer somente quando o workspace realmente não tiver nenhum pipeline visível.
2. **Escrita preservando autoria**: salvar/definir padrão/excluir continuam sem sobrescrever `owner_id`; remover apenas os filtros `owner_id = usuário` que impedem editar pipeline de colega, mantendo a validação de erro amigável quando o banco bloquear.
3. **Selo e seletor resilientes** (`src/routes/_authenticated/(ats)/jobs.$id.tsx`): se o pipeline da vaga ainda não estiver na lista carregada, exibir o nome dele como opção/rótulo em vez de campo vazio, evitando que um simples salvamento troque o pipeline sem intenção.
4. **Dedupe visual (opcional, sem migration)**: quando houver pipelines de mesmo nome, mostrar o nome com o dono para desambiguar (ex.: "Pipeline padrão · Priscila").

## Fora do escopo

- Não altera RLS, schema, `stages` nem regras de negócio.
- Não apaga nem mescla os pipelines duplicados da Priscila (posso fazer depois, com confirmação).

## Como validar

1. Abrir a vaga "Desenvolvedor Fullstack" com outro usuário do workspace: o campo Pipeline deve exibir "Pipeline padrão" (o da vaga) e o selo aparecer no cabeçalho.
2. Trocar o pipeline e salvar: deve pedir confirmação (há candidatos) e persistir.
3. Em /pipelines, conferir que os pipelines do workspace aparecem para os membros com permissão.
