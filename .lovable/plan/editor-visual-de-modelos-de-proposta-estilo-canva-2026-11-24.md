# Editor visual de modelos de proposta (estilo Canva)

**Porte: G** — cerca de 5 a 7 dias de trabalho, entregue em 4 pacotes testáveis. Cada pacote tem sua própria estimativa e só começa depois que o anterior for conferido.

## Objetivo
Trocar o editor de texto atual em **Configurações › Modelos de proposta** por um editor de páginas visuais. Nele você posiciona livremente textos, imagens, formas, blocos de preço e tabelas, como no Canva. O exemplo da Nexxus (capa, seções numeradas, cartões escuros e claros de investimento, cabeçalho e rodapé fixos com número da página) deve ficar reproduzível sem código.

Os modelos de texto atuais continuam funcionando. Cada modelo terá um tipo, **Texto** ou **Visual**, e nada é convertido à força.

## O que você poderá fazer
- **Páginas A4** (retrato ou paisagem): adicionar, duplicar, reordenar e excluir.
- **Elementos livres**: texto, título, imagem ou logo, retângulo, círculo, linha, ícone, tabela, bloco de preço e divisor. Cada um pode ser arrastado, redimensionado, girado, alinhado com guias magnéticas, travado, agrupado, empilhado em camadas, copiado, colado e duplicado.
- **Estilo**: fonte, tamanho, peso, cor, fundo, borda, cantos arredondados, sombra suave, transparência e espaçamento.
- **Página mestre**: cabeçalho e rodapé repetidos (logo, "WK TECHNOLOGY / PROPOSTA COMERCIAL", linha de destaque, "CONFIDENCIAL" e número da página automático).
- **Kit da marca**: cores e fontes da empresa prestadora selecionada, mais logos enviados.
- **Campos dinâmicos**: cliente, contatos, data, valores, parcelas, serviços e empresa prestadora, preenchidos na proposta. Inclui blocos que se repetem para cada serviço ou opção de investimento.
- **Desfazer/refazer**, zoom, régua, miniaturas das páginas e prévia com dados reais de uma proposta.
- **Modelos iniciais**: um modelo pronto baseado no layout da Nexxus, com textos genéricos.

## Fora do escopo desta entrega
- Biblioteca de fotos ou ícones de terceiros, animações, vídeo e edição colaborativa em tempo real.
- Importar um PDF existente e convertê-lo automaticamente em modelo editável. O PDF anexado serve só de referência visual.

## Onde aparece o resultado
Uma mesma fonte gera a ficha da proposta, o link público enviado ao cliente e o PDF. As três versões ficam idênticas. A proposta aceita fica congelada como hoje.

## Pacotes
1. **Mockup e estrutura (cerca de 1 dia)**: protótipo navegável do editor para sua aprovação, conforme a regra de redesign. Inclui o formato salvo do modelo visual e as permissões.
2. **Editor básico (cerca de 2 dias)**: páginas, elementos, mover, redimensionar e girar, camadas, estilos, desfazer, salvar, duplicar e excluir.
3. **Dados e página mestre (cerca de 1,5 dia)**: campos dinâmicos, blocos repetidos, cabeçalho e rodapé, numeração, kit da marca e prévia com proposta real.
4. **Saída final (cerca de 1,5 dia)**: ficha, link público e PDF fiéis ao desenho, modelo inicial estilo Nexxus, artigo da Ajuda e testes.

## Detalhes técnicos
- Coluna nova `proposal_templates.layout_kind` ('rich_text' | 'visual', padrão 'rich_text') e `design_json` (documento versionado: páginas, mestre, elementos com x/y/w/h/rotação/z/estilo e `binding`). A migration é nova, sem alterar migrations antigas. As políticas e permissões atuais de `techsales.proposal_templates` são reaproveitadas.
- Imagens ficam em um bucket privado com URL assinada, isoladas por workspace. O logo da empresa prestadora vem do cadastro.
- Editor em React com posicionamento absoluto em unidades de página (mm), usando uma biblioteca leve de manipulação (seleção, redimensionamento e rotação) carregada só nessa tela. Textos usam o TipTap já instalado.
- O renderizador é puro e compartilhado: `design_json` mais o contexto da proposta geram HTML com CSS de página, usado na ficha, em `/proposal/$token` e na geração do PDF. A resolução dos campos dinâmicos fica em `loadProposalDocument`, que continua sendo a fonte única.
- Validação zod do `design_json` no servidor, com limite de tamanho e lista fechada de tipos de elemento. Nada de HTML livre: os textos são sanitizados.
- Testes: validação do schema, resolução dos campos e blocos repetidos, renderizador (página, ordem das camadas, numeração), permissões (permitido, sem chave, deny, outro workspace, inativo) e Playwright do fluxo de criar, editar, duplicar e excluir com prévia.
- Contrato em `permission-contracts.json`, artigo da Ajuda (versão nova) e `verify` + `build` + `perf:check`.
