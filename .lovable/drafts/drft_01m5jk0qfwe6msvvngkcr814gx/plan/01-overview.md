# Lia: enviar o PDF da apresentação, e não o link da página

## Por que aconteceu (conferido no banco, só leitura)
- A Lia pode enviar **7 materiais**: as **6 páginas do site** (Outsourcing, Hunting, Squad, Fábrica, Consultoria, IA), todas ativas e aprovadas, e o PDF **"Apresentação WK Technology"**.
- A lista de materiais do agente está vazia, e vazia quer dizer "todos liberados". Por isso as páginas continuam disponíveis para ela.
- O texto publicado (v12, seção 7) diz apenas "só envie material ativo e aprovado após pedido ou aceite". **Ele não diz qual material preferir** nem proíbe as páginas do site.
- A oferta foi genérica ("algum material"), e a conversa veio de uma campanha de Outsourcing. Então ela escolheu a página mais parecida com esse contexto. A descrição do PDF ("quando for oferecido um material de divulgação") até indicava o PDF, mas nada no texto dava a ele prioridade sobre as páginas.

## Ajuste sem mexer no código
**1. Texto da Lia (rascunho v13, a partir da v12).** Na seção 7, substituir o começo por:

> Material padrão: a "Apresentação WK Technology" (PDF). Sempre que você oferecer material, ou o cliente pedir ou aceitar material, apresentação ou portfólio, envie esse PDF pela ferramenta. Não envie páginas do site ("Página: ...") e não escreva URLs do site, nem quando a conversa vier de uma campanha de um serviço específico. Só envie uma página se o cliente pedir expressamente o link do site. Se o PDF não estiver disponível ou o envio falhar, explique e encaminhe ao responsável; não troque pelo link.

Também incluo um bom exemplo: "Pode" → envio do PDF → "Enviei nossa apresentação em PDF. Qualquer dúvida, estou por aqui."

**2. Recomendado (configuração, não código).** O texto orienta a IA, mas não garante 100%. Para a página não sair de jeito nenhum, em Agentes › Materiais, deixar marcado para a Lia **só o PDF**. As 6 páginas continuam cadastradas, mas ela não consegue escolhê-las.

## O que não muda
- Nenhuma alteração de código, banco ou outros agentes.
- O rascunho só vale depois que **você publicar**. Nada é enviado ao Fernando nem a outros clientes.

## Validação
- No painel de teste (sem envio real), repetir a conversa: oferta de material → "Pode". O resultado esperado é o PDF, sem link. Repetir também com uma conversa vinda da campanha de Outsourcing.
- Playwright na tela da Lia para conferir o rascunho salvo.

**Porte P, de 15 a 25 minutos.**
