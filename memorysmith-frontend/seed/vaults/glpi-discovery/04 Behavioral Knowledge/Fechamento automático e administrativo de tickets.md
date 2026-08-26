---
title: Fechamento automático e administrativo de tickets
aliases: [Automatic closing, Administrative closing, Fechamento automático]
tags: [tickets, closing, lifecycle, glossary]
type: flow
maturity: evergreen
reviewed: false
source: "[[EV-2-a2-005 · Glossário oficial do GLPI|EV-2-a2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Fechamento automático e administrativo de tickets

Conceitos do glossário oficial ligados ao encerramento de tickets, que complementam o [[Ciclo de vida de um Ticket (máquina de estados)]]:

- **Fechamento administrativo** (*Administrative closing*): modificação do status de um ticket para *closed*, manual ou automaticamente.
- **Fechamento automático** (*Automatic closing*): processo interno do GLPI que fecha tickets não resolvidos após um tempo determinado.

Estados de ticket relacionados (glossário): *Solved* (solução técnica fornecida para um incidente) e *Closed* (solução aprovada pelo emissor do ticket ou fechado automaticamente). O fechamento automático é executado como uma [[Ações Automáticas (CronTask)|ação automática]]. Relaciona-se à [[Gestão de Incidentes e Requisições (processo)]].
