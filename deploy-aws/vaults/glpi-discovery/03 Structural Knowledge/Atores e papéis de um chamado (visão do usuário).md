---
title: Atores e papéis de um chamado (visão do usuário)
aliases: [Requerente, Técnico, Observador, Watcher, Requester, Actors do ticket]
tags: [assistance, actors, roles, requester, technician, watcher, supplier]
type: actor
maturity: evergreen
reviewed: false
source: "[[EV-2-b1-010 · Atores e papéis de um chamado|EV-2-b1-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Atores e papéis de um chamado (visão do usuário)

Um serviço de assistência define três papéis principais num chamado:

- **Requerente (Requester)**: usuário ou grupo conhecido pelo GLPI e afetado pelo ticket.
- **Técnico (Technician)**: quem processa o ticket — pode ser um técnico, um **grupo** ou um **fornecedor (supplier)**.
- **Observador (Watcher)**: acompanha o ticket sem poder modificá-lo, pela interface ou por notificações.

As informações visíveis e as ações possíveis dependem do **papel definido no perfil**: técnicos têm a visão mais completa e as ações mais amplas; requerente e observador veem apenas o necessário.

> [!note] Múltiplos atores e desconhecidos
> Na criação, só o **primeiro** usuário/grupo de cada papel é definido; os demais são adicionados depois. Um usuário que pode ver mas não modificar atores pode tornar-se observador. Ao associar um ator, o GLPI mostra quantos tickets ele tem — útil para repartir a carga. Para usuários **desconhecidos** do GLPI, um endereço de e-mail pode ser associado como requerente/observador, desde que as notificações estejam ativadas.

A atribuição de papel é feita na gestão de autorizações do usuário (perfil).

## Ver também (código)
- [[Modelo de Atores ITIL]] · [[Ticket]] · [[Fornecedores e Contatos]] · [[Usuários e Grupos]]
