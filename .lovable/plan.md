# Timeline: substatus só na timeline e filtros no padrão HubSpot

## Resultado esperado
- No cabeçalho do Negócio, o bloco "Histórico de substatus" ao lado do seletor sai. A troca de substatus continua aparecendo como item de histórico na timeline, com o nome e a cor dos substatus de/para, quem alterou e quando.
- A timeline de todas as fichas comerciais (Lead, Contato, Empresa, Negócio, Ticket) ganha os filtros do HubSpot, adaptados ao TechERP:

```text
[Todas] [Observações] [E-mails] [Chamadas] [Tarefas] [Reuniões] [WhatsApp]   <- abas rápidas
[Pesquisar atividades]        [Atividade v] [Desde sempre v] [Atribuída a v]  [Expandir/Recolher tudo]
```

1. **Abas rápidas por tipo**, com contagem: Todas, Observações, E-mails, Chamadas, Tarefas, Reuniões e WhatsApp.
2. **Pesquisar atividades**: busca no assunto, no texto e no conteúdo dos e-mails já carregados.
3. **Atividade**: um menu com busca, "Selecionar tudo" e grupos com caixas de seleção, usando só os tipos que o sistema realmente registra:
   - Comunicação: Chamadas, E-mails, WhatsApp, Mensagens/Chat
   - Atividade da equipe: Observações, Tarefas, Reuniões, Pesquisas
   - Atualizações: Mudança de etapa, Mudança de substatus, Responsável, Outras alterações de campos
   Integrações e grupos do HubSpot que não existem aqui (anúncios, marketplace, PhantomBuster) ficam de fora.
4. **Período** ("Desde sempre"): reaproveita o filtro de datas atual (Hoje, Ontem, Esta semana, Semana passada, Últimos 7 dias, intervalo personalizado), agora com busca, como no HubSpot.
5. **Atividade atribuída a**: escolha múltipla de membros do workspace, com "Eu" no topo e "Sem responsável".
6. **Expandir tudo / Recolher tudo** para os cartões.
- O botão "Histórico" atual vira o grupo "Atualizações" do filtro Atividade, então nenhuma função é perdida.
- As escolhas ficam salvas por tipo de ficha no navegador. Quando os filtros não deixam nenhum item, aparece um aviso de lista vazia com o botão "Limpar filtros".

## Detalhes técnicos
- Remover `SubstatusHistory` do `deals.$id.tsx` e manter a invalidação da timeline após `setSubstatus`. O componente fica sem uso e pode ser apagado se nenhum outro lugar o usar.
- Novo `src/lib/timeline/timeline-filters.ts`: catálogo de grupos e tipos, mapeia `activity.type` e `property_history.property` (stage, stage_substatus_id, assigned_to/owner_id, demais) para a categoria certa e aplica busca, tipo e responsável. Tudo puro e testável.
- `use-timeline-feed.ts`: troca `showHistory` por um estado de filtros e aplica o filtro sobre `timelineEntries`. A busca e o período continuam usando o carregamento atual, sem consultas novas.
- Novos componentes de apresentação: `timeline-filter-bar.tsx` (abas, busca, menus) e `activity-type-filter.tsx` (menu com grupos e caixas de seleção). Ambos substituem o `TimelineRail`, preservando o Resumo IA e o indicador "Atualizando…".
- Expandir e recolher: estado único repassado ao `TimelineEntriesList` e aos cartões que já recolhem conteúdo.
- Sem mudanças no banco, nas permissões ou nas regras. A visibilidade continua a mesma de hoje.

## Validação
- Testes unitários do catálogo e dos filtros: categorias, substatus em Atualizações, busca, responsável e combinação de filtros.
- Playwright na ficha do Negócio: o bloco do cabeçalho sumiu; mudar o substatus faz o item aparecer na timeline; cada filtro reduz a lista; "Limpar filtros" funciona; conferir em tela larga e no celular.
- Verificação de tipos, lint, testes e build.
