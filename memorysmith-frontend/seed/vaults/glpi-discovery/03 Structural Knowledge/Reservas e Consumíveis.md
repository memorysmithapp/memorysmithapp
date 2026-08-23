---
title: Reservas e Consumíveis
aliases: [Reservation, Consumable, Cartridge, Reservas, Consumíveis, "Reservas (Reservation)", "Consumíveis e Cartuchos"]
tags: [concept, reserva, consumivel, dominio/gestao]
type: concept
status: confirmed
source: "[[EV-1-027 · Reservation e Consumíveis-Cartuchos|EV-1-027]]"
author: CAD Discovery
created: 2026-07-10
---

# Reservas e Consumíveis

## Reservas
Um ativo torna-se **reservável** ao receber um `ReservationItem`. Cada `Reservation` registra
um **período** (início/fim) e o usuário — apoiando empréstimo/agendamento de equipamentos
(ITIL Demand Management). Ver [[Reserva de Ativos (processo)]].

## Consumíveis e Cartuchos (estoque)
- **ConsumableItem / Consumable** — item de consumo com **estoque**: entradas e saídas
  (consumo), alerta de estoque baixo, custo unitário.
- **CartridgeItem / Cartridge** — cartuchos/toners, vinculáveis a modelos de impressora e à
  impressora que os consome (contador de páginas/uso).

Gerenciam 