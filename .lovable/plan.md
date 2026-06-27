# Plano: Validação Sourcing (Onda 5 / Slice 2)

Validação somente leitura — sem alterações de código, schema, RLS ou regras de negócio. Apenas correções pontuais se algum estado quebrado for detectado durante a execução (e somente após reportar).

## Escopo
Telas: `/sourcing`, `/sourcing/pools`, `/sourcing/sequences`, `/sourcing/referrals`.

## Execução (Playwright headless, viewport 1280x1800, sessão Supabase injetada)

### 1. Smoke navegacional
- Restaurar sessão via `LOVABLE_BROWSER_SUPABASE_*`.
- Visitar cada uma das 4 rotas; capturar screenshot inicial.
- Coletar console errors e network 4xx/5xx por rota.
- Confirmar que o item "Sourcing" aparece no menu lateral ATS e que `active-module` resolve para ATS (sem flip para CRM).

### 2. `/sourcing` (hub)
- 3 tiles (Pools, Sequências, Indicações) renderizam e navegam para as rotas-filhas.
- `AtsPageHeader` presente, hover/focus visíveis.

### 3. `/sourcing/pools`
- Estado inicial: loading → empty OR lista de pools.
- Abrir dialog "Novo pool", validar campos (nome, descrição, tipo static/smart), fechar sem salvar.
- Verificar `member_count`, ícones (Lock/Sparkles/Users2) renderizando.
- Confirmar que `listPools` responde 200 (network).

### 4. `/sourcing/sequences`
- Loading → empty OR cards.
- Abrir dialog "Nova sequência", validar campos.
- Em uma sequência existente (se houver): botão toggle Power/PowerOff e link "Abrir" → `/sourcing/sequences/$id` carrega editor de steps e enrollments sem erro.
- Se não houver sequência, criar uma temporária para validar o detalhe e remover via toggle (apenas se a função permitir sem efeitos colaterais; caso contrário, apenas reportar não-validado).

### 5. `/sourcing/referrals`
- Loading → empty OR lista.
- Validar filtros de scope (mine/all) e status.
- Validar dialog de submissão de indicação (campos obrigatórios, validação de email/url).

### 6. Checagens transversais
- Tokens semânticos (sem cores hardcoded visíveis fora do DS).
- Dark mode: alternar `class="dark"` no `<html>` e re-screenshot de cada rota.
- Responsividade: re-render em 768px e 375px para checar quebras.
- Acessibilidade rápida: foco visível no primeiro botão de cada página, `aria-label` em ícones-only.

## Entregáveis no relatório final
1. Tabela rota × (status HTTP, console errors, screenshots light/dark/mobile).
2. Lista de estados quebrados encontrados (se houver), com severidade.
3. Pendências de UX/UI vs `docs/techhire-design-system.md`.
4. Recomendação de correção (sem implementar) — caso encontre algo, peço aprovação antes de corrigir.

## Fora do escopo
- Alterar código, schema, RLS, server functions.
- Executar `processDueEnrollments` real ou enviar emails.
- Testar fluxos que disparam side-effects externos (Resend, WhatsApp).
