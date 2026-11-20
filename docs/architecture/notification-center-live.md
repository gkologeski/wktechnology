# NOTIFICA-CENTRAL — pacote 5: concluir Central e sino

## Escopo e numeração

O pacote 5 do plano original (0–13) era Central e sino: lista, filtros, contexto, leitura e adiamento. A auditoria 0 agrupou o trabalho em quatro fatias e os pacotes 3/4 anteciparam parte desse escopo. Esta entrega fecha lacunas reais dessa central; não atribui ao pacote 5 novos produtores, digest, escalonamento ou integração Slack.

Base local bcd049e06. Migração aditiva 0394 depende das fronteiras do pacote 3 (0391/0392); mantém compatibilidade com as entregas opcionais do pacote 4 (0393). As migrations históricas permanecem imutáveis. Não concede permissões a cargos nem aplica configuração/SQL em produção.

## Leitura e contexto

- notification_center_badge retorna apenas unread (até 100), unreadCapped e checkedAt do banco. Próprio destinatário, membership ativo, workspace selecionado, prova da origem e RLS atual continuam obrigatórios. Exclui adiados, lidos, futuros e histórico sem prova.
- notification_center_lookup recebe de 1 a 30 UUIDs explícitos, revalida as mesmas condições e retorna itens/checkedAt. Pode consultar uma notificação fora da página principal, sem procurar por título ou ler snapshot do realtime. Lidos/adiados podem ser consultados, mas não interrompem.
- As duas APIs usam requireWorkspaceContext, expected workspace e ator derivado da sessão. Não aceitam userId alternativo. Helpers privados e tabelas de contexto não têm GRANT público. Sessões somente leitura podem consultar; marcação e adiamento continuam em suas RPCs de escrita protegidas.
- Solicitações de contratação são classificadas por kind real (professional→people; supplier→contracts), consultado somente após autorização da origem. Não se usa título/link para inferir módulo. A assinatura, busca, cursor/cutoff, neutralização histórica e limites de notification_center_list permanecem compatíveis.

## Realtime e custo do sino

A fila efêmera recebe somente UUIDs, agrega eventos próximos e limita a memória. Inserções são consultadas pelo gateway protegido em lotes de até 30; preferências e silêncio atuais controlam uma interrupção neutra por grupo. Eventos repetidos, callbacks de identidade antiga, consultas falhas, avisos lidos/adiados ou sem acesso não geram conteúdo ou interrupções de fallback.

UPDATE de leitura/adiamento invalida a consulta sem som ou toast. DELETE só invalida por ID já conhecido no cache próprio do workspace, pois a carga de exclusão pode conter somente a chave. O polling recupera alterações não recebidas. Nenhum conteúdo bruto do provedor realtime é usado na UI.

O contador é independente da InfiniteQuery da lista. Lista somente com popover aberto; ao fechar, cancelam-se consultas e preserva-se no máximo a primeira página. O sino limita a navegação a três páginas e direciona a consulta completa à central. A central não mantém polling de sua lista quando outra aba está em uso.

## Interação

Ações e paginação não operam sobre um termo de busca anterior enquanto o debounce/consulta está pendente. Falha não é mostrada como zero e não mantém botão de ação sobre cache antigo. Contagem da central é do recorte atual; contagem do sino é do workspace ativo.

Área e foco da central são parâmetros validados de navegação (area/notice). Lookup por ID sustenta links para um aviso fora da primeira página, usando checkedAt validado como corte para uma marcação individual. Um parâmetro não concede acesso; ID inválido, excluído, de outra pessoa ou inacessível não é substituído por conteúdo arbitrário. Abrir o registro continua passando pela rota canônica e suas permissões.

Desktop mantém o painel lateral aprovado. Em telas abaixo da grade de duas colunas, Sheet canônico traz o contexto para a área visível, com foco e retorno à origem. Ler/adiar continuam distintos de concluir tarefa ou aprovar. O rodapé do sino abre preferências do workspace; as globais continuam disponíveis. Notificações de conversa preservam o ID em todos os canais da Inbox.

## Aceite local

Testes reais usam PostgreSQL/PostgREST descartáveis e JWTs sintéticos assinados; nenhum segredo de produção. UI usa componentes reais com fixtures e White Label, em desktop/celular. Os cinco cenários de autorização, rajadas, duplicidade, UPDATE silencioso, identidade antiga, cache após falha, paginação, busca pendente e detalhe móvel fazem parte do aceite. Não há publicação, envio real, novo produtor, nova prioridade inferida ou aplicação editorial da Ajuda nesta entrega.
