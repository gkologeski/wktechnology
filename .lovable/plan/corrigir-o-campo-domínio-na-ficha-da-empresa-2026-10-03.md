# Corrigir o campo Domínio na ficha da empresa

## Resultado esperado
Na ficha da empresa informada, **Domínio** exibirá apenas o endereço do domínio, sem protocolo, caminho nem parâmetros de rastreamento. Ao abrir a edição, o campo mostrará seu valor de domínio original, nunca um telefone formatado. A correção valerá também para outras empresas que usem a mesma ficha, sem alterar seus dados no banco.

## Passos
1. Corrigir a apresentação do valor de **Domínio** na ficha de empresa: extrair com segurança o nome do host de URLs completas; manter valores já simples como estão e tratar entradas inválidas sem quebrar a tela.
2. Corrigir a inicialização da edição no painel de propriedades: aplicar a máscara de telefone exclusivamente a campos telefônicos. Garantir que o valor do domínio não seja transformado nem salvo automaticamente ao abrir a edição.
3. Verificar o comportamento em **Ver como Eduarda**: confirmar o texto exibido e o valor apresentado ao clicar no lápis, sem gravar alterações. Conferir que uma tentativa de salvar em modo somente leitura não altera o registro; se o botão continuar acessível, tratar esse ponto no painel sem mudar as regras de acesso.
4. Revisar o diff e validar o caso no navegador com Playwright, em largura desktop e móvel quando possível, além das verificações automáticas relevantes. Registrar claramente o que foi ou não possível confirmar.

## Detalhes técnicos
A ficha `companies.$id` usa `PropertiesPanel`. O campo `domain` é exibido como texto bruto; a abertura da edição passa `formatBrPhone` para qualquer propriedade sem tratamento especial. Por isso uma URL longa ocupa várias linhas e a entrada do print vira número de telefone. A formatação visual ficará separada do valor persistido; nenhuma migration ou mudança em RLS será necessária.
