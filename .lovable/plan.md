# Diagnóstico da publicação (somente leitura) — concluído

## Evidências (24/11/2026, ~20:08 UTC)
- Projeto em `0cae24b54644c259775fce615309dc6b2895d485` (merge do PR #56).
- `/build-info.json` em wktechnology.lovable.app e app.wktechnology.com.br: hash `a65fd8c988be94faf64f16e3879614d3f6bb6e7818981a496e724d361de32d80`, gerado em 2026-11-24 20:02:47 UTC (igual ao esperado).
- Configuração de publicação: publicado em 2026-11-24 20:06:15 UTC, sem alterações pendentes, visibilidade pública.
- Único erro "permission denied for table deals" na última hora: 20:04:21 UTC, antes da publicação terminar (20:06:15). Nenhum erro depois disso.

## Conclusão
A implantação terminou com sucesso. Não é preciso publicar de novo. A leitura anterior com hash antigo e o erro do MCP aconteceram antes de a nova versão entrar no ar.

## Próximo passo (para o usuário, sem ação minha)
Chamar `list_deals` de novo pelo MCP (reconectar se o cliente guardar sessão) e conferir se os negócios aparecem com `value` mascarado quando for o caso.
