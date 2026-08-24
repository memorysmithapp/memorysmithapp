---
title: EV-2-g3-006 · Reservas de equipamentos
aliases: [EV-2-g3-006]
tags: [evidence, tools, reservations, booking, recurrence, planning]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/tools/reservations.rst · Manage reservations"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g3-006 · Reservas de equipamentos

> [!quote] source/modules/tools/reservations.rst — "Manage reservations"
> "GLPI includes an equipment reservation tool that allows to select assets in order to reserve them for a time slot. For repetitive reservations, it is possible to declare a reservation as recurrent."
> "By default, an equipment is not reservable!" — torna-se reservável pela aba **Reservation** do formulário do equipamento.

> [!quote] Adicionar uma reserva
> Adicionar por: ir ao objeto a reservar (conforme autorizações do perfil) **ou** **Tools > Reservation**. Clicar na data desejada abre a caixa de reserva. Via aba de reserva do objeto, o hardware já vem definido; via **Tools > Reservation > View all items**, seleciona-se o item.
> Passos: selecionar **user** (se não pré-selecionado), **start date**, a **duração** (pode-se indicar data fim se exceder 1 dia) e um comentário opcional.

> [!quote] Repetição (reserva recorrente)
> **Daily**: selecionar "daily" e a data fim. **Weekly**: "weekly", data fim e os dias da semana. **Monthly**: "monthly", data fim e na lista suspensa: "Each month, same date" ou "Each month, same day of weekly".

> [!quote] Ver, modificar, apagar, desativar
> Equipamento reservado aparece no **planning global de reservas**; há também o planning específico de um equipamento reservável (do qual se pode criar reserva). Ver todas em **Tools > Reservations > View calendar for all items**.
> **Find a free item**: **Tools > Reservation > Find a free item in a specific period**; sem resultado, pode-se estender a busca a todos os tipos de objeto sem todas as localizações.
> Modificar: clicar na reserva; ao modificar uma ocorrência, só ela muda; a série inteira só apagando/recriando ou modificando uma a uma. Apagar: "delete permanently"; "delete all" apaga todas as ocorrências.
> **Disable reservation** (do objeto): **Make unavailable** (desativa a função e as reservas; reativando, as reservas voltam) ou **Prohibit reservations** (desativa e apaga todas as reservas atuais; equipamento não pode mais ser reservado).
> **Administration tab**: lista todos os itens reserváveis com motor de busca e ações em massa; link do nome leva à ficha do equipamento, ícone de agenda leva ao schedule.

## Sustenta
- [[Reservar um equipamento (fluxo)]]
- [[Campos de uma Reserva]]
