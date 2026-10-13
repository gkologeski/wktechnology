# Nova campanha de WhatsApp: modelo, variáveis do CRM e quadro de Público

## O que muda

### 1. Mensagem a partir do modelo
- Ao escolher um modelo aprovado, o campo "Mensagem" é preenchido com o texto exato do modelo e fica desabilitado. O texto continua visível, só não pode ser editado.
- Ao voltar para "Nenhum (texto livre)", o campo volta a ser editável e o que você tinha digitado continua lá.
- Na edição de uma campanha, o modelo e o texto salvos vêm preenchidos. Hoje eles chegam em branco.

### 2. Variáveis ligadas aos campos do CRM
- Para cada variável do modelo ({{1}}, {{2}}…) aparece uma linha com:
  - um seletor de campo, agrupado por Lead, Contato, Empresa e Negócio (por exemplo: Contato › Primeiro nome, Empresa › Nome, Negócio › Título, Lead › Cargo);
  - um "valor se vazio" opcional;
  - uma prévia com o primeiro destinatário do público.
- O campo disponível depende do tipo de público: um público de Contatos permite os campos do contato e da empresa dele; um público de Negócios permite os campos do negócio, do contato principal e da empresa; e assim por diante.
- A campanha só pode ser salva com todas as variáveis definidas. Destinatários com variável vazia e sem "valor se vazio" aparecem como aviso, e você escolhe entre pular ou manter.

### 3. Quadro "Público"
- Substitui a caixa de colar telefones por três opções:
  - **Fila de prospecção:** lista as filas do workspace, com tipo e quantidade.
  - **Criar público:** você escolhe a base (Leads, Contatos, Empresas ou Negócios) e monta filtros com os campos do banco (responsável, etapa, origem, cidade, setor, datas etc.), com contagem ao vivo. Se quiser, salva o público como segmento para reutilizar.
  - **Lista manual:** a colagem atual de telefones, mantida para não remover nada que já existe.
- Em todas as opções aparece um resumo antes de salvar: quantos destinatários serão incluídos e quantos ficam de fora, separados por motivo (sem telefone, telefone inválido, duplicado, descadastrado).
- Cada destinatário fica ligado ao registro de origem, para a conversa aparecer na ficha certa.

## Regras preservadas
- O envio continua exigindo modelo aprovado fora da janela de 24 horas. Ritmo, intervalo e cotas não mudam.
- Só entram registros do workspace ativo que você tem permissão de ver. A permissão é conferida no servidor.
- A campanha é salva em rascunho. Nada é enviado até você clicar em Iniciar.

## Validação
- Testes: preenchimento de variável por campo, uso do "valor se vazio", exclusão de quem não tem telefone, quem está duplicado e quem está descadastrado, e respeito à visibilidade do usuário.
- Verificação de tipos, estilo, testes e versão de produção, com os resultados reais.
- Navegador: criar uma campanha em rascunho usando uma fila e outra com um público próprio, conferir a mensagem desabilitada e a prévia das variáveis, e excluir as campanhas de teste. Nenhum envio.

## Detalhes técnicos
- Os valores das variáveis são resolvidos no servidor no momento de salvar e gravados em `whatsapp_campaign_recipients.variables`. O disparo não muda. Também é gravado `contact_id` (e a origem lead/empresa/negócio no `variables._source`), sem migration.
- Os campos disponíveis vêm de uma lista branca por entidade (`campaign-audience-fields.ts`), nunca de colunas livres. Assim, nenhum dado sensível ou campo não permitido entra na mensagem.
- Nova server fn `previewCampaignAudience` (fila, segmento ad hoc ou manual) retorna as contagens e 3 amostras. `createWhatsAppCampaign` aceita `audience` + `variable_map` como alternativa a `recipients`.
- Para a fila: `prospecting_queues` (`kind` estática por `item_ids` ou dinâmica por `filters`), com o mesmo resolvedor que a Prospecção já usa. Para o público próprio: o motor de `src/lib/segments` (`SEGMENT_ENTITIES`).
- Limite de 5.000 destinatários por campanha, como hoje. Leitura paginada em blocos de 1.000.
- Na UI: quadro em `FormSection`, com seletor de origem em abas, estados de carregamento, vazio e erro, e rótulos acessíveis.
