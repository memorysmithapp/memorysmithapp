---
title: EV-2-a1-008 · Buscas salvas (bookmarks), contadores e alertas
aliases: [EV-2-a1-008]
tags: [evidence, doc, saved-searches, bookmarks, alerts, counters, notification]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · source/first-steps/saved-searches.rst · Saved Searches (Display of counters / Configuring alerts)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-a1-008 · Buscas salvas (bookmarks), contadores e alertas

> [!quote] source/first-steps/saved-searches.rst
> "GLPI offers a system for saving searches (bookmarks). Once the search is done, it is possible to save it from a star-shaped button accessible in the search form."

Dois tipos de buscas salvas:
- ***Private*** — "Usable by all users and they are only accessible by their author".
- ***Public*** — só podem ser criadas por usuários autorizados; acessíveis por todos os usuários que pertençam às entidades configuradas.

As buscas salvas são acessadas pelo botão em forma de estrela no menu do usuário (`images/saved_searches.png`). Nessa interface é possível: reordenar buscas privadas (drag & drop) — as públicas usam ordenação automática; selecionar uma busca padrão (só uma por tipo de objeto) clicando no ícone de estrela; acessar os resultados (clicando nela); acessar a interface de gestão das buscas salvas (ícone de chave inglesa no topo direito).

> [!warning]
> "Setting a particularly heavy search as the default display can have catastrophic effects on the overall performance of the application!"

## Exibição de contadores
As configurações do GLPI definem se os contadores são exibidos. Para buscas é mais complexo: buscas pesadas não são contadas por padrão (limitar impacto na performance). Para calcular o tempo de execução de uma busca salva, ela precisa ser executada ao menos uma vez. **Uma tarefa agendada (scheduled task)** também é oferecida para calcular tempos de execução regularmente (evitando requisições que ficariam pesadas com o tempo). Administradores podem sobrepor o método automático de contagem, forçando uma busca a ser sempre ou nunca contada (usar com parcimônia).

## Configuração de alertas
> [!quote]
> "It is possible to configure the sending of 'alerts' on a saved search using the GLPI notification system. Sending a notification is based on the number of results returned by the search, compared with the chosen operator to the entered value." (`images/saved_search_alert.png`)

- Buscas **privadas**: só o usuário que criou a busca pode ser notificado, usando um template padrão; uma única notificação vinculada.
- Buscas **públicas**: é preciso criar um **evento** específico e uma notificação que o use (apenas pela aba de configuração de alertas). Depois, associar a notificação a um template e selecionar destinatários. Pode-se associar várias notificações à mesma busca via o evento correspondente.
> [!note]
> "As long as the notification specific to a public search is not created; it will not be possible to add alerts." (`images/saved_search_nonotif.png`)

## Sustenta
- [[Buscas Salvas (Bookmarks)]]
- [[Configuração de Alertas em Buscas Salvas]]
