# Redesign UX/UI do construtor de Workflows — proposta para aprovação

## Diagnóstico da experiência atual

A lista de Workflows fica em Configurações → Automação; o editor abre sobre ela em uma janela de tela inteira. No desktop, ele divide a largura entre uma coluna de contexto de 224 px, canvas central e painel de configuração à direita. Um passo selecionado abre seu formulário nesse painel. O canvas mostra gatilho, ações e ramificações; ramificações por valor ocupam colunas horizontais de largura fixa e podem exigir rolagem lateral. A captura da tela atual confirma a divisão e a baixa área útil do canvas.

Na ação existente **Criar contrato a partir do negócio**, o formulário mistura tipo/papel, título, vigência, modelo, duas opções operacionais e um editor de campos adicionais. Esse editor **já** distingue preenchidos/outros/campos do sistema, aceita grupos personalizáveis, acusa algumas pendências, busca campos e permite preenchimento automático. A proposta preserva tudo isso: o problema não é ausência total de agrupamento, mas a distribuição dessas funções dentro de uma coluna estreita e longa. Inputs de variáveis exibem listas de opções sempre abaixo dos campos; o editor mistura rótulos compreensíveis com tokens técnicos. A lista distingue rascunho, versão publicada e erros recentes de execução; o editor confirma antes de sair com alterações não salvas.

**Problemas prioritários:** competição entre três painéis, dificuldade de comparar quatro ou mais ramos, leitura lenta de ações extensas, inventário de variáveis repetido, lixeiras próximas de campos e pouco resumo de configuração no próprio canvas. Indicadores de campos obrigatórios já existem dentro do editor, mas não oferecem uma visão consolidada no cartão da ação. Erros de **execução** não devem ser confundidos com pendências de **configuração**.

## Três alternativas de composição

**A — Canvas + drawer amplo (40–50% da área).** Selecionar um passo abre painel sobre parte do canvas; o contexto do fluxo permanece visível, com fechamento que retorna ao mesmo ramo.

```text
┌ Workflow / Consultoria / Criar contrato ────────── Salvar | Publicar ┐
│  CANVAS (50–60%)                │ CONFIGURAÇÃO (40–50%)       │
│  Gatilho → Serviço              │ Resumo · 17 campos          │
│  CT   FS   HU   Outros          │ Principais | Adicionar campo│
│  [Criar contrato] selecionado  │ Variáveis | Avançadas       │
└─────────────────────────────────┴─────────────────────────────┘
```

**Vantagens:** edição rápida em contexto; menor mudança conceitual em relação ao editor atual. **Desvantagens:** quatro colunas de ramo continuam apertadas; em telas médias/mobile o drawer cobriria o canvas; formulário grande ainda depende de rolagem interna.

**B — Canvas + modal central grande para a ação.** O canvas ocupa toda a área; abrir um passo exibe uma janela larga com resumo, categorias e campos configurados.

```text
┌──────────── Canvas com quatro ramos e cartões compactos ─────────────┐
│                         ┌ Criar contrato ───────────────┐           │
│                         │ Resumo + estado de validação  │           │
│                         │ Principais | Mais campos      │           │
│                         │ Selecionar variável | Fechar  │           │
│                         └───────────────────────────────┘           │
└───────────────────────────────────────────────────────────────────────┘
```

**Vantagens:** foco total na configuração; permite largura maior sem concorrência do canvas. **Desvantagens:** oculta o ramo enquanto se edita; alternar repetidamente entre ações vira abre/fecha; modal sobre a janela atual exigiria cuidado redobrado com foco e camadas.

**C — Canvas amplo + editor dedicado à etapa (recomendado).** Um único espaço de edição alterna entre mapa e detalhe, mantendo breadcrumb, estado do rascunho e retorno ao ramo. Não significa criar outra estrutura de automação.

