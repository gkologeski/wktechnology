# Aprofundar diagnóstico OAuth do Conta Azul

## Diagnóstico atual confirmado

- O painel anexado mostra que a URL gerada pelo TechERP contém os parâmetros obrigatórios básicos: `response_type=code`, `client_id`, `redirect_uri`, `state` e `scope`.
- O erro continua acontecendo na tela do Conta Azul, antes de retornar ao callback do TechERP. Nessa etapa, o sistema ainda não recebe `code`, `error` ou `error_description` do provedor.
- Portanto, o diagnóstico atual comprova que a URL está bem formada, mas ainda não permite confirmar se o aplicativo cadastrado no Conta Azul aceita aquele `client_id`, callback, ambiente e escopos.

## Plano de implementação

1. **Separar “URL bem formada” de “configuração aceita pelo Conta Azul”**
   - Alterar os textos do painel para não concluir “verificações aprovadas” como se a configuração externa estivesse validada.
   - Mostrar um status específico: “Parâmetros locais válidos; validação final depende do app cadastrado no Conta Azul”.
   - Quando a etapa ficar como “autorização aguardando retorno”, indicar que a falha ocorreu antes do callback e não deixou detalhes técnicos para o TechERP.

2. **Adicionar comparação segura com a URL oficial do Conta Azul**
   - Exibir campos separados para comparar/copiar: endpoint de autorização, `client_id`, callback, escopos e `redirect_uri` efetivo.
   - Permitir revelar/copiar o `client_id` completo apenas para usuários com permissão de gerenciar integrações; `client_id` não é segredo, mas continuará protegido por contexto/permissão.
   - Continuar nunca exibindo `client_secret`, access token, refresh token, authorization code ou `state` real.

3. **Registrar tentativa sem callback**
   - Ao clicar em “Conectar”, iniciar uma tentativa OAuth com timestamp.
   - Monitorar o popup: se ele for fechado sem mensagem de sucesso e sem callback, registrar diagnóstico seguro como “sem retorno do Conta Azul”.
   - Atualizar o painel automaticamente para mostrar essa origem do erro em vez de permanecer apenas como “aguardando retorno”.

4. **Melhorar a orientação para configuração externa**
   - Adicionar checklist objetivo no painel:
     - o app no Conta Azul precisa ser de produção quando o callback for `https://app.wktechnology.com.br/api/public/oauth/contaazul-callback`;
     - o callback cadastrado precisa ser exatamente igual, sem barra extra;
     - o `client_id` exibido no TechERP precisa ser o mesmo da URL fornecida pelo Conta Azul;
     - usuário, senha e access token de teste não entram na URL OAuth.
   - Se a URL cadastrada/fornecida apontar para `https://www.contaazul.com`, destacar que isso parece ambiente de desenvolvimento/teste e provavelmente não concluirá o callback real.

5. **Validação técnica**
   - Expandir testes unitários do diagnóstico para cobrir:
     - URL bem formada mas ainda não confirmada pelo provedor;
     - popup fechado sem callback;
     - `client_id` completo disponível apenas como valor não secreto;
     - remoção de `state`, `code`, tokens e segredo em qualquer saída para UI/log.
   - Executar testes focados e lint/typecheck dos arquivos alterados.

## Escopo

- Sem alteração de banco, RLS, sincronização financeira ou importação de dados.
- Sem uso de usuário/senha/access token de teste no fluxo OAuth.
- Sem exposição de segredos.

## Validação manual

1. Abrir `/integrations/contaazul`.
2. Expandir “Diagnóstico OAuth”.
3. Copiar callback, escopos e `client_id` e comparar com o app no Conta Azul.
4. Clicar em “Conectar”.
5. Se a tela do Conta Azul voltar a negar sem callback, fechar o popup e confirmar que o painel registra “sem retorno do Conta Azul”.
