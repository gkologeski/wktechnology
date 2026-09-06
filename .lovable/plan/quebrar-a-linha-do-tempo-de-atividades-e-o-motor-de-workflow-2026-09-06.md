# Quebrar a linha do tempo de atividades e o motor de workflows

Dois arquivos passam de 1.700 linhas e são os maiores do sistema. A meta é
dividi-los em partes menores **sem mudar nada do que o usuário vê ou do que o
sistema faz**.

## Etapa 1 — Linha do tempo de atividades (1.838 linhas)

Hoje o mesmo arquivo busca dados, grava dados, monta o compositor de mensagem,
abre os diálogos de ação e desenha cada item. Separação proposta:

- **Dados**: um módulo novo com toda a busca (atividades, e-mails, eventos de
  agenda, histórico de alterações, respostas de pesquisa) e outro com as ações
  de gravar, editar, excluir, concluir e anexar arquivos.
- **Apresentação**: compositor de nova atividade, diálogos de ação, e o cartão
  de cada item da linha do tempo (incluindo reunião, chamada, anexos e edição)
  passam a ser componentes próprios, reaproveitando o que já existe em
  `src/components/activity/`.
- O arquivo `activity-timeline.tsx` fica como orquestrador fino, mantendo o
  mesmo nome e as mesmas propriedades usadas pelas telas de Lead, Contato,
  Empresa, Negócio, Chamado, Fila e pelo painel lateral de negócio.

## Etapa 2 — Motor de workflows (1.782 linhas)

Divisão por responsabilidade, mantendo intactas as funções públicas
`runActions`, `processEvent`, `tickWorkflows` e `tickTimeTriggers` (usadas pelas
rotas de cron e pelos testes):

- avaliação de condições e filtros;
- resolução de campos extras e mesclagem de dados;
- execução de cada tipo de ação (o bloco maior, quebrado por grupo: campos,
  mensagens, criação de registros, fluxo/ramificação, aprovação);
- ciclo de execução: inscrição, finalização de execução e os dois ticks.

O arquivo original continua sendo o ponto de entrada, apenas mais fino.

## Regras de segurança

- Nenhuma mudança de comportamento, de tela, de banco, de permissão ou de RLS.
- Nomes exportados e assinaturas preservados; nada de renomear rotas ou props.
- Uma etapa por vez: só avanço para o motor de workflows depois que a linha do
  tempo estiver verificada.

## Validação

Após cada etapa: `bun run typecheck`, `bun run lint` e `bun run test` (298
testes, incluindo os testes do motor de workflows). Verificação manual sugerida:
abrir um lead e um negócio, criar/editar/excluir uma atividade, anexar arquivo,
alternar o filtro de período e conferir o histórico.

## Detalhes técnicos

- Novos módulos em `src/lib/timeline/` (busca e mutações) e
  `src/components/activity/` (compositor, diálogos, item da linha do tempo).
- Novos módulos do motor em `src/lib/workflows/engine/*.server.ts`, com
  `engine.server.ts` reexportando as quatro funções públicas.
- Regras de lint já instaladas (`quality/max-lines` em 350) usadas como medida
  de progresso; os dois arquivos saem da lista dos maiores.
