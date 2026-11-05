# Área de Ajuda e Treinamento — regra permanente

A Ajuda (`/ajuda`) é o material oficial de operação do TechERP. Ela fica no
mesmo nível da regra de mockup: **nenhuma tela ou funcionalidade está pronta
sem o material da Ajuda correspondente.**

## Regra

Toda tela ou funcionalidade nova, e toda alteração em tela ou funcionalidade
existente, só está concluída quando o material correspondente na Área de Ajuda
for criado ou atualizado **na mesma entrega**. Isso inclui:

- artigo(s) do módulo (howto da funcionalidade e, se mudar, referência,
  permissões, erros comuns e FAQ);
- `route_pattern` para o botão "?" do cabeçalho;
- regras de permissão (quem vê, cria, edita, exclui, exporta, administra);
- incremento de `version` (o `updated_at`/`updated_by` é gravado pelo banco).

Remoção de tela/funcionalidade exige despublicar (`is_published = false`) ou
ajustar o artigo. Protótipos e telas não oficiais **não** entram na Ajuda.

Não invente funcionalidade: o conteúdo vem do código (rotas, menus, campos,
botões, validações, integrações, RLS/RBAC). Na dúvida, marque `[CONFIRMAR]`.
Se o código divergir da doutrina de `security-rbac.md`, documente o
comportamento pretendido e registre a divergência em `docs/help/divergencias.md`.

## Onde fica

| Peça | Local |
|---|---|
| Tabelas | `help_articles`, `help_feedback`, `help_route_misses` (migration `0306_help_center.sql`) |
| Regras de acesso | `src/lib/help/help-access.ts` (puro) e `help-access.server.ts` |
| Server functions | `src/lib/help/help.functions.ts` |
| Telas | `/ajuda`, `/ajuda/$module`, `/ajuda/$module/$slug` |
| Botão "?" | `src/components/help/help-button.tsx` no cabeçalho autenticado |
| Fonte versionada | `docs/help/<módulo>/<slug>.md` |
| Gravação no banco | Migrations de conteúdo já registradas são imutáveis; conteúdo posterior vai pelo lote editorial autorizado, idempotente, gerado de Markdown e conferido por versão/hash antes de aplicar |
| Cobertura | `bun run help:coverage` (`tests/help-coverage/`) |
| Auditoria de acesso | `tests/access-audit/access-audit.sql` |

## Acesso

- **Leitura:** membro ativo do workspace ativo; artigo publicado, `audience = internal`,
  módulo liberado (mesma regra do menu: licença ∩ permissões efetivas; admin do
  workspace irrestrito) e, se houver, a chave `min_permission` efetiva (deny
  prevalece). `core` = todo membro ativo; `platform` = só admin da plataforma.
  Filtrado no servidor (busca, URL direta e botão "?") e, no banco, pelo RLS
  (`help_can_read`).
- **Edição:** admin da plataforma ou membro ativo com `techservice.kb.manage.workspace`
  ou `techservice.kb.update.workspace` (permissões da Base de conhecimento).
  Atenção: o conteúdo é global, então o editor altera a Ajuda de todos os workspaces.
- **Avaliação:** cada usuário grava e lê só a própria; admin da plataforma lê todas.
- **`audience = client`:** apenas prepara o terreno; nenhum usuário externo lê.

## Convenções

- `module_key`: `crm`, `ats`, `people`, `contracts`, `projects`, `finance`, `core`, `platform`.
- `slug`: minúsculas, sem acento, palavras separadas por hífen, único por módulo,
  verbo no infinitivo para howto (`importar-contatos`), substantivo para os
  demais (`visao-geral`, `primeiros-15-minutos`, `campos-e-status`, `permissoes`,
  `erros-comuns`, `perguntas-frequentes`).
- `min_permission`: a mesma chave que libera o item de menu da tela (`permissionAny`).
  Itens sem chave no menu ficam com `min_permission` vazio (o módulo já filtra).
  Nunca invente chave: use o catálogo `permission-key-catalog.json`.
- `route_pattern`: caminho do roteador sem grupos/layouts (`/leads/$id`).

## Template do artigo howto (todas as seções obrigatórias)

```markdown
---
module_key: crm
slug: importar-contatos
title: Importar contatos
summary: Traga uma planilha de contatos para o TechSales.
article_type: howto
route_pattern: /contacts
min_permission: techsales.contacts.create.own
audience: internal
sort_order: 30
version: 1
is_published: true
---
# Importar contatos
**Para que serve:** 1–2 frases.
**Quem pode fazer:** papéis/permissões.
**Onde fica:** Menu > Módulo > Tela (rota).
**Antes de começar:** pré-requisitos.
## Passo a passo
1. Clique em …
## Resultado esperado
## Regras e limites
## Erros comuns
## Relacionados
<!-- screenshot: descrição do que capturar nesta etapa -->
```

Artigos obrigatórios por módulo: visão geral, primeiros 15 minutos, um howto por
funcionalidade, referência de campos e status, permissões do módulo, erros comuns
e FAQ. Marcadores de captura vão também para `docs/help/pendencias-midia.md`.

## Definition of Done (cole em cada prompt futuro)

- [ ] Artigo(s) da Ajuda criados/atualizados em `docs/help/<módulo>/` e na migration de seed.
- [ ] `route_pattern` aponta para a(s) tela(s) alterada(s); o botão "?" abre o artigo certo.
- [ ] Permissões descritas batem com menu, servidor e RLS; `min_permission` definido.
- [ ] `version` incrementada; removidos/alterados despublicados ou ajustados.
- [ ] `[CONFIRMAR]` e divergências RBAC registrados.
- [ ] `bun run help:coverage` sem novas telas descobertas.
- [ ] `psql -f tests/access-audit/access-audit.sql` sem categoria nova frente ao baseline.
