# Cobertura da Área de Ajuda

```bash
bun run help:coverage              # todas as telas
bun run help:coverage -- --module crm   # valida só os artigos de um módulo
bun run help:coverage -- --json    # relatório em JSON
```

Falha (saída 1) quando:

- **(a)** existe tela autenticada oficial sem artigo publicado cujo `route_pattern` case com ela;
- **(b)** existe artigo com `module_key` inválido;
- **(c)** artigo sem as seções obrigatórias do template (howto) ou sem título (demais tipos).

Telas consideradas: arquivos `createFileRoute` em `src/routes/_authenticated/**`
com `component`, exceto redirecionamentos, layouts puros e protótipos.
Artigos: `docs/help/<módulo>/<slug>.md` com cabeçalho YAML (mesmo conteúdo da
migration de seed). Regra e template: `docs/architecture/help-center.md`.

O comando integra a CI após a verificação de permissões. A cobertura identifica
telas, mas não substitui a auditoria factual das ações, permissões e limites.
