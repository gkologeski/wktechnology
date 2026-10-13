# Deixar as caixas de texto do Agente SDR mais altas

## O que será feito

Aumentar a altura inicial das áreas de texto do Agente SDR e garantir a alça de
arrastar na borda inferior, para que caibam vários parágrafos sem precisar
esticar a caixa manualmente.

Somente altura e comportamento de arrastar mudam. Nenhum texto, regra,
permissão, banco ou envio é alterado.

## Alturas novas

**Aba Persona e teste** (`src/components/prospecting/sdr-agent-studio.tsx`)

| Caixa | Hoje | Novo |
| --- | --- | --- |
| Descrição | 2 linhas | 4 linhas |
| Objetivo do atendimento | 3 linhas | 6 linhas |
| Informações a coletar | 3 linhas | 6 linhas |
| Quando chamar uma pessoa | 3 linhas | 6 linhas |
| Instruções adicionais | 3 linhas | 6 linhas |
| Exemplos do jeito certo | 4 linhas | 8 linhas |
| Caixa de escrita da conversa de teste | 2 linhas | 4 linhas |

As quatro do meio ("Objetivo", "Informações a coletar", "Quando chamar uma
pessoa", "Instruções adicionais") usam o mesmo bloco de código, então uma única
alteração cobre as quatro.

**Aba Configuração** (`src/components/prospecting/sdr-agent-config.tsx`)

| Caixa | Hoje | Novo |
| --- | --- | --- |
| Orientações do roteiro | 4 linhas | 8 linhas |
| Regras adicionais | 3 linhas | 6 linhas |

## Alça para arrastar

- Todas as caixas acima ganham arrasto vertical explícito (`resize-y`), com
  limite máximo de 16 linhas para nenhuma caixa sair do controle da tela.
- A caixa de escrita da conversa de teste hoje tem o arrasto desligado; ela
  passa a permitir arrasto vertical, com teto de 16 linhas, para não esmagar o
  histórico da conversa.
- O campo "Expressões a evitar" continua em linha única (é uma lista separada
  por vírgula, não um texto).

## Como fica no navegador

- Painel de teste: continua grudado na lateral com altura própria; se a caixa de
  escrita for esticada, o histórico encolhe proporcionalmente e mantém a
  rolagem funcionando.
- Sem quebra de layout no celular e no tablet: as alturas novas são as mesmas
  em qualquer largura de tela.

## Verificações

1. Sem erros de tipo.
2. Sem erros de estilo nos dois arquivos alterados.
3. Versão de produção gerada sem erros.
4. Navegador: abrir o Agente SDR, ir em "Persona e teste" e conferir com captura
   de tela que as caixas estão visivelmente mais altas e que a alça de arrastar
   aparece no canto inferior direito; depois conferir a aba Configuração.
5. Nenhuma alteração é salva durante o teste; nada é publicado e nenhuma
   mensagem é enviada.

## Fora do escopo

Nada de banco, permissões, playbook da Lia, envio de mensagens ou publicação.
