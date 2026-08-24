---
title: EV-2-f3-006 · Exemplo de criação de template de ticket
aliases: [EV-2-f3-006]
tags: [evidence, template, exemplo, ticket, timeline, traducao]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/notifications/template_example.rst · Template example"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f3-006 · Exemplo de criação de template de ticket

> [!quote] template_example.rst · "Template example"
> Exemplo passo a passo de criação de um template para notificações de e-mail de ticket, reutilizável em vários eventos (New ticket, Add followup, Add task, Resolve ticket...). Há uma captura de tela do resultado final em `images/final_result.png`.

> [!quote] Criação e dados básicos
> 1. **Setup > Notifications > Notification templates** > **Add**. Preencher Name (ex.: "Generic tickets with timeline"), Type (Ticket), Comments, CSS (vazio por ora). Salvar redireciona para a tradução.
> 2. Na edição da tradução: Language = **Default translation**; Subject = ``##ticket.action##: ##ticket.title##`` (o "[GLPI <número>]" é adicionado automaticamente ao assunto); Email text body vazio (preenchido automaticamente); Email HTML body é o campo principalmente editado.

> [!quote] Tags usadas
> ``##ticket.action##`` (ação que disparou), ``##ticket.title##``, ``##lang.ticket.status##`` (rótulo traduzido) / ``##ticket.status##``, ``##lang.ticket.url##`` / ``##ticket.url##``, ``##lang.ticket.description##``, ``##ticket.authors##`` (requerentes, separados por vírgula), ``##ticket.creationdate##``, ``##ticket.description##``.
> Para eventos de followup/task/solução, itera-se pela timeline: ``##FOREACHtimelineitems##`` ... ``##ENDFOREACHtimelineitems##`` com ``##timelineitems.author##``, ``##timelineitems.date##``, ``##timelineitems.description##``.

> [!quote] Layout e recursos do editor
> Formatação via editor WYSIWYG: negrito, link clicável (right-click > Link), cabeçalhos (Headings 1), logo (Insert image), tabela (Insert table), cores de fundo/texto, emoticon condicional (ex.: ``##IFticket.storestatus=4##⏸##ENDIFticket.storestatus##`` exibe emoji de pausa se status pendente=4). Edição direta via right-click > **Source code** (HTML).

> [!quote] Traduções
> Com tags ``##lang....##`` a tradução default pode bastar. Para texto fixo por língua, adiciona-se uma nova tradução por idioma (English/Français/Español), copiando o Source code e substituindo o texto fixo. Repetir para cada língua útil.

> [!quote] Going further — HTML/CSS
> O `.rst` traz um exemplo completo de código HTML no campo "Email HTML body" (tabela header com logo em base64, títulos, loop `FOREACH LAST 5 timelineitems` com classes por tipo `ITILFollowup`/`TicketTask`/`ITILSolution`, bloco `request`) e o CSS correspondente (classes `.header`, `.title`, `.attributes`, `.timeline`, `.request` etc.).

## Sustenta
- [[Criação de um template de notificação (passo a passo)]]
- [[Sintaxe de tags de template de notificação]]
