---
module_key: crm
slug: campos-e-status
title: Campos e status do TechSales
summary: Campos de cada cadastro (obrigatório, formato, exemplo) e significado de cada status.
article_type: reference
route_pattern:
min_permission:
audience: internal
sort_order: 4
version: 1
is_published: true
---
# Campos e status do TechSales

## Lead

| Campo | Obrigatório | Formato / exemplo |
|---|---|---|
| Nome | Sim | Texto — "Ana" |
| Sobrenome, Cargo, Empresa, Fonte, LinkedIn | Não | Texto |
| Email | Não | E-mail válido, aceita acentos e domínios internacionais — "ana@empresa.com.br" |
| Telefone | Não | Padrão internacional E.164 — "+55 48 99999-0000" |

E-mail e telefone são conferidos contra duplicidade. Status inicial: novo. Etapas e substatus vêm do pipeline.

## Contato

| Campo | Obrigatório | Formato / exemplo |
|---|---|---|
| Nome | Sim | Texto |
| Sobrenome, Cargo, Empresa | Não | Texto |
| Email | Não | E-mail válido |
| Telefone, WhatsApp (celular) | Não | E.164; WhatsApp precisa ser celular válido |

**Etapa do ciclo:** Assinante, Lead, MQL, SQL, Oportunidade, Cliente, Evangelizador, Outro.

## Empresa

| Campo | Obrigatório | Formato / exemplo |
|---|---|---|
| Nome | Sim | Texto |
| Domínio | Não | "empresa.com.br" |
| CNPJ | Não | CNPJ válido — "12.345.678/0001-90" |

## Proposta

| Campo | Obrigatório | Formato |
|---|---|---|
| Título | Sim | Texto |
| Valor | Não | Moeda (BRL) |
| Responsável, Validade | Não | Membro / data |

**Status:** Rascunho, Em revisão, Aprovada, Enviada, Aceita, Recusada, Expirada, Cancelada.

## Cotação

**Status:** Rascunho, Publicada, Enviada, Aceita, Recusada, Expirada.

## Tarefas, filas e notas

- **Fila:** Nome obrigatório (até 120); Descrição opcional (até 500).
- **Nota:** Conteúdo obrigatório (texto formatado); Assunto opcional.
- **Comunicação:** Tipo obrigatório (ligação, e-mail, reunião); Assunto, Conteúdo, Resultado, Local, URL da gravação opcionais.
- **Reunião:** Título de 1 a 255 caracteres.

## Tickets e macros

- **Ticket:** Assunto obrigatório; Descrição, Status, Prioridade, Responsável, Fonte, Vencimento, Contato, Empresa e Negócio opcionais.
- **Macro:** Nome e Corpo obrigatórios; Atalho, Categoria e Ativa opcionais.

## Campanhas

- **E-mail:** Nome, Assunto e Lista obrigatórios; 1–600 envios/min; proteção de envio recente 0–365 dias. Status: rascunho, agendada, em execução, pausada, concluída, cancelada, falhou.
- **WhatsApp:** público até 5.000; distribuição automática, membro específico, rodízio ou desatribuída; texto até 4.096 caracteres; mídia até 16 MB.

## Sequências de prospecção

Nome até 120 caracteres; expediente HH:mm; intervalo por conta 1–3.600 s; limite por conta em 24 h 1–1.000; evidência de autorização com no mínimo 10 caracteres.

## Agendamento

Título 1–160; slug 2–80; duração 5–480 min; buffers 0–240 min; antecedência mínima 0–720 h e máxima 1–365 dias.

## Faturas

Descrição, Valor (BRL) e Vencimento. **Status:** Rascunho, Em aberto, Paga, Vencida, Cancelada, Reembolsada.

## Relacionados

- [Erros comuns](/ajuda/crm/erros-comuns)
- [Permissões do TechSales](/ajuda/crm/permissoes)
