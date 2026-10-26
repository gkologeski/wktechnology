# E2E Tests (Playwright)

Cobertura: smoke test público automático da tela de login. Com credenciais de teste, também roda o fluxo completo **Lead → Empresa → Contato → Negócio** e os diálogos de confirmação.

## Pré-requisitos

1. **Instalar browsers** (uma única vez):

   ```bash
   bun run test:e2e:install
   ```

2. **Opcional: variáveis de ambiente** — usuário de teste com perfil Admin para rodar os testes autenticados:

   ```bash
   export E2E_USER_EMAIL="seu-teste@exemplo.com"
   export E2E_USER_PASSWORD="..."
   # ou use E2E_EMAIL / E2E_PASSWORD
   # Obrigatório para testes autenticados: ambiente local isolado
   export E2E_BASE_URL="http://127.0.0.1:5175"
   export E2E_SUPABASE_URL="http://127.0.0.1:54521"
   export E2E_SUPABASE_ANON_KEY="<chave pública do ambiente LOCAL>"
   ```

   > Sem essas variáveis, `bun run test:e2e` roda apenas os testes públicos automáticos e pula os testes autenticados.

O aplicativo e o banco precisam ser locais, sem redirects externos, e o banco deve conter o marcador `__isolated_marker` com label `techerp-isolated-harness`, legível pela conta de teste. O harness isolado cria esse marcador. Não configure produção: URLs remotas e configuração incompleta são recusadas antes do seed. O helper não herda a conexão Supabase do aplicativo. Testes pulados por falta de credenciais não representam aceite funcional.

## Rodar

```bash
bun run test:e2e          # headless
bun run test:e2e:ui       # modo UI interativo
```

## O que é testado

### `public-smoke.spec.ts`

- Abre `/login` sem autenticação
- Valida título, email, senha e botão Entrar

### `lead-convert-flow.spec.ts`

- Seed de um Lead via Supabase
- Abre `/leads/:id`, dispara **Converter** → confirma no `AlertDialog`
- Valida no banco que **Company + Contact + Deal** (stage `qualified`) foram criados e vinculados
- Valida que aparecem nas listas de `/companies`, `/contacts`, `/deals`
- Cleanup de todos os registros

### `confirm-dialogs.spec.ts`

- **AlertDialog de exclusão (detalhe do lead)** — testa Cancelar + Excluir
- **AlertDialog de exclusão em massa (/leads)** — seleciona 2 e exclui
- **ConfirmCountDialog (/companies)** — verifica que o botão fica desabilitado até a quantidade correta ser digitada
