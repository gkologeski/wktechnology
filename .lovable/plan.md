Plano para corrigir o comportamento do Assistente de IA

1. Corrigir a intenção “atualizar” vs “criar”
- Adicionar ferramentas explícitas de atualização para registros existentes, começando por:
  - atualizar e-mail/telefone/nome de lead;
  - atualizar e-mail/telefone/nome de contato.
- Atualizar o prompt do agente para proibir usar “criar contato/lead” quando o usuário pedir “alterar”, “atualizar”, “corrigir”, “inserir e-mail em registro existente”.
- Quando estiver em uma página de detalhe, o assistente deve considerar o registro atual como contexto prioritário. Ex.: estando em `/leads/3cb...`, “atualize o Bruno Linter” deve propor atualizar esse lead, não criar contato novo.

2. Corrigir a busca de Bruno Linter
- Melhorar `searchEntityImpl` para encontrar nomes completos, não apenas `first_name ilike '%Bruno Linter%'` ou `last_name ilike '%Bruno Linter%'`.
- A busca deve quebrar termos: `Bruno` + `Linter`, procurar por combinações em `first_name`, `last_name`, `email`, `phone`, `company_name` e retornar leads/contatos relevantes.
- Para solicitações ambíguas, o agente deve listar opções encontradas:
  - lead Bruno Linter;
  - contatos duplicados Bruno Linter;
  - perguntar qual atualizar, salvo quando a página atual já determinar o registro.

3. Fazer a aprovação executar a ação correta e refletir no registro
- Incluir cards de aprovação para atualização, com label correto: “Atualizar lead” / “Atualizar contato”, em vez de “Criar contato”.
- Ao aprovar, chamar a server function de update correspondente e retornar URL/resumo do registro atualizado.
- Após sucesso, invalidar/recarregar dados relevantes no cliente para a tela de detalhe mostrar o e-mail atualizado sem depender de refresh manual.

4. Evitar duplicidade e aprovações que voltam como pendentes
- Persistir o estado das ações aprovadas/rejeitadas ou, no mínimo, manter um mapa local por `messageId + toolName + payloadHash` para que o mesmo card não volte como “pendente” ao reabrir o drawer durante a sessão.
- Tornar ações aprovadas idempotentes quando possível:
  - update: repetir a aprovação deve manter o mesmo valor, não criar duplicatas;
  - create: usar validação prévia para avisar quando já existe registro muito parecido.

5. Persistir histórico do chat
- Usar as tabelas já existentes `copilot_sessions` e `copilot_messages`, que hoje estão vazias.
- Criar funções autenticadas para:
  - obter/criar sessão ativa do assistente;
  - listar mensagens da sessão;
  - salvar mensagem do usuário e resposta do assistente, incluindo `parts` de tool/proposal.
- Carregar esse histórico no `AgentDrawer` ao abrir, para não apagar a conversa ao recarregar ou sair/entrar novamente.

6. Segurança e permissões
- Todas as leituras e updates continuam via usuário autenticado e RLS do backend.
- Não abrir leitura pública/anon de dados comerciais.
- Validar autorização no backend antes de atualizar lead/contato.
- Não registrar tokens, e-mails sensíveis em logs técnicos desnecessários.

7. Validação
- Testar manualmente o fluxo reportado:
  1. abrir `/leads/3cb97e19-6029-4885-abfe-f954d04d8530`;
  2. pedir: “atualize o Bruno Linter com o e-mail bruno.linter@gmail.com”;
  3. confirmar que o card diz “Atualizar lead”, não “Criar contato”;
  4. aprovar;
  5. confirmar que o lead passa a ter o e-mail informado;
  6. fechar/reabrir o assistente e confirmar que o histórico e o estado aprovado permanecem coerentes.
- Também testar busca por “Bruno Linter” fora da página de detalhe para confirmar que leads e contatos existentes aparecem como opções.