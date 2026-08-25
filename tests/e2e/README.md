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
   # opcional — por padrão usa a URL de preview do projeto
   export E2E_BASE_URL="https://id-preview--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app"
   ```

   > Sem essas variáveis, `bun run test:e2e` roda apenas os testes públicos automáticos e pula os testes autenticados.

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