```text
┌ Workflow: Criar contrato ─ Rascunho pendente ─ Salvar | Publicar ┐
│ Canvas > Serviço = Consultoria > Criar contrato                  │
├──────────────────────────────────────────────────────────────────┤
│ RESUMO DA AÇÃO: Empresa · Serviço · Moeda · Renovação            │
│ 17 configurados  |  2 pendências  |  3 dinâmicos                 │
│                                                                  │
│ Informações principais        | Condições comerciais            │
│ Vigência                    | Relacionamentos                  │
│ Assinatura                  | Configurações avançadas          │
│ [Adicionar campo] [Voltar ao canvas]                             │
└──────────────────────────────────────────────────────────────────┘
```

**Vantagens:** mais espaço para canvas e para formulários com 30+ campos; hierarquia explícita; melhor adaptação a celular; endereço direto para a etapa é possibilidade futura, não requisito inicial. **Desvantagens:** mudança maior de navegação visual; exige preservar seleção, posição do canvas e alterações não salvas ao voltar; mais passos para pequenas edições. **Recomendação:** C para ações complexas, com edição rápida de nome/status e menu contextual no canvas. Manter, numa primeira execução, o editor como estado interno da janela atual para minimizar impacto de navegação; avaliar URL direta só depois de garantir proteção de rascunho.

## Fluxo proposto, sem mudar o funcionamento

1. **Criar workflow:** escolher objeto, nome e evento; exibir gatilho no canvas e estado “Rascunho”.
2. **Configurar gatilho:** seleção contextual, filtros e reinscrição existentes; cartão mostra frase legível.
3. **Criar condição:** “Adicionar passo” abre menu contextual pesquisável; escolher condição sem modificar sua lógica.
4. **Criar ramificação:** escolher campo e valores; cards de ramo mostram rótulo, condição, quantidade de ações e estado; manter caminho padrão e todos os casos existentes.
5. **Adicionar ação:** no ramo escolhido, “Adicionar passo” → ações disponíveis → “Criar contrato a partir do negócio” (ou “Criar registro” quando essa ação corresponder de fato ao tipo disponível); preservar biblioteca e modelos de ação.
6. **Criar registro/configurar campos:** editor dedicado exibe resumo, campos já preenchidos e “Adicionar campo”; busca e categorias sem retirar nenhum campo existente.
7. **Selecionar variáveis:** seletor pesquisável por origem/contexto e tipo compatível; mostrar rótulo humano após selecionar e preservar exatamente o token armazenado.
8. **Validar:** resumir somente verificações que o formulário já realiza; apontar campo e seção com foco direto. Separar claramente “pendência do rascunho” de “falha de execução”. Novas exigências bloqueantes ou validação semântica dependem de aprovação específica, pois poderiam mudar o comportamento de publicação.
9. **Publicar:** manter distinção atual entre salvar rascunho e salvar/publicar, versão publicada em execução, confirmação ao sair e teste/aprovação existentes.

## Detalhe proposto: “Criar contrato a partir do negócio”

No topo: “Criar contrato” e resumo de valores **reais da ação selecionada**, por exemplo: Tipo: prestação; Empresa: empresa do negócio; Serviço: Consultoria; Moeda: BRL; Reajuste: IPCA / anual; Renovação: sim; Status inicial: rascunho. Se algo não estiver preenchido, mostrar “Não definido”, nunca inventar um valor. Contador de campos configurados, dinâmicos e pendências calculado da configuração atual.

**Campos configurados** aparecem primeiro, agrupados em Informações principais, Condições comerciais, Vigência, Relacionamentos e Assinatura. Campos ainda não configurados ficam fora da página até abrir **Adicionar campo → Pesquisar → Mais usados / Todas as categorias**. “Configurações avançadas” abriga campos internos e metadados, mas não os remove. Grupos personalizados, busca, autofill e tipos de input atuais continuam acessíveis. Campos que o sistema preenche automaticamente serão identificados como tal, sem fingir que são valores escolhidos pelo usuário. Ações como “Copiar itens do negócio”, “Não criar de novo” e seleção de modelo permanecem visíveis na categoria adequada. Cada campo possui menu ⋯ para limpar/remover, com confirmação quando houver perda de configuração; nada é excluído apenas por navegar.

## Seletor de variáveis

