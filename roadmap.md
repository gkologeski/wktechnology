# Roadmap

- [x] Revisar finding de monitoramento "gravações de reunião nunca anexadas" (calendar-recordings-tick)
- [x] Nova aba "Base" em /prospecting: extrair listas de clientes a partir de entidades já cadastradas
      (ex.: clientes de negócios ganhos por serviço; clientes de negócios perdidos de um serviço
      nos últimos 180 dias), com exportação CSV/cópia de nomes.
- [x] Migração assistida de itens de linha de Negócios (texto livre) para linhas de serviço do
      catálogo, com cargo e senioridade: tela /catalog/line-item-migration, classificador puro,
      aplicação idempotente (só itens sem service_catalog_id) e enriquecimento de cargos.
      Observação: nenhum fluxo de importação HubSpot cria deal_line_items diretamente hoje, então a
      prevenção de recaída ficou apenas na UI do editor de itens (aviso + seletor inline).

- [x] Criar fundação visual global e aplicar integralmente em Negócios, usando o Destaque do White Label.
- [x] Aplicar a fundação do Design System em toda a área autenticada, com canvas e componentes compartilhados.
- [x] Inventariar as exceções visuais locais por rota em `docs/qa/design-system-rollout.md` para refinamentos incrementais futuros.
- [x] Permitir selecionar objetos da prévia do White Label e focar diretamente seus controles de estilo.
