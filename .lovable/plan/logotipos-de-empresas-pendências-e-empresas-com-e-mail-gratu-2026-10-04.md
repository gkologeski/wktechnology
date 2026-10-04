# Logotipos de empresas: pendências e empresas com e-mail gratuito

## 1. Enviar e trocar o logotipo na ficha da empresa
- O logotipo no topo da ficha vira um botão: "Enviar logotipo", "Usar logotipo automático" e "Remover".
- Aceita PNG, JPG, SVG e WEBP de até 1 MB, com prévia antes de salvar.
- Só aparece para quem pode editar a empresa. O banco também barra quem não pode.
- Cria uma pasta própria para logotipos, separada por workspace. Os logotipos podem ser vistos por quem tem o link, assim como já acontece com os logotipos automáticos.

## 2. Logotipo em mais lugares
- Cards do quadro de Negócios: logotipo pequeno ao lado do nome da empresa.
- Lista de Negócios e tabela estilo HubSpot: coluna Empresa com logotipo.
- Inbox: no seletor de cliente e no painel lateral, o logotipo da empresa do contato ou lead.
- Busca do logotipo feita junto com os dados que a tela já carrega, sem uma consulta por linha.

## 3. Empresas com e-mail gratuito (sugestão)
Hoje, quando o domínio é Gmail, Hotmail, UOL etc., o sistema mostra só as iniciais. Ordem de solução proposta:

1. **Usar o site, não o e-mail.** Quando o domínio é gratuito, o sistema tenta o campo Site da empresa.
2. **Sugerir o site pelo nome da empresa.** Na ficha, o botão "Encontrar logotipo" busca o nome em um catálogo gratuito de marcas e mostra até 5 opções com logotipo e site. O usuário escolhe e o site e o logotipo são gravados. Nunca grava sozinho, porque nomes parecidos causam erro.
3. **CNPJ.** Ao enriquecer pela BrasilAPI, quando a Receita tiver e-mail ou site corporativo, ele vira o domínio.
4. **Envio manual (item 1)** como último recurso.

Exceção: empresas cujo domínio real é de um provedor (ex.: UOL, `uol.com.br`) deixam de ser tratadas como gratuitas quando o domínio estiver no campo Site ou Domínio da própria empresa. A lista de domínios gratuitos passa a valer só para o domínio vindo de e-mails.

## 4. Verificação
- Testes automáticos dos novos casos de domínio.
- Playwright com sua conta: ficha em modo claro e escuro, envio de logotipo, quadro de Negócios, Inbox e celular.

## Detalhes técnicos
- Migration: bucket público `company-logos`, caminho `{workspace_id}/{company_id}.ext`. Envio, troca e exclusão exigem `is_workspace_member` + permissão de editar empresa. Novas colunas `logo_source` (`manual|auto|none`) e `logo_updated_at`.
- `logoDomain` ganha a opção `allowProvider` para domínio/site da empresa. A lista de domínios gratuitos vale só para e-mails.
- Busca por nome: server function autenticada que chama `autocomplete.clearbit.com/v1/companies/suggest` (gratuito, sem chave), com tempo limite e erros tratados. Logo.dev é a alternativa paga se o catálogo gratuito sair do ar.
- Enriquecimento por CNPJ: preencher `domain` a partir do e-mail ou site da Receita, só se estiver vazio e não for gratuito.
- `CompanyAvatar` reutilizado em `deals-board-card`, `deals-list`, `deals-hubspot-table` e `inbox-identity-linker`; inclui `logo_url`/`domain`/`website` nos selects existentes.
