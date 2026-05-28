# E2E Tests (Playwright)

Cobertura: fluxo completo **Lead → Empresa → Contato → Negócio** pela tela de detalhes, mais os novos diálogos de confirmação (AlertDialog de exclusão e `ConfirmCountDialog` com validação de quantidade).

## Pré-requisitos

1. **Instalar browsers** (uma única vez):
   ```bash
   bun run test:e2e:install
   ```

2. **Variáveis de ambiente** — usuário de teste com perfil Admin:
   ```bash
   export E2E_USER_EMAIL="seu-teste@exemplo.com"
   export E2E_USER_PASSWORD="..."
   # opcional — por padrão usa a URL de preview do projeto
   export E2E_BASE_URL="https://id-preview--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app"
   ```

   > Estas credenciais também ficam salvas como **secrets do projeto** (`E2E_USER_EMAIL` / `E2E_USER_PASSWORD`), mas só são injetadas em código backend. Para rodar Playwright localmente, exporte-as no seu shell.

## Rodar

```bash
bun run test:e2e          # headless
bun run test:e2e:ui       # modo UI interativo
```

## O que é testado

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
