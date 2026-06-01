## Objetivo

Substituir o composer em abas atual do `ActivityTimeline` por uma **barra de ações estilo HubSpot** (igual ao print): uma linha horizontal de botões circulares com ícone + rótulo curto embaixo, e um botão **"Mais"** que abre um menu pesquisável com as ações restantes.

## Layout proposto

```text
( ⓦ )   ( 📅 )   ( ✉ )   ( ⓦ+ )   ( ☑ )   ( ··· )
WhatsApp Reunião  E-mail  Reg.WA   Tarefa  Mais
```

- Botões circulares (~56px), fundo `muted`, ícone centralizado, label `text-xs` truncado embaixo.
- 5–6 ações fixas visíveis (as mais usadas); o resto vai no menu **Mais**.
- Hover/focus com anel `primary`, igual aos outros botões do CRM.
- Clique em qualquer botão **abre o composer/dialog correspondente abaixo da barra** (inline para textos curtos, modal para Reunião/Email/Ligação/WhatsApp).
- Quando nenhum botão está ativo, mostra apenas a barra (o editor não fica permanentemente aberto como hoje).

## Ações da barra (ordem padrão, fixas)

1. **Nota** (`StickyNote`) — composer inline com `RichHtmlEditor` (igual ao atual).
2. **E-mail** (`Mail`) — abre `SendEmailDialog`.
3. **Ligação** (`Phone`) — abre `CallDialer`.
4. **Tarefa** (`CheckSquare`) — composer inline com `due_date`.
5. **Reunião** (`CalendarDays`) — abre `MeetingDialog`.
6. **Mais** (`MoreHorizontal`) — abre `Popover` com lista pesquisável.

## Menu "Mais" (Popover com Command/search)

Agrupado em duas seções, igual ao HubSpot:

**Criar / iniciar**
- Enviar WhatsApp → `SendWhatsAppDialog`
- Inscrever em sequência *(desabilitado, badge "Em breve" 🔒)*
- Envolver-se no LinkedIn *(desabilitado 🔒)*

**Registrar (histórico de algo já feito)**
- Registrar SMS → composer inline, `type=sms`
- Registrar Correio Postal → composer inline, `type=postal_mail`
- Registrar e-mail → composer inline, `type=email`
- Registrar ligação → composer inline, `type=call`
- Registrar mensagem do LinkedIn → composer inline, `type=linkedin_message`
- Registrar conversa do WhatsApp → composer inline, `type=whatsapp`
- Registrar reunião → composer inline, `type=meeting` (sem Google Calendar)

Topo do popover tem `Input` de busca filtrando os itens (igual ao print).

## Comportamento

- Ação ativa fica destacada (anel `primary`) enquanto o composer/dialog estiver aberto.
- Composer inline aparece **abaixo** da barra com: campo Assunto opcional + `RichHtmlEditor` + anexos + botões "Cancelar" / "Salvar". Salvar cria `activities` com o `type` correto.
- Dialogs (Email/Ligação/Reunião/WhatsApp) continuam reaproveitando os componentes existentes, com pré-preenchimento de e-mail/telefone vindo do contato relacionado (lógica já implementada).
- Sem reordenação por enquanto: o item "Reordenar botões de atividade" do HubSpot fica fora de escopo.

## Arquivos afetados

**Editado**
- `src/components/activity-timeline.tsx` — remover `Tabs` de Registrar/Criar; adicionar `ActivityActionBar` (barra circular) + `Popover` "Mais" usando `Command`; manter a lógica de inserção/dialogs já existente; reorganizar o estado para "ação selecionada" em vez de "aba ativa".

**Sem mudanças**
- `MeetingDialog`, `SendEmailDialog`, `CallDialer`, `SendWhatsAppDialog`, `crm.ts`, banco — tudo já existe e fica reaproveitado.

## Fora de escopo

- Reordenação drag-and-drop dos botões ("Reordenar botões de atividade").
- Sub-menus laterais (HubSpot mostra `>` em "Fazer uma ligação" / "Envolva-se no LinkedIn") — abriremos o dialog direto.
- Persistir preferência do usuário sobre quais 5 botões aparecem fixos.
