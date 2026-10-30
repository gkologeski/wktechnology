# Nova Campanha WhatsApp — reorganizar campos e corrigir "Cargo resumido"

Porte: M · Estimativa: 1h a 1h30 (reorganização ~40 min, correção do filtro ~30 min, testes/conferência ~20 min).

## 1. Por que "Cargo resumido" só mostra "Analista"
A lista de sugestões pega as primeiras 5.000 linhas em ordem alfabética e só depois remove repetidos. Contatos têm 41.669 registros com cargo resumido (33 valores diferentes) — as 5.000 primeiras são todas "Analista". O mesmo afeta outros campos com sugestão (Área de atuação, Nível hierárquico, Setor, Cidade...).

Correção: buscar diretamente os valores distintos no banco (no máximo 200), respeitando as mesmas regras de acesso de hoje e a mesma lista de campos permitidos. Nenhum registro muda; quem vê o quê não muda.

## 2. Nova ordem dos campos (seções com título)

```text
1. Identificação      Nome da campanha
2. Remetente          Número remetente + aviso de fixação
                      Origem da autorização (só número Meta)
3. Mensagem           Template
                      Mensagem / prévia do modelo + dica
                      URL de mídia (opcional)
4. Público            Painel de público (filtros, variáveis, lista manual)
5. Após a resposta    Agente SDR (só com template aprovado)
6. Ritmo de envio     Msgs por minuto | Intervalo mín. a máx. (lado a lado)
```

- Nome vem primeiro; Template sai do lado de "Msgs por minuto" e fica junto da mensagem; configurações de ritmo vão para o fim, agrupadas.
- Cada seção com título curto (SectionHeader/FormSection do design system), separadores discretos, labels ligados aos campos, empilhamento em telas pequenas, tema claro/escuro.
- Nenhum campo, regra, validação ou comportamento removido ou alterado — só posição e agrupamento.

## Detalhes técnicos
- `src/routes/_authenticated/campaigns.whatsapp.tsx`: reordenar JSX do diálogo em blocos `FormSection`; adicionar `htmlFor`/`id` aos labels que faltam.
- Nova migration: função `whatsapp_campaign_filter_values(entity, column, search, limit)` SECURITY INVOKER (RLS do usuário), `SELECT DISTINCT` com coluna validada contra lista fixa no SQL + GRANT a authenticated; campos personalizados continuam pelo caminho atual com melhoria equivalente (`DISTINCT` via jsonb).
- `src/lib/whatsapp-campaigns.functions.ts`: o handler de sugestões chama a função, mantendo `isSuggestField`/workspace ativo.
- Contrato de permissões atualizado (reusa a permissão atual de campanhas; cenários permitido/sem chave/deny/outro workspace/inativo) + teste do caso "5.000 iguais" e de coluna não permitida.
- Conferência: consulta no banco (deve retornar os 33 cargos) e Playwright abrindo Nova Campanha e o filtro Cargo resumido.
