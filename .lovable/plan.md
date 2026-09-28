# Escolha do provedor de IA por workspace (Integrações)

## O que o usuário vai ver
Um novo card **"Inteligência Artificial"** em Configurações › Integrações, com uma tela própria:

- **Lovable AI (padrão)**: já vem ativa e não pede chave.
- **Provedores com chave própria**: OpenAI (ChatGPT), Anthropic (Claude), Google (Gemini), xAI (Grok), DeepSeek e OpenRouter (que distribui os pedidos entre vários modelos).
- **Para cada provedor**:
  - campo para colar a chave de API, que fica mascarada depois de salva;
  - escolha do modelo, com uma lista sugerida ou um nome digitado à mão;
  - botão "Testar conexão";
  - botão "Usar como padrão".
- **Status visíveis**: não configurado, configurado, testando, conectado, falha e desativado.
- **Voltar ao padrão**: um botão "Voltar para Lovable AI" a qualquer momento.
- **Quem pode alterar**: só administradores do workspace. Os demais usuários veem apenas qual provedor está ativo.

## Como funciona
- **Recursos afetados**: todos os recursos de IA do sistema passam a usar o provedor escolhido no workspace. Isso inclui copiloto, resumos, redação de e-mail, leitura de currículo, match de vagas, briefing diário, transcrição de ligações, análise de chamados e importação de modelos de contrato.
- **Falha do provedor**: se o provedor escolhido der erro de chave ou de créditos, o sistema **não** troca sozinho para outro. Ele mostra o erro do provedor e o card de Integrações passa para "falha", para você decidir o que fazer.
- **Recursos só da Lovable AI**: imagem, voz e embeddings continuam na Lovable AI.
- **Custos**: com chave própria, o consumo é cobrado pelo provedor, na conta dele. Na Lovable AI, continua saindo dos créditos do workspace.

## Segurança
- A chave fica guardada criptografada no cofre do banco. Ela é lida só pelo servidor, na hora de chamar a IA, e nunca volta para o navegador nem aparece nos logs.
- A configuração é isolada por workspace, com as permissões atuais: só administradores gravam.

## Fora do escopo
- Escolher um provedor diferente por recurso. Por enquanto é um único provedor para o workspace inteiro.
- Chave por usuário.

## Detalhes técnicos
- **Migração no banco**:
  - tabela `workspace_ai_settings`, com uma linha por workspace: `provider`, `model`, `status`, `last_error`, `last_tested_at`, `vault_secret_id` e `updated_by`;
  - GRANT de select para authenticated e all para service_role, RLS ativa, leitura para membros e escrita para admins via `has_role`/`user_can_act`;
  - funções `security definer` para gravar e ler a chave no Vault, com execute só para service_role.
- **Resolvedor único** em `src/lib/ai/provider-resolver.server.ts`: `resolveAiChat(workspaceId)` devolve `{ baseURL, headers, model, provider }`. Todos os provedores são chamados pelo formato compatível com OpenAI (`/chat/completions`):
  - OpenAI: `api.openai.com/v1`
  - Gemini: `generativelanguage.googleapis.com/v1beta/openai`
  - Anthropic: `api.anthropic.com/v1`, pela camada compatível
  - xAI: `api.x.ai/v1`
  - DeepSeek: `api.deepseek.com/v1`
  - OpenRouter: `openrouter.ai/api/v1`
  - Lovable: continua como fallback de configuração, quando não há linha, e não como fallback de erro.
- **Troca nos pontos de chamada**: `createLovableAiGatewayProvider` e as cerca de 23 chamadas diretas a `ai.gateway.lovable.dev/v1/chat/completions` passam a usar o resolvedor, mantendo prompts, schemas e comportamento. Chamadas de imagem, voz e embeddings não mudam.
- **Registro de integrações**: novo provider `ai` em `src/lib/integrations/registry.ts` (categoria "ai") com `href` para a rota `/_authenticated/settings/integrations/ai`.
- **Tela**: segue o padrão, com PageHeader, FormSection, StatusBadge, EmptyState, skeleton, ErrorState e confirmação ao trocar de provedor.
- **Server functions** em `src/lib/ai/ai-settings.functions.ts`, com `requireSupabaseAuth` e checagem de admin no servidor: `getAiSettings`, `saveAiProvider`, `testAiProvider` e `resetToLovable`.
- **Validação**: tsgo, ESLint, testes unitários do resolvedor (mapeamento de provedor para URL e cabeçalhos), teste de conexão real com a Lovable AI, e verificação no navegador do fluxo de configurar, testar, definir como padrão e voltar.
- **Pendência**: testar os provedores externos depende de você colar chaves reais.
