# Fase 3 dos grids — Filtros laterais e visões salvas

## Objetivo
Levar para **Tickets, Projetos, Pessoas, Propostas e Faturas** o mesmo padrão de Empresas e Contatos: um botão "Filtros" que abre um painel lateral, filtros aplicados visíveis como etiquetas, e visões salvas ("Minhas visões", favorita, compartilhar com a equipe).

## Por que não "migrar para a lista padrão"
A lista padrão das entidades só funciona com Leads, Contatos, Empresas, Negócios e Atividades, e cada uma dessas cinco telas tem ações próprias (kanban de tickets, progresso de projeto, cobrança de faturas). Trocar a tela inteira removeria recursos. Por isso, a proposta é **acrescentar** o painel de filtros e as visões salvas às telas atuais, sem retirar nada.

## Etapas
1. **Mockup primeiro (regra do projeto):** montar uma tela de demonstração de Tickets com o painel de filtros aberto, as etiquetas de filtro e o menu de visões, com dados fictícios. Só sigo depois da sua aprovação visual.
2. **Painel de filtros comum:** um único painel lateral reaproveitado nas cinco telas. Cada tela informa os seus campos:
   - Tickets: status, prioridade, responsável, empresa, criado entre.
   - Projetos: status, contrato, responsável, prazo entre, progresso.
   - Pessoas: status, vínculo, cargo, contratação entre.
   - Propostas: status, valor mínimo/máximo, versão.
   - Faturas: status, gateway, vencimento entre, valor mínimo/máximo.
   Os filtros que já existem no topo dessas telas continuam funcionando e passam a aparecer no painel.
3. **Visões salvas:** salvar filtros, ordenação e busca com um nome; marcar uma como padrão; compartilhar com o workspace. Com isso, a ordenação passa a ficar salva também nessas telas.
4. **Validação:** abrir as cinco telas no navegador com a sua conta, aplicar filtros, salvar uma visão, recarregar e conferir que ela volta. Depois, testes, checagem de código e build.

## Mudança no banco (precisa da sua aprovação)
Hoje, as visões salvas só aceitam Leads, Contatos, Empresas e Negócios. Para as cinco telas novas, preciso liberar esses cinco nomes nessa regra. As permissões e a separação por workspace continuam as mesmas.

## Fora do escopo
Arrastar colunas nessas telas fica para a Fase 4. Continuo sem mexer nas regras de negócio e nas permissões.

## Detalhes técnicos
- Migração: substituir o CHECK de `saved_views.entity` por um que acrescente `tickets`, `projects`, `people`, `proposals`, `invoices`. A RLS e os GRANTs atuais não mudam.
- Componentes novos: `src/components/grid/grid-filter-panel.tsx` (Sheet + campos declarativos: select múltiplo, intervalo de data, intervalo numérico), `grid-filter-chips.tsx`, `grid-saved-views-menu.tsx`; hook `use-grid-saved-view.ts`, que lê e grava `saved_views` pelo cliente com RLS.
- Filtragem no cliente sobre as linhas já carregadas, junto com `useClientSort` (mesma abordagem das Fases 1 e 2). Em Tickets continua o limite atual de 500 registros.
- Os filtros de responsável usam o `OwnerFilter` existente (Ativos/Inativos).
