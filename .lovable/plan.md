
# Configurações — navegação mais limpa

## Problema

Hoje `/settings` mostra todos os ~30 links em pílulas horizontais agrupadas, cada grupo com seu próprio rótulo em caixa-alta. Isso gera:

- muito ruído visual (várias linhas de pílulas + rótulos em todas as larguras),
- difícil escanear por seção,
- o título "Pipelines" da página filha aparece logo abaixo de outro bloco "Pipelines" do menu,
- a pílula verde ativa repete a cor do título e desequilibra a hierarquia.

## Direção proposta

Adotar o padrão de painel de configurações de produtos como Linear, Vercel e HubSpot:

- **sidebar vertical fixa à esquerda** com as seções,
- **conteúdo da página à direita**, sem subnav extra em cima,
- cabeçalho "Configurações" some no desktop (vira só o título da sub-página); no mobile vira um `Select` com todas as opções.

```text
┌──────────────────────┬────────────────────────────────┐
│ Configurações        │  Pipelines                     │
│                      │  Gerencie pipelines e estágios │
│ MINHA CONTA          │  ────────────────────────────  │
│  Perfil              │                                │
│  Conexão de email    │  [ Serviços ]  [ Negócios ]    │
│  Segurança (2FA)     │                                │
│                      │  ...                           │
│ WORKSPACE            │                                │
│  White-label         │                                │
│  Idioma              │                                │
│  ...                 │                                │
└──────────────────────┴────────────────────────────────┘
```

## Mudanças

1. **`src/routes/_authenticated/settings.tsx`**
   - Trocar o bloco horizontal por um `grid` de duas colunas (`240px` + `1fr`) no desktop.
   - Sidebar:
     - rótulo da seção em `text-[11px] uppercase tracking-wider text-muted-foreground` com espaço acima,
     - itens como `Link` em linha única, padding `px-3 py-1.5`, raio `rounded-md`,
     - estado ativo: `bg-muted text-foreground font-medium` (sutil, sem verde primário),
     - hover: `hover:bg-muted/60`,
     - sem ícones — só texto, para reforçar o "clean".
   - Mobile (`<lg`): esconder a sidebar, mostrar um `Select` no topo com todas as rotas agrupadas por seção (`SelectGroup` + `SelectLabel`).
   - Remover o `PageHeader "Configurações"` daqui — cada sub-página já tem o seu próprio.

2. **Manter a estrutura de seções e rotas** exatamente como está (`Minha conta`, `Workspace`, `Estrutura CRM`, `Automação`, `Pessoas & Acesso`, `Segurança`, `Integrações`). Nenhuma rota muda, nenhum link é renomeado.

3. **Conteúdo (`<Outlet />`)** envolto em uma coluna com `max-w-5xl` para evitar linhas muito largas.

## Fora do escopo

- Reorganizar quais itens vão em qual seção.
- Renomear páginas ou criar nova rota índice de configurações.
- Mexer em qualquer página filha de `/settings/*`.
