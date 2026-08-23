---
title: Modos de notificação (e-mail e navegador)
aliases: [Notification mode, Browser followups]
tags: [notificacao, modo, email, browser, canal]
type: concept
status: confirmed
source:
  - "[[EV-2-f3-001 · Visão geral e funcionamento das notificações|EV-2-f3-001]]"
  - "[[EV-2-f3-002 · Definição de notificação e destinatários|EV-2-f3-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Modos de notificação (e-mail e navegador)

O **modo de notificação** (*Notification mode*) é o método pelo qual a mensagem é entregue. Por padrão o GLPI oferece dois:

- **Email** — depende da [[Campos da configuração de e-mail (follow-ups)]] (servidor SMTP/PHP). Habilitado por "Enable followup via email".
- **Browser** (navegação) — notificações exibidas no navegador. Habilitado por "Browser followups".

Novos modos podem ser adicionados por **plugins** (ver [[Instalação e atualização de plugins (marketplace)]] e [[Sistema de Plugins (Hooks)]]).

Uma mesma [[Definição de notificação (estrutura)]] pode usar templates distintos por modo (um para e-mail, outro para navegador). Ao menos um dos modos precisa estar habilitado para o menu de configuração de notificações aparecer.

## Ver também
- [[Template de notificação (objeto global)]]
