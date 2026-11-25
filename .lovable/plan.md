# Variáveis de logo: cliente e prestadora

Porte **M** — estimativa **~2 h** (implementação, testes, Ajuda, Playwright). Não publicar.

## O que muda para você
- Duas novas variáveis em cotações e propostas (texto rico e editor visual):
  - `{{company.logo}}` — logo da empresa cliente, cadastrada em **Empresas**.
  - `{{provider.logo}}` — logo da empresa prestadora (WK/GM/CMK).
- No editor visual, o elemento Imagem ganha a opção "Vincular ao logo do cliente", além do já existente logo da prestadora.
- Sem logo cadastrado: a imagem some (texto rico) ou mostra espaço vazio discreto (visual) — nunca imagem quebrada.
- Funciona na ficha, no link público e no PDF.

## Regras
- Logo do cliente segue a mesma ordem do resto do sistema: logo manual → logo pelo domínio → nada.
- Leitura respeita permissões e workspace atuais; o link público só usa a imagem já resolvida da própria proposta/cotação, sem expor cadastro.

## Detalhes técnicos
- `visual-renderer.ts`: `bindLogo: "client"` + `clientLogoUrl` no contexto; tokens de imagem nas variáveis.
- Texto rico: interpolar `{{company.logo}}`/`{{provider.logo}}` como `<img>` sanitizado (URL https validada) no renderizador de cotação e de proposta (`loadProposalDocument` e equivalente da cotação).
- Carregar `companies.logo_url/domain` e logo da pessoa jurídica no servidor com o cliente do usuário (RLS).
- Listas de variáveis nos editores (`VISUAL_VARIABLES` e seletor de texto rico).
- Testes unitários de interpolação (com/sem logo, URL inválida bloqueada); contrato de permissões/hash; artigo de Ajuda (bump de versão); `permissions:check`, `help:coverage`, lint, build, Playwright.
