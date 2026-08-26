# Ajustar diagnóstico e configuração OAuth do Conta Azul

## Resposta curta

Pelo código e pela documentação pública do Conta Azul, os parâmetros obrigatórios básicos já estão sendo enviados: `response_type=code`, `client_id`, `redirect_uri`, `state` e `scope=openid profile aws.cognito.signin.user.admin`.

Se a mesma tela aparece antes de voltar ao TechERP, o cenário mais provável não é falta de parâmetro obrigatório, e sim inconsistência entre o cadastro do app no Conta Azul e a URL gerada pelo TechERP. Dois pontos merecem atenção:

- Se a aplicação criada no Conta Azul for de **Desenvolvimento**, a documentação indica uma URL de teste (`https://www.contaazul.com`) e dados fictícios; isso pode não aceitar o callback real do TechERP.
- O campo “URL p/ obter o Código de Autenticação” fornecido pelo Conta Azul pode conter uma URL pronta com parâmetros exatos que devem ser preservados. Hoje o TechERP monta a URL com defaults e overrides, mas não compara automaticamente essa URL pronta com a URL efetiva usada no botão “Conectar”.

Usuário, senha e access token de teste não devem ser enviados como parâmetros na etapa de autorização OAuth. Usuário e senha são usados somente na tela de login do Conta Azul; access token manual não substitui o fluxo multi-workspace com refresh token.

## Plano de implementação

1. **Suportar a URL oficial fornecida pelo Conta Azul**
   - Permitir configurar a URL completa “URL p/ obter o Código de Autenticação” como valor canônico de autorização.
   - Preservar parâmetros fixos vindos dessa URL quando existirem.
   - Sobrescrever apenas os campos dinâmicos que precisam ser gerados pelo TechERP: `state` e, quando necessário, `redirect_uri`.
   - Manter compatibilidade com as variáveis atuais (`CONTAAZUL_AUTH_URL`, `CONTAAZUL_TOKEN_URL`, `CONTAAZUL_API_BASE`, `CONTAAZUL_REDIRECT_URI`).

2. **Adicionar checagem de parâmetros obrigatórios no diagnóstico**
   - Mostrar se a URL efetiva contém `response_type`, `client_id`, `redirect_uri`, `state` e `scope`.
   - Mostrar se o `redirect_uri` efetivo bate com o callback canônico do TechERP.
   - Mostrar alerta específico quando o callback efetivo for diferente do callback cadastrado/esperado.
   - Indicar quando a URL parece ser de aplicação de desenvolvimento/teste e pode não aceitar o callback real.

3. **Melhorar a mensagem para o erro antes do callback**
   - Quando uma autorização é iniciada e não retorna ao callback, manter o diagnóstico como “autorização no Conta Azul”.
   - Na tela, orientar a comparar exatamente: client-id mascarado, callback, escopos e URL de autorização.
   - Informar que usuário/senha/access token de teste não são parâmetros da URL de autorização.

4. **Criar uma validação segura da configuração**
   - Adicionar teste unitário para URL pronta do Conta Azul com parâmetros pré-existentes.
   - Garantir que `state`, `code`, `access_token`, `refresh_token` e `client_secret` nunca apareçam no diagnóstico.
   - Garantir que o `client_id` continue mascarado/fingerprinted.

5. **Configuração que provavelmente será necessária após o ajuste**
   - Salvar no backend a URL exata fornecida pelo Conta Azul para obter o código de autenticação.
   - Confirmar no portal do Conta Azul que o callback cadastrado é exatamente:
     `https://app.wktechnology.com.br/api/public/oauth/contaazul-callback`
   - Se o app atual for de desenvolvimento e exigir `https://www.contaazul.com`, criar/usar uma aplicação de produção no Conta Azul para permitir o callback real do TechERP.

## Validação

- Abrir o painel “Diagnóstico OAuth” e verificar se todos os parâmetros obrigatórios aparecem como presentes.
- Copiar a URL efetiva de autorização e comparar com a URL fornecida pelo Conta Azul.
- Iniciar o fluxo de conexão e confirmar se a tela do Conta Azul deixa de rejeitar a solicitação antes do callback.
- Se o callback ocorrer, confirmar que o TechERP salva os tokens e mostra status “Conectado”.
- Rodar testes focados da integração e validação de tipos/lint dos arquivos alterados.
