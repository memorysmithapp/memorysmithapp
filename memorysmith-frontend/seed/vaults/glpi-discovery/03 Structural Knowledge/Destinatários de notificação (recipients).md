---
title: Destinatários de notificação (recipients)
aliases: [Recipients, Notification recipients]
tags: [notificacao, destinatarios, recipients, atores]
type: concept
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-002 · Definição de notificação e destinatários|EV-2-f3-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Destinatários de notificação (recipients)

Os **destinatários** (aba *Recipients* da [[Definição de notificação (estrutura)]]) definem quem recebe a notificação. Podem ser fixos (usuários/grupos específicos) ou **dinâmicos** — resolvidos no momento do envio a partir do objeto que disparou o evento. A lista de atores propostos **varia conforme o tipo de objeto**.

Lista (não exaustiva) de destinatários dinâmicos para tickets:

- **Administrator** — e-mail definido na config global de follow-ups.
- **Entity Administrator** — e-mail definido por entidade.
- **Requester** — requerente do ticket.
- **Technician in charge of the ticket** — técnicos atribuídos.
- **Group XXX** / **Group XXX without supervisor** — membros do grupo (o segundo exclui o Manager do grupo).
- **Group in charge of the ticket** / **...without supervisor** — grupo atribuído ao ticket.
- **Requesting group** / **Observer group** — grupos requerente / observador.
- **Observer** — observador do ticket.
- **Profile XXX** — usuários com acesso na entidade e este perfil.
- **Writer** — quem insere a informação.
- **Technical manager** — responsável pelos ativos relacionados ao ticket.

Estes atores refletem o [[Modelo de Atores ITIL]] e o [[Atores e papéis de um chamado (visão do usuário)]].

## Ver também
- [[Perfis e Direitos (RBAC)]]
- [[Usuários e Grupos]]
