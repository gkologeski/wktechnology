# Painel de diagnóstico OAuth do Conta Azul

## Situação confirmada

- A falha do anexo ocorre na página de autorização do Conta Azul, antes de o provedor retornar ao callback do TechERP.
- O fluxo atual monta a autorização com `https://login.contaazul.com/#/oauth/authorize`, callback canônico `https://app.wktechnology.com.br/api/public/oauth/contaazul-callback` (salvo override de servidor) e escopos `openid profile aws.cognito.signin.user.admin`.
- A tela atual mostra apenas `configured`, conexão e `last_error`; não exibe os parâmetros efetivos nem diferencia a etapa que originou o erro.
- O callback hoje apresenta erros do provedor e da troca de token no popup, mas não persiste um diagnóstico estruturado para a tela da integração.

## Implementação

1. **Diagnóstico seguro no servidor**
   - Adicionar uma server function autenticada e protegida pelo mesmo RBAC da gestão de integrações para retornar a configuração OAuth efetiva.
   - Retornar: host/rota de autorização, callback exato, escopos, versão OAuth, presença das credenciais, identificação mascarada do cliente e origem de retorno normalizada.
   - Gerar uma URL de autorização própria para diagnóstico, removendo `state`, código, tokens e segredo; o `client_id` ficará mascarado/fingerprinted para comparação sem expor o identificador completo.
   - Validar automaticamente protocolo HTTPS, hosts esperados, callback absoluto e consistência entre os valores usados na autorização e na troca de token.

2. **Registrar a origem do erro**
   - Classificar falhas nas etapas: `configuração local`, `autorização no Conta Azul`, `callback`, `troca de token` e `renovação`.
   - Quando o callback receber um erro do provedor com `state` válido, persistir no `config` da integração somente código, descrição sanitizada, etapa e horário.
   - Quando a troca de token falhar, registrar status/código seguro e etapa, sem salvar resposta bruta, authorization code, `state`, token ou credenciais.
   - Preservar o último diagnóstico após falha e limpá-lo quando uma nova autorização for concluída com sucesso.

3. **Painel na tela Conta Azul**
   - Criar uma seção recolhível “Diagnóstico OAuth” dentro da integração, acessível somente a quem pode gerenciar integrações.
   - Exibir checks de configuração, URL sanitizada, callback copiável, escopos, endpoints/versão e “Último erro” com origem, horário, código e orientação curta em PT-BR.
   - Incluir ações para atualizar o diagnóstico e copiar valores seguros; manter loading, erro, vazio, foco visível, responsividade e dark mode com os componentes/tokens existentes.
   - Para o cenário do anexo, indicar claramente que a rejeição ocorreu no provedor antes do callback e sugerir conferir `client_id`, callback cadastrado e escopos, sem alegar uma causa específica que o provedor não informou.

4. **Escopo e segurança**
   - Sem migration, mudança de schema/RLS ou alteração da sincronização financeira.
   - Reutilizar o JSON `config` já existente em `integrations`, sempre isolado por `workspace_id`/workspace ativo.
   - Não expor `client_secret`, tokens, authorization code, `state`, IDs internos de usuário/workspace ou resposta bruta do provedor no cliente, logs ou mensagens.

## Validação

- Testes unitários para sanitização da URL, mascaramento, classificação por etapa e remoção de parâmetros sensíveis.
- Teste do callback para erro do provedor, falha na troca de token e sucesso que limpa o diagnóstico anterior.
- Executar typecheck, lint dos arquivos afetados e testes focados.
- Validação manual: abrir o painel, conferir/copiar callback e escopos, iniciar OAuth, simular/reproduzir falha e confirmar que a origem aparece sem dados sensíveis.
