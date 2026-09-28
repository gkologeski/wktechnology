# Catálogo de arquétipos visuais no White Label

## Objetivo
Adicionar três modelos completos de design em **Configurações → White Label → Workspace**, permitindo visualizar, selecionar e aplicar um arquétipo como nova base visual do sistema. A aplicação substituirá cores, tipografia, densidade, raio e estilo dos ícones, mas preservará nome, logos, favicon, imagens, domínio, e-mail e rodapé.

Os módulos continuarão herdando o workspace normalmente. Não haverá seletor de arquétipo dentro do branding de cada módulo.

## Experiência de seleção
1. Incluir a aba **Modelos** antes de **Marca** e **Tema** no construtor do workspace.
2. Exibir três opções em cartões compactos, cada uma com:
   - nome, descrição curta e indicação de uso recomendado;
   - miniatura real construída com os próprios tokens do modelo;
   - amostras das superfícies, ação principal, status, tipografia, raio e densidade;
   - estados acessíveis de foco, seleção e modelo atualmente correspondente.
3. Selecionar um cartão atualizará imediatamente a prévia ao vivo, sem salvar.
4. O botão **Aplicar modelo** abrirá uma confirmação clara de que o estilo atual será substituído. Após confirmar:
   - preencherá os mapas completos claro e escuro;
   - atualizará cor primária, destaque, fontes, raio, densidade e ícones;
   - manterá todos os dados e arquivos de identidade;
   - marcará o formulário como alterado, ainda exigindo **Salvar alterações**.
5. **Descartar** restaurará integralmente o último estado salvo.
6. Uma alteração manual posterior continuará permitida e fará o estado aparecer como **Personalizado**, sem bloquear ajustes finos.

## Catálogo exato
O catálogo será tipado e estático em código, usando somente as 33 chaves já aceitas pelo motor de White Label. Cada modelo conterá `form`, `theme.light`, `theme.dark` e `theme.icons`; `assets` nunca fará parte de um arquétipo.

### 1. Quiet Premium
- Forma: `radius: 6px`, `density: compact`
- Tipografia: Inter em títulos e textos
- Ícones: `stroke: 1.75`, `size: 16`
- Claro:
  - Marca: `primary #1779E1`, `primary-foreground #FAFCFE`, `accent #E2ECF9`, `accent-foreground #192A3C`, `ai-accent #855DD7`
  - Superfícies: `background #FAFCFE`, `card #FFFFFF`, `surface-3 #F4F7FA`, `surface-sunken #EFF2F6`, `muted #EDF2F8`, `sidebar #F8FAFD`, `product-canvas #E9F1F8`, `product-header #F7FBFE`, `product-toolbar #F2F8FC`, `product-panel #FFFFFF`, `product-panel-muted #F0F6FB`, `product-panel-strong #E0EBF3`, `product-divider #C9D4DD`
  - Texto: `foreground #101C28`, `muted-foreground #606A74`, `text-secondary #4D5660`, `text-tertiary #737B85`, `sidebar-foreground #192A3C`
  - Estrutura: `border #E0E5EB`, `border-subtle #E7ECF0`, `border-strong #BEC5CC`, `input #E0E5EB`
  - Status: `success #208A48`, `warning #C97705`, `destructive #D72C2C`, `dei-accent #087F97`
  - Etapas: `hs-stage-1 #8096AD`, `hs-stage-2 #248BB8`, `hs-stage-3 #079CA4`, `hs-stage-4 #A98212`, `hs-stage-won #258A49`, `hs-stage-lost #CE3732`
- Escuro:
  - Marca: `primary #4699FE`, `primary-foreground #0B121A`, `accent #253447`, `accent-foreground #EFF2F5`, `ai-accent #AE8BFF`
  - Superfícies: `background #0B121A`, `card #121C26`, `surface-3 #1A2531`, `surface-sunken #070E16`, `muted #1D2A37`, `sidebar #121C26`, `product-canvas #050B11`, `product-header #0F1822`, `product-toolbar #0B131C`, `product-panel #121C26`, `product-panel-muted #19242F`, `product-panel-strong #202D3A`, `product-divider #353E47`
  - Texto: `foreground #EFF2F5`, `muted-foreground #A5AFB9`, `text-secondary #C0C7CF`, `text-tertiary #98A2AD`, `sidebar-foreground #EFF2F5`
  - Estrutura: `border #303A44`, `border-subtle #252E37`, `border-strong #4A5560`, `input #36414C`
  - Status: `success #45C56E`, `warning #F7A224`, `destructive #FF665D`, `dei-accent #38C4DB`
  - Etapas: `hs-stage-1 #8FA3B8`, `hs-stage-2 #37B6E8`, `hs-stage-3 #2AC5CD`, `hs-stage-4 #E3BB35`, `hs-stage-won #4AC570`, `hs-stage-lost #FF665D`

