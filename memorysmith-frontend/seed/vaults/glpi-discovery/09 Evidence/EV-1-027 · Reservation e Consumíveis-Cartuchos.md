---
title: EV-1-027 · Reservation e consumíveis/cartuchos
aliases: [EV-1-027]
tags: [evidence, dominio/gestao, reserva, consumivel]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Reservation.php L45 · src/ReservationItem.php L44 · src/Consumable.php L50 · src/Cartridge.php L47"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-027 · Reservation e consumíveis/cartuchos

> [!quote] classes (grep confirmado)
> ```php
> class ReservationItem extends CommonDBChild { ... }  // marca um item como "reservável"
> class Reservation extends CommonDBChild { ... }      // uma reserva (período) sobre o item
> class Consumable extends CommonDBChild { ... }       // unidade de consumível (estoque)
> class Cartridge extends CommonDBRelation { ... }     // cartucho ligado a impressora
> ```

- **Reserva de ativos**: um ativo torna-se **reservável** ao ganhar um `ReservationItem`;
  cada `Reservation` registra um período (início/fim) por usuário — apoia o processo de
  Demand Management (empréstimo de equipamentos).
- **Consumíveis** (`Consumable`/`ConsumableItem`) e **cartuchos** (`Cartridge`/`CartridgeItem`)
  gerenciam **estoque**: entradas, saídas/consumo, alertas de estoque baixo, vínculo a
  impressoras (cartuchos).

## Sustenta
- [[Reservas (Reservation)]]
- [[Consumíveis e Cartuchos]]
- [[Reserva de Ativos (processo)]]
