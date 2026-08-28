---
title: Definição de notificação (estrutura)
aliases: [Notification Definition]
tags: [notificacao, definicao, estrutura, evento]
type: concept
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-002 · Definição de notificação e destinatários|EV-2-f3-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Definição de notificação (estrutura)

Uma **definição de notificação** é a configuração que amarra um evento a uma comunicação. É composta de quatro elementos:

1. Um **tipo de item** (ex.: Ticket).
2. Um **evento** desse tipo (ex.: Add / criação).
3. Um ou mais **templates de notificação**, adicionados por modo — permite um [[Template de notificação (objeto global)]] para e-mail e outro para navegador.
4. Um conjunto de [[Destinatários de notificação (recipients)]].

Ao contrário dos templates (que são globais), as definições de notificação podem existir por entidade (a busca de notificações sobe pelas entidades pai — ver [[Fluxo de notificação por e-mail (visão do usuário)]]).

O formulário tem três abas: **Notification** (dados gerais — ver [[Campos da definição de notificação]]), **Notification templates** (qual template usar por tipo/evento) e **Recipients** (quem recebe). Os [[Modos de notificação (e-mail e navegador)]] disponíveis por padrão são Email e Browser.

## Ver também
- [[Notificações no GLPI (visão de configuração)]]
- [[Notificações (e-mail e canais)]]
