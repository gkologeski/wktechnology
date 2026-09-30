# Auditoria de recursos dos grids — 30/09/2026

Levantamento somente leitura, feito por busca no código de `src/routes/_authenticated`. É heurístico: um "—" indica que o recurso não foi encontrado no arquivo da rota. Ele pode existir num componente filho e precisa ser confirmado antes de implementar.

## Referência (grids completos)
Leads, Contatos, Empresas, Negócios, Tarefas, Contratos, Serviços, Comunicações e Notas (via `EntityList`), além de Candidatos e Lançamentos financeiros. Eles já têm:
- filtros laterais;
- busca;
- seleção múltipla;
- seleção de todos os filtrados;
- ações em massa;
- exportação;
- arrastar colunas;
- visualizações salvas;
- paginação.

**Lacuna confirmada em Empresas:** só dá para ordenar por Nome, Criada em e Atualizada em (`DECLARED_SORT_KEYS`). As demais colunas não ordenam.

## Grids com lacunas

| Grid | Tem hoje | Falta (proposta) | Esforço |
|---|---|---|---|
| Empresas | tudo, exceto a ordenação completa | ordenar por todas as colunas que vêm do banco | P |
| Vagas (ATS) | filtros, seleção, massa | ordenação, busca, exportar, colunas, visões | M |
| Ofertas (ATS) | seleção, massa | ordenação, filtros, busca, exportar | M |
| Pessoas | busca, seleção, massa | ordenação, filtros laterais, exportar, colunas | M |
| Benefícios / Documentos / Incidentes (People) | seleção, massa | ordenação, busca, filtros, exportar | M cada |
| Projetos | busca, seleção, massa | ordenação, filtros, exportar, colunas | M |
| Tarefas de projetos | busca, seleção, massa | ordenação, filtro de responsável múltiplo, exportar | M |
| Propostas | seleção, massa | ordenação, busca, filtros, exportar | M |
| Tickets | busca, seleção, massa | ordenação, filtros laterais, exportar, colunas | M |
| Faturas | busca | ordenação, seleção, filtros, exportar | M |
| NFS-e / Recorrências / Contas bancárias / Auditoria financeira | — | ordenação, busca, exportar, paginação | P–M cada |
| Pessoas: faturamento, margem, onboarding, offboarding, psicossocial, meu time | — | ordenação, busca, exportar | P–M cada |
| Campanhas de e-mail | — | ordenação, busca, filtros, exportar | M |
| Modelos de contrato | busca | ordenação, exportar | P |
| Timesheet | seleção | ordenação, filtros, exportar | M |

Telas de configuração (KB, snippets, portal, segmentos, equipes, exportações, cobrança, diagnóstico RBAC) são listas administrativas curtas. Não recomendo esses recursos nelas.

## Proposta de fases
1. **Ordenação:** criar um componente comum de ordenação por coluna e aplicar em todos os grids operacionais, começando por Empresas.
2. **Exportar e busca** nos grids operacionais que ainda não têm.
3. **Filtros laterais e visões salvas:** migrar Tickets, Projetos, Pessoas, Propostas e Faturas para o padrão `EntityList`.
4. **Arrastar colunas** nos grids migrados.
