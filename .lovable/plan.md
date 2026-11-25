# Razão Social e Nome Fantasia nas Empresas + CNPJ nos Prestadores PJ

**Porte M — estimativa 60–90 min** (migration aditiva, ficha da empresa, ficha da pessoa PJ, Ajuda e testes). Sem publicar.

## O que muda para você

1. **Ficha da empresa (`/companies/:id`)** ganha dois campos próprios em *Propriedades da empresa*: **Razão social** e **Nome fantasia**, editáveis como os demais. O campo "Nome" continua sendo o nome de exibição.
2. **"Enriquecer via CNPJ"** passa a preencher Razão social e Nome fantasia separadamente (e não mais sobrescrever o "Nome" com a razão social). Se já houver valor diferente, pede confirmação antes de substituir.
3. **Propostas, cotações e minutas** passam a usar a Razão social nativa; o campo personalizado `razao_social` e o "Nome" ficam como alternativas para cadastros antigos.
4. **Ficha do Prestador PJ (`/people/:id`)** ganha o botão **"Buscar dados do CNPJ"** ao lado do CNPJ, preenchendo Razão social e Nome fantasia (mesma confirmação antes de substituir). Os dados só são gravados ao salvar.

## Técnico
- Migration aditiva: `companies.legal_name text`, `companies.trade_name text` (nullable), GRANT de coluna igual aos campos existentes; backfill de `legal_name` a partir do campo personalizado `razao_social` quando existir. RLS inalterada.
- `enrichCompanyByCNPJ`: gravar `legal_name`/`trade_name`; manter gates de workspace ativo/permissão de edição de empresa e deny.
- Pessoa PJ: reutilizar a consulta CNPJ já usada em `/settings/legal-entities` (BrasilAPI → ReceitaWS) com gate de edição em TechPeople (`people` edit), apenas sugerindo valores no formulário.
- Resolvedor de razão social em propostas/minutas: `legal_name` → custom `razao_social` → `name`.
- Contrato de permissões/hash para arquivos alterados, artigos de Ajuda (empresas e pessoas) com bump de versão, testes unitários do resolvedor/mapeamento e de gate (permitido, sem chave, deny, outro workspace, inativo), Playwright autenticado nas duas fichas.
