---
title: Aba Depuração (Debug)
aliases: [aba Debug, Debug tab, depuração]
tags: [tabs, debug, notificacoes, ui]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-g2-005 · Aba Debug (informações de depuração)|EV-2-g2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

A aba **Debug** aparece apenas quando o modo *Debug* está habilitado nas preferências do usuário, posicionando-se antes da [[Aba Todas as informações (All)]]. Oferece informação técnica para diagnóstico de problemas.

Para um dado objeto (ex.: computador), apresenta uma ou mais tabelas conforme o objeto afetado (informação financeira, reservas...), listando as **notificações que serão disparadas** para aquele objeto, com: evento disparador, destinatário(s), modelo de notificação usado e endereço(s) de e-mail do(s) destinatário(s).

Conecta-se ao [[Fluxo de notificação (event → fila → envio)]] e a [[Notificações (e-mail e canais)]]. Faz parte das [[Abas genéricas dos formulários GLPI]].
