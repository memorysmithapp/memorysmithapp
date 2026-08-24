---
title: EV-2-b1-004 · Abertura padrão, por e-mail e automática
aliases: [EV-2-b1-004]
tags: [evidence, assistance, ticket, opening, standard-interface, mail, collector]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/assistance/tickets/ticketopening.rst · Standard interface / Open a ticket by mail / Open a ticket automatically"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b1-004 · Abertura padrão, por e-mail e automática

> [!quote] ticketopening.rst — "Standard interface"
> Para criar um ticket, ir ao menu **Assistance > Ticket** e clicar no botão de adição com o ícone "+". Ao adicionar uma nova imagem pela aba *Documents* do ticket, a tag gerada também pode ser usada para inserir a imagem na descrição. Uma mensagem confirma a criação, acessível pelo número em verde. Uma **demanda de validação** também pode ser feita na abertura, indicando o usuário validador desejado.

> [!note] ticketopening.rst — contadores
> Ao preencher requerente atribuído, técnico ou grupo, é exibida a quantidade de tickets que essa pessoa/grupo abriu ou está encarregada. Da mesma forma, ao selecionar um item, é exibida uma visão simplificada dos tickets atuais desse item.

> [!quote] ticketopening.rst — "Open a ticket by mail"
> Abrir por e-mail é feito enviando mensagem a um endereço definido no coletor. Na recepção, um ticket é aberto automaticamente:
> - o **objeto** da mensagem vira o **título** do ticket;
> - o **corpo** vira a **descrição**;
> - os endereços em **Cc:** viram **observadores** se conhecidos pelo GLPI;
> - os **anexos** viram documentos anexados ao ticket.
> Com **Use rich text for assistance** ativa, as imagens no corpo da mensagem ficam visíveis na descrição.

> [!quote] ticketopening.rst — "Open a ticket automatically"
> Este mecanismo é ativado por meio de **Recurrent tickets**.

## Sustenta
- [[Abertura de um chamado (fluxo)]]
- [[Interfaces de abertura de chamado]]
- [[Collectors de e-mail no Assistance]]
- [[Tickets recorrentes (fluxo)]]
