---
title: Interface Simplificada (Helpdesk-Self-Service)
aliases: [Simplified Interface, Interface simplificada, Self-service, Helpdesk interface, "Interface Simplificada (Helpdesk/Self-Service)"]
tags: [component, interface, simplified, helpdesk, self-service, end-user]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-004 · Interface padrão e interface simplificada|EV-2-a1-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Interface Simplificada (Helpdesk/Self-Service)

A **interface simplificada** é a mais restritiva da aplicação, construída para o **usuário final** mais do que para o técnico. O número de módulos disponíveis é reduzido ao mínimo. Destina-se a usuários com permissões muito limitadas, como os perfis nativos *self-service* e *helpdesk*.

Na configuração padrão, dessa interface o usuário só pode:
- criar tickets e acompanhar o processamento de seus tickets;
- fazer reservas;
- ver notas ou feeds RSS públicos (ou criar notas/feeds privados);
- consultar a FAQ (Frequently Asked Questions).

A **página inicial** mostra o número de seus tickets por status e os tópicos de FAQ mais populares e recentes.

> [!note]
> A escolha da interface padrão e a visibilidade dos módulos são configuráveis nos perfis ou nas preferências do usuário. Contrasta com a [[Interface Padrão (Standard)]].

## Relações
- Alternativa a: [[Interface Padrão (Standard)]].
- Condicionada por: [[Administração de Controles de Acesso (processo)]].
- Ponte de código: [[Ticket]], [[Base de Conhecimento (KnowbaseItem)]], [[Perfis e Direitos (RBAC)]], [[Reservas e Consumíveis]].
