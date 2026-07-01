## Objetivo
Ajustar o grupo "Hunting (LinkedIn)" no sidebar do TechHire em `src/lib/menu-config-ats.ts`:
- Remover o item **"Instalar extensão"** (`/hunting/install`).
- Adicionar itens que existem como rota mas não aparecem no menu.

## Auditoria
Rotas Hunting existentes em `src/routes/_authenticated/(ats)/hunting/`:
- `index.tsx` → já no menu (Hub)
- `captures.tsx` → já no menu (Capturados)
- `templates.tsx` → já no menu (Templates)
- `install.tsx` → **remover do menu** (rota fica acessível via URL direta)
- `search.tsx` → **faltando** — busca de perfis via Unipile
- `observability.tsx` → **faltando** — métricas/logs de hunting

## Alteração
Arquivo único: `src/lib/menu-config-ats.ts`, grupo "Hunting (LinkedIn)".

Novo conteúdo do grupo (ordem lógica: descobrir → capturar → engajar → observar):

```text
Hunting (LinkedIn)
  Hub               /hunting              (Search)
  Buscar perfis     /hunting/search       (Search)  ← novo
  Capturados        /hunting/captures     (Inbox)
  Templates         /hunting/templates    (Mail)
  Observabilidade   /hunting/observability (Activity) ← novo
```

Ajustes de import: adicionar `Activity` a `lucide-react` (reaproveitar `Search` para "Buscar perfis"). Remover `Download` que passa a ser não utilizado.

Nenhuma rota é criada/removida — apenas visibilidade no menu. `ATS_ROUTE_PREFIXES` continua correto (todos caem sob `/hunting`). Rota `/hunting/install` permanece funcional se acessada diretamente.

## Fora do escopo
Não alterar outros grupos do sidebar, nem criar telas para itens do menu que ainda não têm rota (ex.: `/compliance`, `/dei-analytics`, `/match-scores`, `/fraud-flags`, `/careers`) — isso é assunto separado.

## Validação manual
1. Abrir TechHire → sidebar → grupo "Hunting (LinkedIn)".
2. Confirmar ausência de "Instalar extensão".
3. Confirmar presença de "Buscar perfis" (→ `/hunting/search`) e "Observabilidade" (→ `/hunting/observability`).
4. Clicar em cada um e conferir carregamento sem redirect ao TechSales.
