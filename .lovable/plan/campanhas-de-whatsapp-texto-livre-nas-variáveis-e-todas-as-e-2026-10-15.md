# Campanhas de WhatsApp: texto livre nas variáveis e todas as entidades

## O que muda

### 1. Variável com texto livre
- No seletor de cada variável ({{1}}, {{2}}…) entra a opção **"Texto livre"** no topo.
- Ao escolher, o segundo campo vira "Texto da variável" (obrigatório) e o mesmo texto vai para todos os destinatários. Ex.: {{2}} = "Lia".
- Os campos do banco continuam com o "valor se vazio" opcional.
- A prévia mostra o texto livre como os demais valores.

### 2. Mais campos e todas as entidades em qualquer público
O seletor passa a mostrar, para qualquer base (Leads, Contatos, Empresas ou Negócios), os grupos ligados ao registro:
- **Lead:** nome, sobrenome, nome completo, e-mail, empresa (texto), cargo, origem, status.
- **Contato:** nome, sobrenome, nome completo, e-mail, cargo, cidade, estado.
- **Empresa:** nome, setor, cidade, estado, site.
- **Negócio:** título, linha de serviço, origem, etapa, valor.
- **Responsável pelo registro**, **Responsável pelo contato**, **Responsável pela empresa**, **Responsável pelo negócio:** nome, primeiro nome e e-mail.
- **Remetente** (quem cria a campanha): nome e e-mail.

Como cada base encontra as outras:
- Lead → empresa do lead; contato e negócio quando o lead já foi convertido.
- Contato → empresa; negócio aberto mais recente do contato.
- Empresa → contato principal (o mais recente com telefone); negócio aberto mais recente.
- Negócio → contato principal e empresa (como hoje).
Quando o registro relacionado não existir, a variável usa o "valor se vazio"; sem ele, o destinatário aparece no aviso de variável vazia, como hoje.

## Regras preservadas
- Os campos continuam numa lista fixa de permitidos, lida no servidor e só dentro do workspace ativo, respeitando o que o usuário pode ver. Nada fora da lista entra na mensagem.
- O texto livre é limitado a 200 caracteres e não aceita quebra de linha (exigência da Meta para variáveis).
- Ritmo, janela de 24 h, cotas e disparo não mudam. Campanhas salvas antes continuam funcionando.

## Validação
- Testes: texto livre aplicado a todos; texto livre vazio bloqueia salvar; campos de responsável e de entidades relacionadas resolvidos; campo fora da lista recusado.
- Verificação de tipos, estilo, testes e montagem do site, com os resultados reais.
- Navegador em /campaigns/whatsapp: criar rascunho com {{2}} em texto livre e {{3}} com "Responsável pela empresa", conferir a prévia, excluir o rascunho. Nenhum envio, nada publicado.

## Detalhes técnicos
- `campaign-audience.ts`: `VariableBinding` ganha `{ kind: "static", value }` (sem `kind` = campo, compatível com o formato salvo); `resolveVariables` trata o estático; novos grupos `owner_record`, `owner_contact`, `owner_company`, `owner_deal`, `sender`; `fieldsForBase` passa a devolver todos os grupos; `isAllowedField` continua sendo a lista branca.
- `campaign-audience.server.ts`: ampliar `SELECT` (incluir `assigned_to`, `status`, `stage`, `amount`, `converted_contact_id` conforme colunas reais, a confirmar na leitura do schema); buscar em lote contatos/negócios relacionados (`deal_contacts`, `deals.company_id`) e membros do workspace (`profiles` por `assigned_to`) com o cliente do usuário (RLS).
- `createWhatsAppCampaign`/`previewCampaignAudience`: validar o texto livre no servidor (tamanho, sem quebra de linha) e o remetente pelo `userId` da sessão.
- Tela: opção "Texto livre" no `Select`, rótulos acessíveis e grupos no seletor. Sem migration.
