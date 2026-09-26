# Associações clicáveis no cartão da atividade

## Problema
No rodapé do cartão, "3 associações" é só texto: não abre nada nem leva aos registros.

## O que muda
- "N associações" vira um botão que abre um menu (padrão HubSpot) agrupado por tipo: Contatos, Empresas, Negócios, Leads, Tickets.
- Cada item mostra o nome do registro e é um link para a página dele (/contacts/$id, /companies/$id, /deals/$id, /leads/$id, /tickets/$id).
- Estados: carregando, "Sem associações", erro com "Tentar novamente".
- Acessível por teclado, com rótulo claro, claro/escuro e celular.

## Fora do escopo
Adicionar/remover associações por esse menu (continua via Editar). Sem mudança de banco ou permissões.

## Detalhes técnicos
- Novo componente `ActivityAssociationsMenu` em `activity-card-controls.tsx` (Popover), usado em `activity-timeline-item.tsx` no lugar do `<span>`.
- IDs vindos de `related_contact_id/company_id/deal_id/lead_id/ticket_id` + `contacted_contact_ids`; nomes buscados ao abrir (consulta leve por IDs, respeitando RLS).
- Links com `Link` do TanStack Router.
- Validar com typecheck, lint e Playwright no negócio atual.
