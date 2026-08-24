---
title: Reserva de Ativos e Documentos (processos)
aliases: [Reserva de ativos, Gestão de documentos, "Reserva de Ativos (processo)", "Gestão de Documentos (processo)"]
tags: [process, reserva, documento, dominio/gestao]
type: process
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-027 · Reservation e Consumíveis-Cartuchos|EV-1-027]]"
  - "[[EV-1-025 · Document com dedup sha1 e Document_Item polimórfico|EV-1-025]]"
author: CAD Discovery
created: 2026-07-10
---

# Reserva de Ativos e Documentos (processos)

## Reserva de ativos
Permite disponibilizar ativos para **empréstimo/agendamento**. Um item marcado como
reservável ([[Reservas e Consumíveis]]) pode ser reservado por período via a interface
(inclusive helpdesk), com calendário de disponibilidade. Suporta o *Demand Management* do ITIL
(uso eficiente de recursos compartilhados: notebooks, salas, projetores).

## Gestão de documentos
Processo transversal de anexos ([[Documentos (Document)]]): upload com validação de tipo
(`DocumentType`), deduplicação por hash, associação a qualquer item e reuso via tags em
campos rich-text. Sustenta a