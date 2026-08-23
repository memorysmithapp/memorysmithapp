---
title: Campos de uma Reserva
aliases: [Reservation fields, Campos de reserva, Booking fields]
tags: [data, reservations, fields, recurrence]
type: entity
status: confirmed
source: "[[EV-2-g3-006 · Reservas de equipamentos|EV-2-g3-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos de uma Reserva

Atributos preenchidos ao criar uma [[Reservar um equipamento (fluxo)|reserva]]:

| Campo | Descrição |
|---|---|
| Item / hardware | Equipamento reservado (pré-definido se via aba do objeto; senão selecionado) |
| User | Usuário para quem se reserva |
| Start date | Data/hora de início |
| Duração / End date | Duração; data fim se exceder 1 dia |
| Comment | Comentário opcional |
| Repetition | none / daily / weekly / monthly |
| End date (repetição) | Data fim da recorrência (reserva incluída no último dia) |
| Dias da semana | (weekly) dias em que a reserva ocorre |
| Regra mensal | (monthly) "same date" ou "same day of weekly" |

## Ver também
- [[Reservar um equipamento (fluxo)]] · [[Reservas e Consumíveis]]
