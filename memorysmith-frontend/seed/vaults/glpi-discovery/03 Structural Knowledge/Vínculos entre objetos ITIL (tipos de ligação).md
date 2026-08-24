---
title: Vínculos entre objetos ITIL (tipos de ligação)
aliases: [Links ITIL, Linked To, Duplicates, Son of, Parent of]
tags: [itil, links, vinculos, ticket, problem, change]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-b2-001 · Gestão de mudanças — formulário, abas e fluxo|EV-2-b2-001]]"
  - "[[EV-2-b2-002 · Gestão de problemas — formulário e abas|EV-2-b2-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Vínculos entre objetos ITIL (tipos de ligação)

Os objetos de help desk ([[Ticket]], [[Problem]], [[Change]]) podem ser **ligados entre si**
pelas abas *Tickets*, *Problems* e *Changes*. A documentação descreve quatro **tipos de
ligação**, mantidos *"for information purposes only"* (não disparam automação):

- **Linked To** — relação genérica entre dois objetos.
- **Duplicates** — o objeto duplica outro.
- **Son of** / **Parent of** — hierarquia pai/filho entre objetos.

Nas abas de vínculo **não** se cria um novo objeto: apenas se **vincula um já existente**.
Para **desfazer** um vínculo usa-se *massive actions → Unlink ITIL Object*.

> [!note] Complemento à visão de tickets
> Amplia a nota [[Vínculos entre tickets]] (E2/b1) para os três tipos de objeto ITIL.
> A semântica exata de *Son of*/*Parent of* é marcada como não documentada em
> [[INV-2-b1-001 · Vínculos Son of e Parent of entre tickets não documentados]].

Base estrutural: [[CommonITILObject (base de service desk)]].
