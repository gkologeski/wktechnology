# Corrigir autenticação OAuth do Conta Azul

## Diagnóstico confirmado

- O fluxo atual usa endpoints legados: `https://api.contaazul.com/auth/authorize`, `https://api.contaazul.com/oauth2/token` e escopo `sales`.
- A documentação atual do Conta Azul usa o fluxo da API v2: autorização em `https://login.contaazul.com/#/oauth/authorize`, token em `https://api-v2.contaazul.com/oauth/token` e escopo fixo `openid profile aws.cognito.signin.user.admin`.
- Os segredos `CONTAAZUL_CLIENT_ID` e `CONTAAZUL_CLIENT_SECRET` existem no backend, mas seus valores permanecem ocultos. O erro `invalid_client` é compatível com credenciais da API atual enviadas ao endpoint legado.
- Hoje o `redirect_uri` varia conforme o domínio em que o usuário abriu o TechERP; o Conta Azul exige correspondência exata com o callback cadastrado na aplicação.

## Implementação

1. **Atualizar o cliente OAuth para a API atual**
   - Trocar os endpoints padrão de autorização, token e API para os hosts v2 oficiais.
   - Atualizar o escopo de autorização.
   - Enviar `client_id` e `client_secret` no formato aceito pelo endpoint de token, mantendo autenticação Basic.
   - Preservar as variáveis opcionais de override para compatibilidade controlada.

2. **Tornar o callback determinístico**
   - Introduzir `CONTAAZUL_REDIRECT_URI` como callback canônico do servidor, sem depender do domínio aberto no navegador.
   - Usar exatamente o mesmo valor na autorização, troca do código e renovação quando aplicável.
   - Manter no `state` apenas o domínio de retorno validado para devolver o usuário ao módulo correto após a conexão.
   - Adotar como callback de produção recomendado: `https://app.wktechnology.com.br/api/public/oauth/contaazul-callback`.

3. **Fortalecer validação e tratamento de erros**
   - Validar que a origem de retorno pertence aos domínios autorizados do projeto.
   - Converter respostas extensas do provedor em mensagens PT-BR curtas e acionáveis, sem exibir stack trace ou credenciais.
   - Registrar no servidor somente status/código seguro para diagnóstico.
   - Mostrar na tela quando a credencial existe, mas o callback ou cliente foi rejeitado.

4. **Compatibilidade da sincronização**
   - Revisar os caminhos usados pelas entidades sincronizadas contra a API v2 antes de alterar o `API_BASE` padrão.
   - Ajustar apenas os caminhos incompatíveis, preservando mapeamentos, persistência, isolamento por `workspace_id` e comportamento atual do cron.
   - Não alterar schema, RLS ou regras financeiras.

5. **Configuração externa necessária**
   - Cadastrar no aplicativo do Conta Azul exatamente o callback canônico acima.
   - Confirmar que `CONTAAZUL_CLIENT_ID` e `CONTAAZUL_CLIENT_SECRET` pertencem à mesma aplicação da API v2; se não pertencerem, atualizá-los pelos segredos do backend.
   - Publicar novamente após alteração de segredo/configuração para refletir em produção.

## Validação

- Testes unitários para URL de autorização, escopo, callback fixo, troca e renovação de token e sanitização de erros.
- Typecheck, lint e testes focados da integração.
- Fluxo manual completo: abrir o modal, autorizar, receber o callback, salvar tokens por workspace, fechar o popup e atualizar o status para “Conectado”.
- Smoke test de uma entidade de leitura e confirmação de que nenhuma credencial aparece em resposta, UI ou log.
