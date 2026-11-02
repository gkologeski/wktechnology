# Variáveis das Sequências com escolha de campo (igual às Campanhas WhatsApp)

**Porte M — estimativa 1h30 a 2h** (tela + preenchimento no envio + testes + registro de permissões). Nada é publicado sem seu pedido.

## O que muda para você
Em Prospecção → Sequências, no passo de WhatsApp, cada "Valor da variável N" deixa de ser só um campo de texto livre e passa a ter:
- **Seletor de campo** agrupado por entidade — Lead, Contato, Empresa, Negócio — com **todos os campos** do cadastro, inclusive os personalizados, pesquisável (a mesma lista usada nos filtros de público da campanha de WhatsApp).
- Opção **"Texto fixo"** para quem quiser digitar um valor igual para todos.
- **Valor padrão** opcional, usado quando o campo estiver vazio para aquela pessoa (sem ele, o envio daquela pessoa é pausado com o motivo "variável sem valor", como já acontece hoje).
- Prévia do modelo com o nome do campo no lugar de {{1}}, {{2}}…

Nos passos de e-mail (assunto e corpo), um botão **"Inserir variável"** com a mesma lista, que coloca o campo no texto.

Escolhas já salvas em texto livre continuam valendo como "Texto fixo".

## Regras
- Só aparecem campos que você tem permissão de ver; campos protegidos seguem ocultos/mascarados como nas campanhas.
- Empresa e Negócio são os vinculados ao lead/contato inscrito (negócio: o aberto mais recente). Se não houver vínculo, vale o valor padrão.
- Nenhuma permissão nova: reaproveita as de Sequências e de Inbox WhatsApp já exigidas.

## Detalhes técnicos
- UI: `sequence-template-picker.tsx` usa `useAudienceFilterFields` e um novo `sequence-variable-field.tsx` (Combobox agrupado + fallback). Grava `variables[n]` como `{{entidade.coluna}}` ou `{{entidade.coluna|padrão}}` — mesmo esquema de texto atual, sem mudança de banco.
- E-mail: botão de inserção em `sequences-page.tsx` nos campos assunto/corpo.
- Servidor: `tokenContext` em `delivery.server.ts` passa a montar `{ lead | contact, company, deal, agent }` lendo pelas views `shared_fields_<tabela>` (respeitando campos protegidos), validando cada chave com `isAllowedField`; suporte a `|padrão` em `requiredTokens`. Mantém os tokens antigos (`full_name`, `company`).
- Validação de publicação (`preflight.ts`) aceita só campos do catálogo permitido.
- Testes: resolução por entidade, padrão quando vazio, campo não permitido recusado, token antigo preservado.
- Atualizar hashes em `docs/security/permission-contracts.json`; rodar `permissions:check`, testes de sequências e Playwright na tela com sua conta.
