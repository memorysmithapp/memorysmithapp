---
title: EV-2-a1-004 · Interface padrão e interface simplificada
aliases: [EV-2-a1-004]
tags: [evidence, doc, interface, standard, simplified, helpdesk, dashboard]
type: evidence
status: confirmed
source: "SRC-002 · source/first-steps/interfaces.rst · User interfaces (Standard Interface / Simplified Interface)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-a1-004 · Interface padrão e interface simplificada

> [!note] source/first-steps/interfaces.rst
> "The choice of the default interface as well as the visibility of different modules can be configured in the profiles or from the user's preferences."

## Interface padrão (Standard)

> [!quote] source/first-steps/interfaces.rst — Standard Interface
> "This is the main interface of the application. All the modules are available, but there are limits depending on the profile settings."

A página inicial da interface padrão dá uma visão-resumo para acesso rápido a elementos ativos (tickets, notas, planejamento, contratos, etc.). É dividida em **5 visões**:

- ***Dashboard*** — painel customizável.
- ***Personal view*** — tickets abertos, rejeitados, a processar, a aprovar (para os quais o usuário logado é o requerente) ou aqueles em que atua como validador/técnico (aguardando validação, em progresso, a fechar, em espera). Mostra também questões correntes, agenda e notas disponíveis.
- ***Group view*** — mesma informação de tickets/questões da visão pessoal, mas referenciando os grupos aos quais o usuário pertence.
- ***Global view*** — estatísticas de tickets e questões por status e de contratos por data de expiração; últimas adições de objetos; conforme configuração, novos tickets também podem aparecer.
- ***RSS feed*** — conteúdo dos feeds RSS definidos (geridos em "Tools > RSS Feeds").

> [!note]
> Para as visões Personal e Group, só são exibidas tabelas com informação.

> [!warning] Mensagens de segurança no primeiro login pós-instalação
> Duas mensagens podem aparecer: (1) trocar as senhas das contas criadas por padrão; (2) apagar o diretório `glpi/install`. Podem existir outras mensagens relacionadas a segurança ou mudanças de schema no banco. As mensagens permanecem enquanto as operações não forem executadas.

## Interface simplificada (Simplified)

> [!quote] source/first-steps/interfaces.rst — Simplified Interface
> "It is the most restrictive interface of the application and is built for an end-user more than a technician. Therefore, the number of available modules is reduced to a minimum."

Destinada a usuários com permissões muito limitadas, como os perfis nativos *self-service* e *helpdesk*. Na configuração padrão, dessa interface o usuário só pode: criar tickets, acompanhar o processamento de seus tickets, fazer reservas, ver notas ou feeds RSS públicos (ou criar notas/feeds privados) e consultar a FAQ. A página inicial mostra o número de seus tickets por status e os tópicos de FAQ mais populares e recentes.

## Sustenta
- [[Interface Padrão (Standard)]]
- [[Interface Simplificada (Helpdesk-Self-Service)]]
