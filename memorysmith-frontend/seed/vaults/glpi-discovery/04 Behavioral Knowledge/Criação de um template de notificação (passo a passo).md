---
title: Criação de um template de notificação (passo a passo)
aliases: [Template example, Criar template de notificação]
tags: [template, notificacao, procedimento, ticket, timeline, traducao]
type: use-case
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-006 · Exemplo de criação de template de ticket|EV-2-f3-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Criação de um template de notificação (passo a passo)

Procedimento (exemplo do doc): criar um template de e-mail de ticket reutilizável em vários eventos (New ticket, Add followup, Add task, Resolve ticket...).

1. **Setup > Notifications > Notification templates > Add**. Preencher Name (ex.: "Generic tickets with timeline"), Type = Ticket, Comments, CSS (vazio por ora). Salvar redireciona para a tradução.
2. Na **tradução**: Language = **Default translation**; Subject = ``##ticket.action##: ##ticket.title##`` (o "[GLPI <número>]" é adicionado automaticamente). Deixar Email text body vazio (auto). Editar principalmente o **Email HTML body**.
3. **Caso New ticket**: inserir tags básicas (action, title, status, url, description, authors, creationdate). Botão "Show list of available tags" lista as disponíveis.
4. **Casos Add followup/task/Resolve**: iterar a timeline com ``##FOREACHtimelineitems##`` ... ``##ENDFOREACHtimelineitems##`` usando ``##timelineitems.author/date/description##``. Ver [[Fluxo de followups, tarefas e solução]].
5. **Layout**: no editor WYSIWYG aplicar negrito, link clicável, cabeçalhos, logo (imagem), tabela, cores e **emoticon condicional** (ex.: ``##IFticket.storestatus=4##⏸##ENDIFticket.storestatus##`` exibe emoji se pendente).
6. **Traduções**: manter tags ``##lang....##`` para rótulos auto-traduzidos; para texto fixo por idioma, adicionar uma tradução por língua (English/Français/Español) copiando o *Source code* e trocando o texto fixo.
7. **HTML/CSS avançado**: editar direto via right-click > **Source code**; separar CSS (campo CSS do template) do HTML (campo Email HTML body).

Depende da [[Sintaxe de tags de template de notificação]] e produz um [[Template de notificação (objeto global)]].

## Ver também
- [[Templates de tickets]]
