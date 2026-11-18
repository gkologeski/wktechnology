# WIZARD-CAMPANHA-WA — Nova tela de criação de campanha de WhatsApp

Porte: M — estimativa 4 a 6 h (tela + agrupamento de modelos + Ajuda + testes Playwright). Sem mudança de banco, permissões ou regras de envio.

## Problema
- O formulário atual é uma coluna única com 8 seções (Identificação, Remetente, Mensagem, Público, Após a resposta, Distribuição, Ritmo, ...). Decisões dependem umas das outras (número → modelos → variáveis → público), mas aparecem misturadas, obrigando a ler tudo e voltar.
- Na lista de modelos, modelos de mesmo nome em números diferentes viram uma linha só ("prospeccao_001 · +55 48 6136-9564, +55 48 6137-0317"), sem deixar claro de qual número se está escolhendo.

## Nova jornada (assistente em 5 etapas)
Barra de etapas no topo, clicável para etapas já concluídas; botões "Voltar" e "Continuar" fixos no rodapé; cada etapa só libera "Continuar" quando válida, com o motivo exibido.

```text
1 Números  →  2 Mensagem  →  3 Público  →  4 Atendimento  →  5 Ritmo e revisão
```

1. Números — nome da campanha; número principal; rodízio de números (adicionar, modo sequência/sorteio). Cada número mostra nome, qualidade e agente do canal.
2. Mensagem — modelos agrupados por número, igual ao anexo:
   - Cabeçalho do grupo: "+55 48 6137-0317 · WK Technology"
   - Itens: "6137-0317 › prospeccao_001 · pt_BR"
   - Mesmo nome em dois números = dois itens distintos, cada um no seu grupo, com busca por nome.
   - Rodízio de modelos com peso; variáveis do modelo logo abaixo; prévia do balão de WhatsApp à direita.
3. Público — fila de prospecção ou filtro próprio; contagem estimada; bloqueios (reenvio recente, já cliente, negociação aberta, números recusados) com as liberações manuais.
4. Atendimento — agente SDR (travado quando o número tem canal próprio), "Após a resposta" e distribuição das conversas.
5. Ritmo e revisão — intervalo mínimo/máximo e janela de envio; resumo em cartões (números, modelos por número, público, atendimento, ritmo) com "Editar" que volta à etapa; ações "Salvar rascunho" e "Salvar e iniciar".

Campanha pausada: abre direto na revisão; etapas bloqueadas mostram o cadeado com o motivo (ex.: número principal só muda em rascunho), mantendo PAUSA-ROTACAO.

## O que não muda
Validações do servidor (modelos aprovados por número, rodízios, público, opt-out), permissões existentes de criar/editar campanha, dados salvos e disparo.

## Detalhes técnicos
- Dividir `campaigns.whatsapp.tsx` em componentes de etapa em `src/components/whatsapp/campaign-wizard/` (presentacionais; dados continuam no route/hook), mesmo estado de formulário atual.
- Modelos: item por par (número, modelo) com valor `phoneId::name::lang`; ao escolher, grava em `template_rotation[].senders = [phoneId]`. Itens iguais escolhidos em dois números são unidos no mesmo item de rodízio com `senders` somados (compatível com `sendersForTemplate`). Usar `SelectGroup/SelectLabel` (ou Command com busca).
- Validação por etapa com zod parcial reutilizando o schema existente.
- Ajuda: atualizar `docs/help/crm/criar-campanha-whatsapp.md` (v9) e catálogo; `help:coverage`.
- Testes: unitário do agrupamento/mescla de senders; Playwright percorrendo as 5 etapas em 1280 e 390 px, claro/escuro; `permissions:check`, tipos e testes de WhatsApp.
- Sem publicar.
