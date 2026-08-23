---
title: Abertura de um chamado (fluxo)
aliases: [Abertura de ticket, Opening a ticket]
tags: [assistance, ticket, opening, flow, helpdesk, mail]
type: flow
status: confirmed
source:
  - "[[EV-2-b1-002 · Ferramentas e interfaces de abertura de chamado|EV-2-b1-002]]"
  - "[[EV-2-b1-003 · Campos específicos da abertura na interface simplificada|EV-2-b1-003]]"
  - "[[EV-2-b1-004 · Abertura padrão, por e-mail e automática|EV-2-b1-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Abertura de um chamado (fluxo)

Um requerente pode formular uma necessidade por vários canais:

1. **Formulário online** — conhecido ou não pelo GLPI (ver [[Interfaces de abertura de chamado]]).
2. **Delegação** — um delegado do grupo abre o ticket em nome de outro. Na interface simplificada, uma opção indica se o ticket é do próprio usuário ou de outro; na padrão, o mecanismo fica ativo enquanto a autorização **See all tickets** estiver *No*.
3. **Operador** — contato direto ou por telefone; o operador abre o ticket.
4. **E-mail** — a demanda é enviada por e-mail (ver [[Collectors de e-mail no Assistance]]).

## Passo a passo (interface gráfica)
- Preencher os campos (ver [[Campos do formulário de Ticket]]); com [[Templates de tickets|templates]], alguns podem ser obrigatórios/predefinidos/mascarados.
- Anexar documentos numa única operação. Com **Use rich text for assistance**, a descrição aceita HTML e drag-and-drop de imagens.
- Na interface **simplificada** há campos próprios (ver [[Campos específicos da abertura simplificada]]).
- Na interface **padrão** é possível pedir validação já na abertura, indicando o validador.
- Uma mensagem confirma a criação; o número do ticket aparece em verde.

> [!warning] Ordem de anexos
> Anexar imagens/documentos **somente após** preencher todos os campos obrigatórios: o recarregamento do formulário por campo faltante apaga os anexos.

## Abertura por e-mail
Ao receber a mensagem: objeto → **título**, corpo → **descrição**, `Cc:` → **observadores** (se conhecidos), anexos → **documentos**.

## Abertura automática
Feita via [[Tickets recorrentes (fluxo)|tickets recorrentes]].

## Ver também (código)
- [[Ciclo de vida de um Ticket (máquina de estados)]] · [[Gestão de Incidentes e Requisições (processo)]] · [[Coletor de E-mail (MailCollector)]]
