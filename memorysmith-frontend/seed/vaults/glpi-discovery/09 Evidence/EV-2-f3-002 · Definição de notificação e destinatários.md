---
title: EV-2-f3-002 · Definição de notificação e destinatários
aliases: [EV-2-f3-002]
tags: [evidence, notificacao, definicao, destinatarios, recipients]
type: evidence
status: confirmed
source: "SRC-002 · modules/configuration/notifications/definitions.rst · Notification Definitions"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f3-002 · Definição de notificação e destinatários

> [!quote] definitions.rst · "Notification Definitions"
> Uma definição de notificação no GLPI é composta de: (1) um ou mais **templates de notificação** — templates são adicionados por modo de notificação, permitindo usar um template para e-mail e outro para navegador; (2) um conjunto de **destinatários** — pode incluir usuários/grupos específicos ou destinatários dinâmicos como "Requester" (substituído por todos os requerentes do ticket); (3) um **tipo de item** (ex.: Ticket); (4) um **evento** do tipo de item (ex.: Add).

> [!quote] Abas do formulário de definição
> - **Notification**: campos **Name**, **Active** (desativa temporariamente), **Type** (tipo de objeto GLPI), **Notification mode** (Email e Browser por padrão), **Event** (evento disparador conforme o tipo).
> - **Notification templates**: indica a notificação que será enviada para o tipo/evento definidos.
> - **Recipients**: define quem recebe a notificação; a lista de atores varia conforme o tipo de objeto.

> [!quote] Lista (não exaustiva) de destinatários
> **Administrator** (e-mail definido na config global de follow-ups), **Entity Administrator** (por entidade), **Requester**, **Technician in charge of the ticket**, **Group XXX** (e "without supervisor"), **Group in charge of the ticket** (e "without supervisor"), **Requesting group**, **Observer group**, **Observer**, **Profile XXX** (usuários com acesso na entidade e este perfil), **Writer** (quem insere a informação), **Technical manager** (responsável pelos ativos relacionados ao ticket).

## Sustenta
- [[Definição de notificação (estrutura)]]
- [[Destinatários de notificação (recipients)]]
- [[Campos da definição de notificação]]
- [[Modos de notificação (e-mail e navegador)]]