```text
Valor: [ Empresa do negócio → Nome                 ▾ ]
       ┌ Buscar variável...                           ┐
       │ Dados do negócio   Nome · Valor · Serviço    │
       │ Empresa            Nome · CNPJ · Cidade      │
       │ Contato principal  Nome · E-mail · Telefone  │
       │ Passos anteriores  Campos disponíveis        │
       │ Sistema            Data atual · ID disponível│
       └───────────────────────────────────────────────┘
       Valor armazenado: {{...}}  (somente modo avançado/tooltip)
```

Buscar por rótulo e nome técnico, filtrar por tipo de valor (texto, número, data, referência) e por disponibilidade **real** no gatilho/passos anteriores. Para relacionamentos, apresentar “Empresa do negócio”, “Negócio que iniciou o workflow” ou “Contrato do passo anterior” apenas quando o token contextual correspondente existir. Não traduzir `{{id}}` como “negócio” se o gatilho for outra entidade; tokens desconhecidos/legados continuam editáveis em modo avançado e não são reescritos silenciosamente. Strings que combinam texto e tokens conservam edição mista.

## Canvas para quatro ramos

```text
                     [Quando o negócio mudar de etapa]
                                   ↓
                        [Verificar serviço · 4 casos]
           ┌───────────────────┬──────────────┬──────────────┬───────────────┐
           │ CONSULTORIA       │ FÁBRICA      │ HUNTING      │ OUTSOURCING   │
           │ Serviço = CT      │ Serviço = FS │ Serviço = HU │ Serviço = ... │
           │ 1 ação · válido   │ 1 ação       │ 1 ação       │ 1 ação        │
           │ Criar contrato ⋯  │ Criar ... ⋯  │ Criar ... ⋯  │ Criar ... ⋯   │
           │ + Adicionar passo │ + Adicionar  │ + Adicionar  │ + Adicionar   │
           └───────────────────┴──────────────┴──────────────┴───────────────┘
```

No desktop, canvas ocupa toda a largura e permite rolagem horizontal **apenas dos ramos**, com cabeçalhos dos casos legíveis e largura estável; em telas estreitas, ramos em lista navegável com seu caminho sempre visível. Valores codificados são traduzidos por opções/referências do catálogo quando houver correspondência; UUID desconhecido deve exibir um estado “referência não localizada”, com valor técnico no detalhe avançado, nunca um nome fictício. Cartão usa ícone, verbo, resumo, status de configuração e menu ⋯; o botão do conector indica o tipo de adição ou abre um menu “Adicionar passo” com ação/condição/espera conforme opções existentes. Preservar arrastar, reordenar e ramificações aninhadas.

## Erros, modos e salvaguardas

- Pendência de configuração: aviso no cartão → clique abre diretamente o campo e grupo com problema; contador no breadcrumb. Ausência de informação verificável não vira “erro” inventado.
- Erro de execução: sinal separado, vinculado a execuções recentes, com data/status real. Não misturar com a validade do rascunho.
- Modo simples: rótulos de negócio, resumo, campos configurados, busca e categorias. Modo avançado: tokens brutos, campos internos, personalização de grupos, metadados e mapeamentos. É uma **preferência de apresentação**, não permissão ou novo comportamento do motor; recursos não desaparecem.
- Salvar/voltar mantém a árvore e o rascunho em memória; sair com alterações não salvas mantém a confirmação atual. “Remover campo” e “Remover passo” ficam em menus de contexto com confirmação proporcional à perda.
- Teclado, foco, leitores de tela, carregamento/erro do catálogo, tema claro/escuro e larguras desktop/tablet/celular fazem parte da validação visual futura.

## Limites técnicos e próximo passo

Se aprovada a opção C, a implementação ficará restrita à apresentação e navegação do construtor, reutilizando catálogo de campos, tokens, referências, modelos, estado do rascunho, operações da árvore e ações atuais. Não alterar banco, RLS, permissões, motor, payload persistido, gatilhos, ramificações, automações, execução ou regras de publicação. Priorizar checagem visual de workflows existentes e complexos, incluindo quatro casos e mais de 30 campos configurados; verificar que abrir/salvar/publicar continua produzindo a mesma configuração e que não há perda ao voltar. Esta etapa é **somente análise**: nenhum código do produto será alterado antes da aprovação.
