# Enviar material a quem pediu hoje (19/10) e não recebeu

## O que encontrei nas conversas de hoje
Nenhum material foi enviado hoje. Mesmo assim, a Lia escreveu "material enviado" ou "material a caminho" em vários casos.

| Cliente | O que pediu | Situação |
| --- | --- | --- |
| Luiz Feitosa | Material por aqui ("Cadê o material?") | Não recebeu |
| Ana (Redtech.Net) | Panorama geral da WK para o sócio | Não recebeu |
| Wagner Shimatai | Aceitou material | A Lia disse "enviado", mas não enviou |
| Henrique Lopes | No áudio: "pode mandar por aqui" | Não recebeu |
| Eduardo Porto | Pediu por e-mail (eduardo@epsystem.com.br) | Não recebeu |
| Joney Ricardo | Pediu por e-mail (joney.ricardo@ecostech.com.br) | A Lia disse "encaminhado", mas não enviou |
| Ignacio Celedon | Pediu por e-mail (ignacio.celedon@flowermarket.com.br) | A Lia disse "a caminho", mas não enviou |
| Fabio Veronese | A Lia ofereceu material no fim da conversa | Vou confirmar se ele aceitou antes de enviar |

Quem recusou ou não pediu (Alexandre, Helcio, Rafael, Otávio, Thiago, Anderson/robô, Renan, Leandro) não recebe nada.

## O que será enviado
- O arquivo **"Apresentação WK Technology"**, que já está cadastrado como material. Ele serve como o panorama geral que todos pediram. Nenhum link de página do site vai junto, incluindo o de Hunting.
- O envio sai pelo WhatsApp da conversa, com uma mensagem curta: "Olá, {nome}! Conforme combinamos, segue a apresentação da WK Technology. Fico à disposição." Todos escreveram hoje, então a janela de 24 horas está aberta.
- Para quem pediu por e-mail (Eduardo, Joney e Ignacio), o material também vai pelo WhatsApp, com a frase "e também por aqui, para facilitar". O envio por e-mail depende de uma caixa de e-mail conectada que eu possa usar. Se ela não existir, o e-mail vira uma tarefa para uma pessoa da equipe, sem fingir que foi enviado.

## Cuidados
- Antes de cada envio, vou conferir de novo: a janela de 24 horas, se a pessoa pediu para não receber mensagens e se ela ainda não recebeu o arquivo. Cada pessoa recebe no máximo um envio.
- Cada envio fica registrado na conversa da Inbox e na linha do tempo do Contato ou Lead.
- Uma falha aparece no relatório e passa a conversa para uma pessoa da equipe, sem tentar de novo às cegas.
- Não muda nada na configuração da Lia, não publica o app e não reabre conversas com outras pessoas.

## Validação
- Depois de enviar, vou ler o banco para confirmar o código de envio da Meta e a mudança de situação (enviado/entregue) de cada pessoa.
- O relatório vai separar quem recebeu, quem falhou e o que ficou pendente (e-mail).

## Detalhes técnicos
- Envio único feito por script de servidor que usa o mesmo caminho de `sendMaterialFiles` (URL assinada curta do bucket `sdr-materials`, mais o gravador de `whatsapp_messages` com `raw.sdr.material_id`), limitado ao workspace WK e às 7 ou 8 conversas da tabela.
- Para não enviar duas vezes, o script confere se já existe uma mensagem de saída com aquele material na conversa antes de enviar.
