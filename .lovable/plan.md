# Conectar LinkedIn via Unipile — descoberta na UI

## Situação atual

A funcionalidade **já existe e está funcional**:

- Página completa em `/settings/integrations/linkedin` (`src/routes/_authenticated/settings.integrations.linkedin.tsx`) com:
  - Botão "Conectar LinkedIn" (Unipile Hosted Auth — credenciais não passam pelo TechHire)
  - Status da conta (conectado / pendente / erro / desconectado)
  - Configuração de janela horária human-like (fuso + hora início/fim)
  - Painel de uso diário por endpoint (profile.fetch, profile.search, message.send, invite.send, chat.list)
  - Ações Reconectar / Desconectar / Atualizar
- Server functions em `src/lib/unipile/accounts.functions.ts` (start/disconnect/reconcile/getAccount/getRateUsage/updateDailyWindow)
- Webhook `/api/public/unipile/webhook` e página de retorno `/unipile-connected`
- Secrets `UNIPILE_DSN`, `UNIPILE_API_KEY`, `UNIPILE_WEBHOOK_SECRET` já configurados

**O que falta:** a tela não aparece no Marketplace de Integrações (`/integrations`) nem em nenhum item de menu, então o usuário não a encontra.

## Escopo (apenas UX/descoberta, sem alterar lógica)

### 1. Adicionar "LinkedIn (Unipile)" ao Marketplace de Integrações

- Editar `src/lib/integrations/registry.ts`:
  - Adicionar `"linkedin"` ao union `ProviderSlug`
  - Adicionar entrada `PROVIDERS`: nome "LinkedIn (Unipile)", categoria `crm` (ou nova `sourcing` — decidir usar existente pra não mexer no CATEGORY_LABELS), ícone `Linkedin` do `lucide-react`, cor `bg-[#0A66C2]`, `authMode: "oauth"`, descrição curta sobre buscar perfis, capturar candidatos e mensageria com limites human-like
- Editar `src/routes/_authenticated/integrations.$slug.tsx` para, quando `slug === "linkedin"`, redirecionar/link para `/settings/integrations/linkedin` (padrão já usado por outros providers com página dedicada, se houver — verificar) OU renderizar um card curto com botão "Abrir configuração" apontando para essa rota

### 2. Item de menu direto em Configurações

- Editar `src/lib/menu-config.ts`: adicionar entry `{ to: "/settings/integrations/linkedin", label: "LinkedIn (Unipile)", icon: Linkedin, need: "admin" }` na seção de Configurações/Integrações (localizar seção equivalente próxima ao item "Integrações")

### 3. Documentação in-app

- Texto atual da página já explica o fluxo. Sem mudanças.

## Fora de escopo

- Não alterar server functions, tabela `unipile_accounts`, RLS, webhook, limites, janela horária ou lógica de reconciliação
- Não mexer em fluxos de hunting/captura que já consomem a conexão

## Validação manual

1. Acessar `/integrations` → filtrar categoria → ver card "LinkedIn (Unipile)"
2. Clicar no card → cair em `/settings/integrations/linkedin`
3. Menu lateral (admin) → Configurações → item "LinkedIn (Unipile)" leva à mesma tela
4. Clicar "Conectar LinkedIn" → abre Unipile Hosted Auth → retorna em `/unipile-connected` → redireciona → status "Conectado"