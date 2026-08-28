---
title: EV-2-b1-010 · Atores e papéis de um chamado
aliases: [EV-2-b1-010]
tags: [evidence, assistance, actors, requester, technician, watcher, roles]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/assistance/actors.rst · Defining actors and roles"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b1-010 · Atores e papéis de um chamado

> [!quote] actors.rst — "Defining actors and roles"
> Um serviço de assistência geralmente define os papéis:
> - **Requester** (requerente): usuário ou grupo de usuários conhecido pelo GLPI e afetado pelo ticket;
> - **Technician** (técnico): o processamento é feito por um técnico, um grupo ou um **fornecedor** (supplier);
> - **Watcher** (observador): usuário que pode acompanhar um ticket sem modificá-lo; o acompanhamento é feito pela interface ou por notificações.
> As informações visíveis e as ações possíveis são definidas pelo GLPI segundo o papel (perfil do usuário): técnicos têm a informação mais completa e as ações mais amplas; requerente e observador veem apenas o necessário.

> [!quote] actors.rst — múltiplos atores
> Para múltiplos usuários ou grupos, apenas o primeiro usuário/grupo é definido na criação; mais atores são adicionados depois. Um usuário que não pode modificar atores mas pode ver o ticket pode se tornar observador. Ao associar um novo ator, é visível a quantidade de tickets atribuídos a ele (facilita repartir tarefas entre técnicos).

> [!note] actors.rst — notas
> - Para usuários desconhecidos do GLPI, um endereço de e-mail pode ser associado ao ticket; a escolha padrão de requerente e observador (nenhum usuário selecionado) permite adicionar um e-mail nesses campos, desde que as notificações estejam ativadas.
> - A atribuição de papel é feita na gestão de autorizações do usuário.

## Sustenta
- [[Atores e papéis de um chamado (visão do usuário)]]
