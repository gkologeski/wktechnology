# Modelo visual "Venda - Proposta — Consultoria"

Porte P/M — estimativa ~1h30 (construção ~50 min + testes/Playwright ~40 min).

## O que será entregue
- Um novo modelo visual **"Venda - Proposta — Consultoria (visual)"** no workspace WK Technology, criado a partir do texto do modelo atual.
- O modelo original em texto continua intacto (inclusive como padrão); nada é apagado ou convertido no lugar.
- A mesma base fica disponível como opção inicial **"Consultoria"** ao criar um novo modelo visual, para reutilizar em outros workspaces.

## Estrutura das páginas (estilo editorial já aprovado, A4 retrato)
```text
01 Capa          logo da prestadora, "Proposta Comercial", {{deal.name}}, {{company.name}}, A/C {{contact.name}}, data/validade
02 Diagnóstico   01 Apresentação + 02 Diagnóstico inicial (2 parágrafos, chamada azul)
03 Metodologia   03 Metodologia — 4 cartões numerados (Alinhamento, Levantamento, Validação, Recomendações) + nota sobre pacote de horas
04 Entregáveis   04 Entregáveis — 4 blocos (Relatório, Recomendações, Plano de ação, Apresentação) + nota de implementação
05 Cronograma    05 Cronograma + 06 Especialistas alocados (bloco claro) + relatórios de consumo de horas
06 Investimento  tabela dinâmica de serviços, bloco escuro de total, condições de pagamento (bloco de termos), validade
```
Cabeçalho/rodapé via página mestre com numeração automática; cores e fontes do kit de marca; todos os textos com as mesmas variáveis do modelo original ({{counterparty.name}}, {{signer.full_name}} etc.).

## Detalhes técnicos
- Nova fábrica `src/lib/proposals/consultoria-starter-template.ts` reutilizando helpers de `visual-design.ts` (mesmo esquema Zod versionado do starter Nexxus).
- Registrar a opção no seletor de modelo inicial do editor.
- Criação do registro: pelo próprio editor, autenticado como você (RLS/permissões normais), copiando descrição e vínculo de serviços/contrato do original; sem migration de conteúdo, sem acesso privilegiado.
- Testes: validação do design pelo esquema, presença das variáveis e do bloco de termos; Playwright abrindo as 6 páginas, preview e salvamento.
- Gates: `permissions:check` (contrato/hash do arquivo novo), `help:coverage` (nota no artigo de modelos), lint, build.
- Não publicar.

## Fora do escopo
- Trocar o modelo padrão para o visual (pode ser feito depois em um clique).
- Teste do PDF real/link público (pendência já registrada).
