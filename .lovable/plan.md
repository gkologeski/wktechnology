# Busca global mais rápida

## O que já foi confirmado
- A busca procura em 7 lugares ao mesmo tempo: Contatos, Empresas, Negócios, Chamados, Atividades, Candidatos e Vagas. Ela só mostra resultado quando todos terminam.
- Atividades têm cerca de 462 mil registros, e a busca também lê o texto completo de cada uma (o corpo do e-mail ou da nota). Esse texto não tem índice de busca, então o banco precisa ler tudo. É o suspeito principal da lentidão.
- O mesmo vale para a descrição dos Chamados. O nome de Contatos, Empresas, Negócios e o assunto das Atividades já têm índice.
- A busca dispara 150 ms depois da última tecla, já com uma única letra.

A causa exata ainda será medida antes da correção (passo 1).

## O que será feito
1. **Medir:** rodar cada uma das 7 consultas com termos reais (1, 2 e 4 letras) e anotar o tempo de cada uma, para confirmar quem atrasa.
2. **Atividades:** a busca rápida passa a procurar só no assunto, que já tem índice. O texto completo deixa de travar a lista.
3. **Índices:** criar índices de busca onde ainda faltam (descrição de Chamados, domínio de Empresas, nome e e-mail de Candidatos, título de Vagas) e confirmar que o banco passa a usá-los.
4. **Mostrar aos poucos:** cada grupo aparece assim que fica pronto, em vez de esperar o mais lento. Uma consulta que demorar demais é cortada e o grupo mostra "não foi possível buscar aqui", sem derrubar os outros.
5. **Digitação:** buscar a partir de 2 letras, esperar 250 ms depois da última tecla e cancelar a busca anterior quando a pessoa continua digitando.
6. **Validar:** medir de novo no navegador com Playwright e comparar o antes e o depois.

Nada muda nas permissões: cada pessoa continua vendo só o que já podia ver.

## Detalhes técnicos
- `src/lib/search/global-search.functions.ts`: separar em uma chamada por tipo (ou uma por grupo) com `limit` e timeout. Remover `body.ilike` de activities. Medir `t0` por tipo no log, sem registrar o termo buscado.
- `global-search.tsx`: um `useQuery` por tipo, `placeholderData` para manter os resultados anteriores, mínimo de 2 caracteres, debounce de 250 ms e `signal` para cancelar.
- Migration aditiva: índices `gin (col gin_trgm_ops)` em `tickets.description`, `companies.domain`, `ats_candidates.full_name/email` e `ats_jobs.title`, só onde o EXPLAIN mostrar varredura completa. Não mexe em RLS nem em dados.
- Validações: EXPLAIN ANALYZE antes e depois, testes, typecheck, lint, build e Playwright.
