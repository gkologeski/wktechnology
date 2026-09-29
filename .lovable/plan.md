# Corrigir filtros de funil no Dashboard e adotar mockups prévios

## Resultado esperado

- Em `/dashboard`, cada seletor exibirá somente os funis realmente cadastrados.
- O funil principal aparecerá pelo nome real, com o sufixo **“(Padrão)”** — por exemplo, `Novos Negócios (Padrão)` e `Funil de Leads (Padrão)`.
- Com apenas um funil disponível, o nome continuará visível e o seletor ficará desabilitado, deixando claro que não existe uma segunda opção.
- Com vários funis, todos serão selecionáveis e somente o registro marcado como padrão receberá a identificação visual.
- Novas telas e redesenhos passarão por mockup renderizado e aprovação antes da alteração definitiva.

## Causa confirmada

Os dois registros aparentes não vêm do banco. O componente atual adiciona artificialmente `Pipeline padrão` e `Funil padrão` e depois lista os registros reais. No servidor, a ausência de um identificador já resolve corretamente para o registro `is_default`, portanto os itens genéricos são apenas uma duplicação visual.

## Implementação

1. Remover as opções artificiais `Pipeline padrão` e `Funil padrão` dos dois seletores.
2. Resolver o valor visual inicial pelo funil marcado como padrão — ou pelo primeiro disponível, seguindo a mesma prioridade já usada pelo servidor.
3. Ao selecionar o funil padrão, manter a URL canônica sem identificador explícito; ao escolher outro, preservar o identificador compartilhável na URL.
4. Exibir `(Padrão)` somente no registro real correspondente e tratar com segurança listas vazias, carregamento e opção única.
5. Extrair/testar a pequena regra de seleção e rotulagem para cobrir zero, um e vários funis, inclusive troca entre padrão e não padrão.

## Regra de mockups prévios

Registrar como regra permanente do projeto:

- Toda **nova tela** ou **redesenho relevante** começa com mockup/protótipo renderizado para revisão.
- Quando a direção visual estiver aberta, apresentar 2–3 alternativas comparáveis; quando o padrão já estiver definido, apresentar ao menos uma proposta fiel ao design system.
- A implementação definitiva só começa após aprovação explícita do mockup.
- Correções pontuais de texto, dados, acessibilidade ou comportamento não exigem mockup, salvo quando envolverem uma decisão visual relevante.
- Registrar a regra no guia operacional de planos e nas decisões permanentes do projeto, sem alterar regras de negócio.

## Escopo preservado

- Sem alteração de banco, pipelines cadastrados, permissões, filtros aplicados aos dados ou regras de escolha do padrão.
- Sem redesign do restante do Dashboard de Vendas.
- Nenhum mockup adicional é necessário para esta correção pontual já definida.

## Validação

- Testes unitários da resolução e dos rótulos dos seletores.
- Verificar em `/dashboard` que `Novos Negócios (Padrão)` e `Funil de Leads (Padrão)` aparecem uma única vez.
- Confirmar os estados com um e vários funis, a troca de seleção, a URL e o recarregamento.
- Conferir teclado, foco, tema claro/escuro e larguras desktop/celular.
- Executar formatação, lint dos arquivos alterados, typecheck, testes e build; registrar qualquer erro preexistente separadamente.
