# JORNADA-ASSINA — Quadro "Contratação" coerente com contrato em assinatura

Porte P · estimativa 1h30–2h (inclui testes, Ajuda e validação na prévia).

## Por que aparece assim hoje (conferido)
- "Etapa 4 de 5 · Contrato / Financeiro" está correto: o contrato C-202611-5749 existe e está "Aguardando assinatura".
- "Cláusulas aprovadas" fica vazio porque o quadro só olha a **minuta enviada ao cliente** (ACEITE-MINUTA). Este aditivo foi gerado direto da proposta, sem minuta — então o item nunca marca, mesmo com Jurídico e Financeiro já aprovados no próprio contrato.
- "Assinatura verificável da versão atual" fica vazio porque a Operação 803 do ForSign está parcial (2 de 4). Isso é correto, mas o quadro não diz que a assinatura já está em andamento.

## O que muda
1. "Cláusulas aprovadas" marca quando a minuta foi aceita **ou**, sem minuta, quando a aprovação jurídica do próprio contrato foi concluída. Texto auxiliar indica a origem ("aprovado pelo Jurídico no contrato").
2. O item de assinatura passa a ter três estados, com os mesmos ícones do quadro ForSign:
   - relógio âmbar "Em assinatura — 2 de 4 assinaram" (envelope ForSign ou documento nativo ativo da versão atual);
   - visto verde quando todas as assinaturas da versão atual estiverem concluídas;
   - círculo vazio quando ainda não foi enviado.
3. Título da etapa mostra "Financeiro · assinaturas em andamento" quando houver envio ativo.
4. Nada muda em regras de acesso, aprovações, cobrança ou no avanço para "Operações" (continua exigindo assinatura completa e verificável).

## Detalhes técnicos
- `src/lib/deals/contracting-journey.ts`: `clausesApproved` considera também a aprovação jurídica do contrato quando não há minuta (ler estado de aprovação já carregado/consultado com o cliente do usuário, RLS).
- `src/components/deals/deal-contracting-journey.tsx` (cartão lateral ~l.997–1040): progresso de assinatura a partir das operações ForSign/documentos nativos já visíveis ao usuário; reutiliza `SignatureStatusIcon`.
- Testes unitários em `contracting-journey` para: com minuta, sem minuta + jurídico aprovado, sem minuta + jurídico pendente.
- Ajuda: atualizar artigo da jornada de contratação (bump de versão); contrato de permissões classificado como apresentação (sem nova ação).
- Validação: Playwright no negócio `bf295dfc…` mostrando "Cláusulas aprovadas" marcado e "Em assinatura — 2 de 4". Sem publicação.