### 2. Modern Soft
- Forma: `radius: 12px`, `density: comfortable`
- Tipografia: Outfit em títulos, DM Sans em textos
- Ícones: `stroke: 1.5`, `size: 18`
- Claro:
  - Marca: `primary #5B5BD6`, `primary-foreground #FFFFFF`, `accent #EDEDFE`, `accent-foreground #303052`, `ai-accent #A855F7`
  - Superfícies: `background #FBFBFD`, `card #FFFFFF`, `surface-3 #F7F7FA`, `surface-sunken #F2F2F6`, `muted #F1F2F6`, `sidebar #F8F8FB`, `product-canvas #F1F3F7`, `product-header #FFFFFF`, `product-toolbar #F8F8FB`, `product-panel #FFFFFF`, `product-panel-muted #F6F6F9`, `product-panel-strong #ECECF2`, `product-divider #DDDDE6`
  - Texto: `foreground #202127`, `muted-foreground #666975`, `text-secondary #535661`, `text-tertiary #7A7D88`, `sidebar-foreground #30313A`
  - Estrutura: `border #E5E5EC`, `border-subtle #EEEEF3`, `border-strong #CACAD5`, `input #DDDDE6`
  - Status: `success #238A57`, `warning #B96B08`, `destructive #D63C4A`, `dei-accent #087E9A`
  - Etapas: `hs-stage-1 #8792A2`, `hs-stage-2 #4F87D9`, `hs-stage-3 #338F96`, `hs-stage-4 #A87917`, `hs-stage-won #27875A`, `hs-stage-lost #C8424E`
- Escuro:
  - Marca: `primary #8B8BEA`, `primary-foreground #17171C`, `accent #34344A`, `accent-foreground #F4F4F7`, `ai-accent #C084FC`
  - Superfícies: `background #17171C`, `card #1E1E24`, `surface-3 #26262D`, `surface-sunken #121217`, `muted #292931`, `sidebar #1B1B21`, `product-canvas #111116`, `product-header #1D1D23`, `product-toolbar #18181E`, `product-panel #202027`, `product-panel-muted #282830`, `product-panel-strong #303039`, `product-divider #41414B`
  - Texto: `foreground #F4F4F7`, `muted-foreground #AAAAB4`, `text-secondary #C7C7CF`, `text-tertiary #9696A1`, `sidebar-foreground #ECECF1`
  - Estrutura: `border #34343D`, `border-subtle #2A2A32`, `border-strong #50505B`, `input #41414B`
  - Status: `success #48C78A`, `warning #F1AD4E`, `destructive #F26B78`, `dei-accent #47C3DD`
  - Etapas: `hs-stage-1 #9AA4B2`, `hs-stage-2 #78A9EF`, `hs-stage-3 #65BCC2`, `hs-stage-4 #D7B45A`, `hs-stage-won #54C990`, `hs-stage-lost #F17782`

