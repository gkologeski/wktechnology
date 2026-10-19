# Foto de Contatos e Leads exibida em todo o sistema

## Limitação confirmada
O WhatsApp oficial da Meta não entrega a foto de perfil do cliente, só o nome. Por isso a foto passa a ser um campo do próprio cadastro, como já acontece com o logotipo das empresas.

## O que muda
1. **Campo de foto em Contato e Lead.** Na ficha, ao passar o mouse sobre o avatar, aparecem as opções Enviar foto, Trocar e Remover. A imagem é reduzida no navegador e guardada de forma privada. A troca pede confirmação e fica registrada na linha do tempo.
2. **Uma única forma de exibir a pessoa.** Um avatar padrão mostra a foto. Sem foto, mostra as iniciais com uma cor fixa para cada contato. Ele aparece em:
   - Inbox WhatsApp, E-mail e Chat: lista de conversas, cabeçalho e painel do cliente;
   - listas de Contatos e Leads;
   - fichas e associações, como contatos de uma empresa ou de um negócio;
   - seletores de contato e lead.
3. **Atualização imediata.** Quando a foto é trocada, todas as telas abertas passam a mostrar a nova sem recarregar.
4. **Ao converter um Lead em Contato**, a foto vai junto.

## Fora do escopo
- Buscar a foto no WhatsApp ou no LinkedIn automaticamente, porque não há meio oficial.
- Fotos de candidatos e de pessoas do TechPeople, que já têm foto própria.

## Detalhes técnicos
- Migration aditiva: `photo_url text` (caminho no storage) e `photo_updated_at` em `contacts` e `leads`, sem alterar RLS. Os caminhos ficam fora do histórico de campos.
- Bucket privado `contact-photos`, com limite de 2 MB. As políticas em `storage.objects` usam o caminho `<workspace_id>/<entity>/<id>.webp`: leitura para membros do workspace e escrita para quem pode editar o registro (`user_can_act`).
- `PersonAvatar` em `src/components/people/person-avatar.tsx` recebe nome, semente e caminho. As URLs assinadas são carregadas em lote pelo hook `usePersonPhotos(ids)`, como no `useCompanyLogos`, com cache de 50 minutos.
- Upload por server function autenticada, que valida a permissão, o tipo de imagem e o tamanho, e grava a timeline. Depois do upload, o app atualiza as consultas `person-photos`, `inbox-channel` e as listas.
- A conversão de Lead em Contato, em `sales-flow`/convert, copia o caminho da foto.

## Validação
- Testes unitários das iniciais e da semente de cor, da validação de tipo e tamanho e da cópia da foto na conversão.
- Checagem de tipos, lint, testes e build, com os resultados reais relatados.
- Playwright com sessão real: enviar a foto de um contato de teste criado e apagado no próprio teste, conferir a foto na ficha, na lista e na Inbox, e as iniciais quando não há foto. Nenhum cadastro real de cliente é alterado e nada é publicado.
