# Filtro de Responsável: grupos Ativos/Inativos e mesclagem de repetidos

## O que existe hoje
O filtro lateral "Responsável" (Leads, Contatos, Empresas, Tickets, Tarefas de projetos) mostra, numa lista única, os usuários do workspace e os responsáveis do HubSpot que ainda não foram ligados a um usuário. Dos 48 responsáveis do HubSpot, 39 estão arquivados. Hoje eles aparecem apenas com "(arquivado)" no nome.

Repetidos confirmados no banco: Marketing WK Technology, Andressa Wolf Kologeski, Sabrina Maciel e Priscila Alves do Nascimento aparecem como usuário do sistema e também como responsável do HubSpot com o mesmo nome.

## O que muda
1. **Grupos recolhíveis**
   - "Sem responsável" continua no topo.
   - **Ativos:** usuários do sistema e responsáveis ativos do HubSpot. Vem aberto.
   - **Inativos:** responsáveis arquivados. Vem fechado.
   - Cada cabeçalho mostra a quantidade e quantos estão marcados (ex.: "Inativos (39) · 2 selecionados").
   - Se houver um inativo marcado, o grupo abre sozinho, para a seleção não ficar escondida.
2. **Mesclagem de repetidos**
   - A mesma pessoa vira uma única linha. A comparação usa o nome sem maiúsculas, acentos ou espaços extras, ou o e-mail, quando houver.
   - Marcar a linha filtra os registros de todas as origens dessa pessoa: usuário e HubSpot.
   - Se a pessoa tiver um usuário ativo, ela fica em Ativos.
   - A linha mostra um pequeno indicador "Sistema + HubSpot" (com dica ao passar o mouse).
3. Os filtros já salvos continuam funcionando: os códigos guardados não mudam e cada linha só agrupa esses códigos.

## Fora do escopo
- Não ligar de forma permanente o responsável do HubSpot ao usuário. Isso continua em Configurações › HubSpot.
- Sem mudanças em banco, permissões ou nas regras de filtragem.
- O filtro rápido de "Responsável" (lista suspensa na barra da grade) só mostra usuários do sistema, sem repetidos nem inativos, e fica como está.
- Casos com nome diferente e e-mail com erro de digitação (ex.: "eduada...@wktecnology") não são mesclados automaticamente.

## Detalhes técnicos
- `src/lib/owner-filter-options.ts` (novo, puro e testado): `buildOwnerOptions(members, hsOwners)` agrupa por chave normalizada (NFD, sem acentos, minúsculas, espaços únicos; e-mail quando existir) e retorna `{ key, label, ids[], sources, active, is_me }`.
- `src/components/owner-filter.tsx`:
  - usa `Collapsible` (shadcn) para Ativos e Inativos;
  - uma caixa de seleção por grupo mesclado: marcada quando todos os `ids` estão em `ownerIds`, parcial quando só alguns; ao alternar, adiciona ou remove todos os `ids`;
  - troca `bg-orange-500` por token semântico e usa cabeçalhos com `aria-expanded` e foco visível.
- `applyOwnerFilter` e `splitOwnerIds` ficam como estão.
- Testes unitários de mesclagem, classificação ativo/inativo e seleção parcial. Depois: typecheck, lint e o teste automático de valores fixos.
- Verificação no navegador em /leads: abrir e fechar os grupos, marcar uma pessoa mesclada e conferir o resultado.