### 3. Enterprise Classic
- Forma: `radius: 3px`, `density: compact`
- Tipografia: Plus Jakarta Sans em títulos, Inter em textos
- Ícones: `stroke: 2`, `size: 15`
- Claro:
  - Marca: `primary #1557A0`, `primary-foreground #FFFFFF`, `accent #DCE8F5`, `accent-foreground #17324D`, `ai-accent #6B4CB3`
  - Superfícies: `background #F5F7FA`, `card #FFFFFF`, `surface-3 #EDF1F5`, `surface-sunken #E8EDF2`, `muted #E9EEF3`, `sidebar #EEF3F8`, `product-canvas #E3E9EF`, `product-header #F7F9FB`, `product-toolbar #EAF0F5`, `product-panel #FFFFFF`, `product-panel-muted #EDF2F6`, `product-panel-strong #D9E2EA`, `product-divider #B8C4CF`
  - Texto: `foreground #17212B`, `muted-foreground #536170`, `text-secondary #3E4B58`, `text-tertiary #687684`, `sidebar-foreground #203449`
  - Estrutura: `border #C8D1DA`, `border-subtle #D9E0E7`, `border-strong #9DAAB7`, `input #B9C5D0`
  - Status: `success #187744`, `warning #A85E00`, `destructive #C12D35`, `dei-accent #08758A`
  - Etapas: `hs-stage-1 #70859A`, `hs-stage-2 #2472B8`, `hs-stage-3 #187F87`, `hs-stage-4 #946D0A`, `hs-stage-won #1C7848`, `hs-stage-lost #B7373D`
- Escuro:
  - Marca: `primary #5A9BE2`, `primary-foreground #09111A`, `accent #263B52`, `accent-foreground #F1F5F8`, `ai-accent #A98AE3`
  - Superfícies: `background #101820`, `card #17212B`, `surface-3 #202C37`, `surface-sunken #0A1118`, `muted #22303C`, `sidebar #131D27`, `product-canvas #080E14`, `product-header #15202A`, `product-toolbar #111A23`, `product-panel #18232D`, `product-panel-muted #212E39`, `product-panel-strong #2A3945`, `product-divider #46535F`
  - Texto: `foreground #F1F5F8`, `muted-foreground #A9B4BE`, `text-secondary #C7D0D8`, `text-tertiary #94A0AC`, `sidebar-foreground #E8EEF3`
  - Estrutura: `border #3A4651`, `border-subtle #2B3640`, `border-strong #596673`, `input #46535F`
  - Status: `success #45BE78`, `warning #E4A13D`, `destructive #EE6269`, `dei-accent #42B8CB`
  - Etapas: `hs-stage-1 #91A4B7`, `hs-stage-2 #69A8E1`, `hs-stage-3 #52B3BA`, `hs-stage-4 #D3AD4B`, `hs-stage-won #4BC182`, `hs-stage-lost #EE6A70`

Todos os pares de texto e superfície serão verificados pelo cálculo de contraste já existente; valores que não atingirem AA serão ajustados antes da entrega, mantendo a direção visual do arquétipo.

## Detalhes técnicos
- Criar um catálogo central tipado de arquétipos, separado do catálogo de tokens, com validação de completude em relação a `BRAND_TOKEN_KEYS`.
- Criar o seletor visual como componente reutilizável pelo construtor do workspace, usando os componentes oficiais de botão e confirmação.
- Aplicar o modelo somente ao estado local do `BrandingBuilder`; a persistência continuará usando `saveBranding` e o campo `theme` existentes.
- Reconhecer o modelo ativo comparando a assinatura dos campos de estilo. Como o identificador não será persistido, qualquer ajuste manual resultará corretamente em **Personalizado**.
- Sincronizar `primary_color` e `accent_color` legados com os respectivos tokens do modelo para manter compatibilidade com telas que ainda usam esses campos.
- Preservar `theme.assets` ao substituir `theme.light`, `theme.dark` e `theme.icons`.
- Não alterar `ModuleBrandingForm`, banco, migrations, autenticação, RLS, permissões ou regras de negócio.
- Registrar a decisão arquitetural do catálogo estático no guia técnico do projeto.

## Testes e validação
- Testes unitários para garantir que cada arquétipo contém exatamente todas as chaves de cor, valores válidos, limites de ícones e campos de formulário aceitos.
- Testar aplicação de cada modelo e preservação de identidade/assets.
- Testar detecção de Quiet Premium, Modern Soft, Enterprise Classic e Personalizado.
- Validar confirmação, Descartar, Salvar, recarga e herança nos módulos.
- Conferir prévia clara/escura, contraste, foco por teclado, celular e desktop.
- Executar testes afetados, typecheck, lint e build de desenvolvimento.

## Fora de escopo
- Escolha de modelo independente por módulo.
- Persistência de um identificador de arquétipo ou histórico de aplicações.
- Novos tokens, alteração de componentes das telas operacionais ou redesign de `/contracts` nesta etapa.
