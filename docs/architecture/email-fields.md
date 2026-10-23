# Campos de e-mail internacionais

## Contrato único

`src/lib/email-address.ts` é puro e compartilhado entre navegador e servidor.
`validator/lib/isEmail` valida a mailbox e `tr46` aplica UTS #46 não transicional,
STD3, hífens, Bidi, joiners e comprimentos DNS. Local part aceita UTF-8; o domínio
é persistido em ASCII/IDNA minúsculo. O local part mantém caracteres, case,
pontos e +tags; não há transliteração, remoção de espaços internos ou regras de Gmail.
Trim é só nas bordas. Controles, CRLF e caracteres invisíveis são recusados antes
do trim. São considerados os limites de 64 bytes no local part e 254 no endereço
canônico, além dos limites menores de colunas existentes.

É uma política de cadastro de endereços públicos: addr-spec sem display-name,
comentários, aspas ou IP literal; exige domínio completo com TLD. Não é um parser
de cabeçalho RFC 5322. Endereços de mensagens recebidas e buscas parciais têm
contratos próprios e não devem ser tratados como um campo de cadastro.

## Interface

Todo `Input type="email"` encaminha para `EmailNativeInput`, inclusive o type
resolvido de metadados. `EmailInput` é a API por string sobre o mesmo componente.
O elemento HTML usa `type=text` + `inputMode=email` porque a validação nativa do
navegador pode recusar endereços internacionais válidos. `setCustomValidity`
bloqueia o formulário de verdade; `required`, disabled, readonly, refs, FormData,
eventos e mensagens pt-BR continuam funcionando. Erros têm aria-invalid e descrição
associada após blur/submit. `multiple` valida a lista inteira por `parseEmailList`.
Filtros e busca de participante por nome/e-mail continuam sendo textos parciais;
a adição efetiva do participante passa pelo validador.

Workflows aceitam variáveis: o literal usa o campo padrão; quando há `{{...}}`
a edição permite o token e o valor resolvido é validado no servidor.
Campos personalizados são validados pelo tipo salvo da definição no servidor,
mesmo quando a chave não contém a palavra email. Edição inline e botões fora de
formulários validam também na ação de salvar.

## Entradas e limites

`emailSchema(maxLength?)` substitui z.string().email() nas APIs e server functions;
normaliza domínio e preserva optional/nullable já declarados por cada chamada.
`normalizeEmailFields` valida somente as colunas de mailbox do payload de PATCH,
sem interpretar textos de mensagens/configurações como endereços. A prévia CSV
conta linhas inválidas e mostra os números das linhas; executar não importa essas
linhas nem elimina apenas o endereço. A importação CSV legada recusa o lote antes
de escrever se houver um e-mail inválido. Nada reescreve o histórico existente.

Formulários de incorporação externos usam teclado de email sem a restrição HTML
ASCII; a resposta do servidor valida todos os campos declarados como email e
retorna 422 com a identificação do campo. A biblioteca completa não é embutida
no script externo; a validação internacional completa nesse canal acontece no envio.

Não há consulta DNS/MX nem envio de confirmação automático: sintaxe não demonstra
que uma caixa existe ou que seu destinatário autoriza contato. UTF-8 antes do @
exige SMTPUTF8 no transporte; aceitar o cadastro não acrescenta esse recurso ao
provedor de autenticação ou de envio. Erros do provedor continuam sendo expostos;
nunca inventar substituto ASCII, sucesso de envio ou existência da conta.

## Evidências e regressão

`email-address.test.ts` verifica idiomas, IDNA, +tags, bytes, limites, rejeição de
injeção/listas e paridade entre isEmail, schemas e coerceBulkValue. `email-input.test.ts`
valida a submissão real de formulário, ref, FormData, required, optional, readonly,
disabled e feedback acessível. `email-field-guard.test.ts` faz varredura AST de src
para barrar novos type=email HTML nativos e schemas .email() divergentes.
Gate oficial: verify + build.

Fontes: [RFC 6531](https://www.rfc-editor.org/rfc/rfc6531.html),
[UTS #46](https://www.unicode.org/reports/tr46/),
[validator.js](https://github.com/validatorjs/validator.js),
[tr46](https://github.com/jsdom/tr46).
