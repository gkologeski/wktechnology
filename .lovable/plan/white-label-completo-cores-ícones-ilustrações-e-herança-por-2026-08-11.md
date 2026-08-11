# White-label completo: cores, ícones, ilustrações e herança por módulo

Hoje o construtor de marca permite apenas nome, logo, favicon, cor primária, accent, raio, densidade e duas fontes. O branding por módulo permite ainda menos (nome do produto, logo, favicon, 2 cores). O plano expande isso para um sistema de tokens completo, com paleta clara e escura separadas, ícones/ilustrações personalizáveis e herança workspace → módulo.

## 1. Paleta completa (claro e escuro)

Novos tokens editáveis, cada um com valor para tema claro e tema escuro:

- Marca: primária, primária (texto sobre), accent, accent (texto sobre)
- Superfícies: fundo da página, superfície/card, superfície elevada, barra lateral, cabeçalho
- Texto: texto principal, texto secundário (muted), texto sobre marca
- Estrutura: borda, divisor, anel de foco
- Status: sucesso, aviso, erro, informação (cada um com cor de texto legível derivada)
- Funil/estágios: as cores das etapas de pipeline (`--hs-stage-*`), hoje fixas no CSS

Recursos de apoio:

- Paletas prontas ampliadas (presets), que preenchem os dois temas de uma vez
- Botão "derivar escuro do claro" para quem não quiser configurar manualmente
- Alerta de contraste (AA) quando texto/fundo ficam ilegíveis
- Restaurar padrão por token e por grupo

## 2. Tipografia e formas (mantidas, com mais opções)

- Catálogo de fontes ampliado (títulos e corpo), carregado no head da aplicação
- Raio e densidade continuam como hoje, agora refletidos também na prévia clara/escura

## 3. Ícones e ilustrações

- Estilo de ícones: espessura do traço e tamanho base (aplicados aos ícones Lucide via tokens)
- Logo em duas versões: claro e escuro, além de uma versão reduzida (símbolo) para a barra lateral recolhida
- Favicon
- Imagem/arte da tela de login e das páginas públicas
- Ilustração de estado vazio (empty state) padrão do workspace
- Todos com upload e prévia; se não enviados, o sistema usa o padrão atual

## 4. Herança por módulo

- Cada módulo (TechSales, TechHire, TechContracts, Projetos, Financeiro, People) passa a herdar todos os tokens do workspace por padrão
- Cada token pode ser sobrescrito no módulo, com indicador visual de "herdado" vs "personalizado" e botão "voltar a herdar"
- Ao entrar em um módulo, o tema aplicado é workspace + sobrescritas do módulo

## 5. Prévia ao vivo

- Prévia com alternância claro/escuro
- Cenas de prévia: cabeçalho + barra lateral, tabela/lista, formulário, cartões de KPI, badges de status e etapas, estado vazio, modal e tela de login
- Reflete cores, fontes, raio, densidade, ícones e logos em tempo real

## 6. Aplicação em toda a plataforma

- O provedor de branding passa a aplicar todos os novos tokens no `documentElement` (claro e escuro), com cache local para evitar "flash" na recarga
- Substituição das cores fixas de estágio no CSS por tokens que o branding pode sobrescrever

## Detalhes técnicos

- Migration aditiva: nova coluna `theme` (jsonb) em `public.workspace_branding` e em `public.module_branding`, guardando `{ light: {...}, dark: {...}, icons: {...}, assets: {...} }`. Colunas atuais (`primary_color`, `accent_color`, `radius`, `density`, fontes, logos) permanecem intactas e continuam sendo a fonte para compatibilidade; leitura faz merge `colunas → theme.light`. Nenhuma policy/RLS alterada — o jsonb entra nas tabelas já protegidas.
- `src/lib/branding.functions.ts` e `src/lib/modules/module-branding.functions.ts`: validação Zod do jsonb (chaves permitidas, cores hex/oklch), sem mudar autenticação nem escopo de workspace.
- Novo `src/lib/branding/tokens.ts`: catálogo único de tokens (chave CSS, rótulo pt-BR, grupo, padrão claro, padrão escuro) usado pelo formulário, pela prévia e pela aplicação em runtime — evita divergência.
- `src/lib/branding/derive.ts`: derivação de escuro a partir do claro e cálculo de contraste.
- `src/lib/branding.tsx`: `applyBranding` passa a iterar o catálogo e escrever variáveis para `:root` e `.dark`; cache em localStorage versionado (`v2`).
- Ícones: tokens `--icon-stroke` e `--icon-size` aplicados por CSS aos SVG Lucide; sem trocar a biblioteca de ícones.
- UI: `controls-panel.tsx` reorganizado em seções com abas Claro/Escuro; `live-preview.tsx` ganha as cenas novas; `module-branding-form.tsx` reaproveita o mesmo painel com estado de herança. Componentes seguem o design system (tokens semânticos, `FormSection`, `SectionHeader`, estados de loading/erro, foco visível, responsivo).
- Uploads reutilizam o `ImageInput` e o bucket já existente de imagens de branding.
- Validações a rodar: typecheck, lint, build e os testes existentes afetados.

## Fora de escopo

- Não altera RLS, permissões, schema de outras tabelas ou regras de negócio
- Não redesenha telas existentes além da tela de Branding
- Domínio customizado continua apenas como campo informativo (sem provisionamento automático)
