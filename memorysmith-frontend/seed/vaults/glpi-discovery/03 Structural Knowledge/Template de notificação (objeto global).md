---
title: Template de notificação (objeto global)
aliases: [Notification template]
tags: [template, notificacao, global, traducao, css]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-005 · Templates de notificação (objeto, tabs, tags)|EV-2-f3-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Template de notificação (objeto global)

Um **template** é um **objeto global** do GLPI que define o conteúdo e a formatação de uma notificação. Não está ligado a nenhuma entidade — logo, sua gestão **não** pode ser delegada a administradores de subentidades (diferente das definições de notificação, que existem por entidade).

Por ser operação complexa que impacta usuários, só pode ser modificado por administradores com permissão *Update* no direito *Config*.

Um template pode existir em **várias línguas** via mecanismo de tradução. As [[Sintaxe de tags de template de notificação]] (marcadores independentes da língua) permitem uma tradução genérica válida para todas as línguas. Uma **Default translation** cobre as línguas sem tradução própria.

O GLPI vem com templates pré-definidos para todas as notificações (tickets, reservas, informações financeiras, cartuchos, consumíveis, licenças, sincronização MySQL...).

Estrutura (ver [[Campos do template de notificação]]): aba **Notification template** (Name, Type, Comments, CSS) e aba **Template translation** (Language, Subject, Email text body, Email HTML body).

## Ver também
- [[Criação de um template de notificação (passo a passo)]]
- [[Templates de tickets]]
