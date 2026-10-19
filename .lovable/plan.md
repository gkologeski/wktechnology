# Busca global: incluir o texto completo das Atividades

## O que já foi confirmado
- Hoje a busca global procura nas Atividades só pelo assunto (índice de busca já existe). O texto completo foi retirado porque levava de 8 a 37 segundos.
- São 426 mil atividades, quase todas com texto. Média de 1.225 caracteres, máximo de 711 mil, cerca de 316 MB no total. O texto vem em HTML (e-mails, notas).
- O texto completo não tem nenhum índice de busca.

## Recomendação
Um índice por letras soltas sobre 316 MB de HTML ficaria enorme e lento para gravar. O recomendado é a **busca por palavras em português** (o mesmo tipo de busca do Google): ela encontra "proposta" em "propostas", ignora acentos e tags HTML e usa um índice compacto.

## O que será feito
1. **Índice novo** no texto das atividades: tira o HTML, ignora acentos, considera os primeiros 20 mil caracteres de cada atividade (cobre praticamente todos os e-mails e notas) e indexa por palavra em português.
2. **Busca em duas partes no grupo Atividades:**
   - assunto parecido com o que foi digitado (como já é hoje);
   - texto contendo as palavras digitadas (novo, usa o índice).
   Os resultados são juntados sem repetição, e quem bate no assunto aparece primeiro.
3. **Trecho no resultado:** quando a atividade for achada pelo texto, mostrar um pequeno trecho com a palavra encontrada, para a pessoa saber por que ela apareceu.
4. **Limite de tempo:** se o texto demorar demais, o grupo mostra os resultados do assunto e um aviso discreto, sem travar os outros grupos.
5. **Permissões iguais:** cada pessoa continua vendo só as atividades que já podia ver.
6. **Validar:** medir antes e depois com termos reais (1, 2 e 3 palavras), conferir no banco que o índice é usado, testar no navegador com Playwright e rodar testes, typecheck, lint e build.

## Limitações
- A busca no texto é por palavra inteira ou começo de palavra ("propos" acha "proposta"), não por pedaço no meio da palavra.
- Trechos depois dos primeiros 20 mil caracteres de um e-mail muito longo não entram.
- Criar o índice leva alguns minutos e não altera nenhum dado.

## Detalhes técnicos
- Migration aditiva: função `IMMUTABLE` `public.activity_body_search_doc(text)` = `to_tsvector('portuguese', unaccent_immutable(left(regexp_replace(body,'<[^>]+>',' ','g'),20000)))` (usar wrapper imutável de `unaccent` se a extensão existir; senão sem unaccent) e `CREATE INDEX activities_body_fts_idx ON activities USING gin (public.activity_body_search_doc(body))`. Sem RLS/dados alterados.
- `global-search.functions.ts`: para `activities`, consulta extra com `.textSearch` sobre a expressão via RPC `SECURITY INVOKER` `global_search_activity_ids(q, limit)` usando `websearch_to_tsquery` + prefixo `:*`, respeitando RLS; merge com resultados por `subject`; `ts_headline` para o trecho.
- `global-search.tsx`: renderizar trecho em texto puro (sem HTML).
- EXPLAIN ANALYZE antes/depois; Playwright com sessão real.
