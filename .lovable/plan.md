# Redesenho de “Persona e teste” do Agente SDR

## Objetivo
Refazer exclusivamente a aba **Persona e teste** em `/agents/sdr`, alinhando-a ao padrão visual atual do TechERP/TechSales e ao White Label, sem alterar comportamento, permissões, dados, versões ou execução do agente.

## Diagnóstico confirmado
- A tela atual concentra todo o conteúdo em duas colunas sem superfícies de produto; o chat ocupa uma área desproporcional e os campos ficam estreitos.
- Tom, origem e ajustes de personalidade usam controles nativos diferentes dos componentes oficiais do sistema.
- A lógica existente já separa rascunho e versão publicada, testa em ambiente seguro e possui estados de salvar, publicar, restaurar, carregar e erro; tudo isso será preservado.

## Implementação visual
1. **Composição da aba**
   - Criar uma faixa de contexto compacta com título, descrição, status do rascunho e versão em produção.
   - Organizar o conteúdo em área principal de configuração e painel de teste, usando `ProductPanel`, tokens `product-*` e divisórias semânticas.
   - Em telas largas, manter o teste visível ao lado sem comprimir os campos; em tablet/celular, empilhar configuração, versões e teste sem rolagem horizontal.

2. **Persona e atendimento**
   - Reorganizar identidade, tom e instruções em seções claras, com hierarquia e espaçamento do Design System.
   - Substituir `select`, `range` e `checkbox` nativos pelos componentes oficiais `Select`, `Slider` e `Switch`, mantendo os mesmos valores e eventos.
   - Exibir os níveis de formalidade, calor e concisão com rótulos legíveis e valor atual, sem alterar o contrato da persona.
   - Manter todos os campos atuais: nome, descrição, objetivo, coleta, transferência humana, instruções, bons exemplos, expressões a evitar e emojis.

3. **Ações e versões**
   - Criar uma barra de ações clara para **Salvar rascunho** e **Publicar rascunho**, com loading e disabled preservados.
   - Redesenhar a lista de versões com status semântico, versão publicada visível e ação de restaurar acessível.
   - Manter publicação como ação explícita; salvar e testar continuarão sem alterar produção.

4. **Teste do agente**
   - Transformar o teste em um painel de conversa consistente com o restante do sistema: cabeçalho, seleção de origem, limpar conversa, mensagens, estado vazio, resposta em andamento, trace recolhível e compositor fixo no painel.
   - Preservar o mesmo executor, o rascunho atual, Enter/Shift+Enter, ausência de efeitos reais e a informação sobre anexos não suportados.
   - Garantir altura estável, rolagem interna da conversa e foco/nomes acessíveis.

5. **Estados e metadados da rota**
   - Substituir o carregamento textual por skeleton compatível com a composição final e manter erro com nova tentativa.
   - Incluir metadados próprios da rota caso continuem ausentes, sem alterar navegação ou autenticação.

## Arquivos previstos
- `src/components/prospecting/sdr-agent-studio.tsx` — redesenho completo da aba, sem mudar regras de negócio.
- `src/components/prospecting/sdr-console.tsx` — somente o estado de carregamento/erro da aba, se necessário para o novo desenho.
- `src/routes/_authenticated/agents.sdr.tsx` — apenas metadados da rota, se ausentes.

## Validação
- Testar com Playwright em desktop e celular, nos temas claro e escuro.
- Conferir visualmente ausência de cortes, sobreposições e rolagem horizontal.
- Exercitar edição dos campos, salvar rascunho, troca de origem, conversa de teste local, limpar e estados disabled/loading; não publicar versão durante o teste.
- Rodar testes pertinentes, typecheck, lint dos arquivos alterados e consultar o resultado do build automático.
- Não publicar a aplicação, não ativar agente/canal/campanha e não enviar mensagens reais.
