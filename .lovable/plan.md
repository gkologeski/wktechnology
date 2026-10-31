# Contatos: filtros por escolha + registro de permissões para publicar

Porte total: M — estimativa 1h30 a 2h.

## Parte 1 — Registro de permissões (libera a publicação)
Porte P/M — 45 min a 1h.
- Registrar as permissões do sino de notificações, do gráfico "Envios por dia" e da busca do Painel de Vendas, com os cinco testes exigidos (permitido, sem permissão, negado, outro workspace, membro inativo).
- Resolver também os itens antigos que travam a publicação (tela de Tarefas, papel do usuário, área logada, distribuição de conversas das campanhas), sem mudar quem acessa o quê.
- Rodar a checagem de permissões até passar. Publicar só com seu aceite.

## Parte 2 — Campos de contatos como escolha
Porte P — 40 a 60 min.

O painel do print é o de **filtros** da lista de Contatos. Avaliação com os dados reais da base:

| Campo | Valores diferentes hoje | Proposta |
|---|---|---|
| Cargo resumido | 33 | Escolha múltipla (marcar vários) |
| Área de atuação | 14 | Escolha múltipla |
| Nível hierárquico | 13 | Escolha múltipla |
| Cargo | ~14.700 (texto livre digitado) | Mantém texto, com sugestões enquanto digita |
| Etapa do ciclo de vida | 8 | Já é escolha — sem mudança |
| Status do lead (HubSpot) | 10 | Escolha múltipla, se o filtro existir no painel |
| País | 55 | Escolha com busca |
| Estado | 222 (dados inconsistentes, ex.: "SC" e "Santa Catarina") | Fica em texto por ora; padronizar exige limpeza dos dados — proponho em etapa separada |
| Cidade | ~1.400 | Texto com sugestões |

- As opções vêm do próprio banco (valores distintos já existentes), respeitando o que cada pessoa pode ver.
- Cargo resumido, Área e Nível continuam calculados automaticamente a partir do Cargo; na ficha seguem só leitura (não viram campo editável).
- O mesmo vale para o painel de filtros de Leads, que usa os mesmos campos.

## Fora do escopo
Sem alterar dados existentes nem regras de classificação.

## Detalhes técnicos
- Filtros derivados hoje são `derived: Record<string,string>` (texto, `ilike`); passam a aceitar lista de valores (`in`), mantendo compatibilidade com filtros salvos em texto.
- Opções carregadas por função de servidor reutilizando o padrão de valores distintos já usado em Campanhas (migration 0283).
