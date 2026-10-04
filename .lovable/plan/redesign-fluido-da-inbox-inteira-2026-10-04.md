# Redesign fluido da Inbox inteira

## Objetivo
Aplicar a direção aprovada **Floating soft panels v3** à Inbox Unificada, Email, WhatsApp e Chat ao vivo, removendo o aspecto de grade rígida e caixas quadradas sem alterar dados, permissões, integrações ou comportamento dos canais.

## Direção visual aprovada
- Adotar composição de quatro áreas com respiro entre elas: canais, lista, conversa e contexto.
- Usar superfícies suaves e contínuas, cantos orgânicos, sombras discretas e poucas bordas.
- Manter **Sora** nos títulos e **Manrope** nos textos, respeitando o White Label ativo.
- Tratar `#F7F9FC`, `#FFFFFF`, `#DCE3EC` e `#2563A6` como referência de papéis visuais; a implementação continuará usando tokens semânticos do workspace, sem cores fixas nos componentes.
- Preservar quiet premium: sem glassmorphism exagerado, gradientes decorativos, cartões aninhados ou sombras fortes.

## Implementação

### 1. Casco compartilhado
- Transformar o casco atual em uma área fluida com espaçamento entre painéis no desktop.
- Dar maior destaque e largura à conversa ativa.
- Tornar canais e contexto painéis leves; manter o contexto recolhível.
- Preservar rolagem independente e a navegação progressiva no mobile.

### 2. Canais e ações
- Refinar a navegação de Unificada, Email, WhatsApp e Chat ao vivo com seleção suave e hierarquia mais clara.
- Integrar Configurar, Sincronizar, Novo email e Nova conversa ao rodapé do painel de canais sem aparência de caixas empilhadas.
- Manter todas as ações e estados desabilitados existentes.

### 3. Lista de conversas
- Substituir contornos individuais por linhas fluidas com respiro, estado selecionado elevado e realce semântico discreto.
- Refinar filtros, contagem, avatar, horário, prévia, responsável, status e não lidas.
- Manter busca, filtros e atualização em tempo real de cada canal.

### 4. Conversa e composição
- Criar cabeçalho mais leve, com identidade do contato e ações alinhadas sem moldura rígida.
- Aplicar balões mais orgânicos, com contraste adequado e estados de envio/leitura preservados.
- Integrar anexo, campo de mensagem, envio e rascunho em um compositor contínuo no rodapé.
- Preservar resposta, IA, mídia, snippets, anexos, métricas, fechamento, reabertura e conversão em ticket conforme cada canal.

### 5. Contexto
- Exibir identidade, responsável, status e informações já existentes em uma lateral leve, sem criar novos campos ou atalhos fictícios.
- Manter recolhimento no desktop e acesso sob demanda em telas menores.

### 6. Responsividade e acessibilidade
- No desktop, manter os quatro painéis sem comprimir o histórico ou os controles.
- Em tablet e mobile, mostrar lista e conversa em etapas, com retorno claro e sem rolagem horizontal.
- Preservar foco visível, nomes acessíveis, navegação por teclado, contraste, estados loading/empty/error e redução de movimento.

## Arquivos previstos
- `src/components/inbox/inbox-workspace.tsx`: estrutura e componentes visuais compartilhados.
- `src/routes/_authenticated/inbox.index.tsx`: composição da Inbox Unificada.
- `src/routes/_authenticated/inbox.email.tsx`: composição do Email.
- `src/routes/_authenticated/inbox.whatsapp.tsx`: composição do WhatsApp.
- `src/routes/_authenticated/inbox.chat.tsx`: composição do Chat ao vivo.
- `src/styles.css` e `src/routes/__root.tsx`: somente se necessário para mapear tipografia/tokens sem quebrar o White Label.

## Validação
- Revisar o diff para garantir ausência de mudanças em banco, RLS, RBAC, integrações e regras de envio.
- Executar lint e as validações automáticas disponíveis.
- Validar as quatro rotas com Playwright em desktop e mobile, incluindo seleção, troca de canal, filtros, contexto, compositores, estados vazios/erro e ausência de sobreposição ou rolagem horizontal.
- Conferir visualmente os modos claro e escuro e confirmar que a identidade continua vindo do White Label.

## Fora do escopo
- Novos canais, campos, ações, ferramentas, integrações ou regras de negócio.
- Alterações em banco, permissões, automações, envio ou sincronização.
- Uso da imagem enviada como ativo do produto; ela permanece apenas como referência visual do problema atual.
