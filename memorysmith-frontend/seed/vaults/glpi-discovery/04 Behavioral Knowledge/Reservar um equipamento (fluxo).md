---
title: Reservar um equipamento (fluxo)
aliases: [Reservation flow, Reservar equipamento, Booking]
tags: [behavioral, reservations, booking, recurrence, planning]
type: flow
status: confirmed
source: "[[EV-2-g3-006 · Reservas de equipamentos|EV-2-g3-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Reservar um equipamento (fluxo)

A ferramenta de reservas (**Tools > Reservation**) permite selecionar ativos e reservá-los por um período; reservas repetitivas podem ser **recorrentes**. É a visão de usuário dos processos [[Reserva de Ativos e Documentos (processos)]] / [[Reservas e Consumíveis]].

> [!warning] Pré-requisito
> Por padrão um equipamento **não é reservável**. Torná-lo reservável é feito pela aba **Reservation** do formulário do equipamento.

## Adicionar uma reserva
1. Ir ao objeto a reservar (conforme perfil) **ou** **Tools > Reservation** (via *View all items*, selecionar o item).
2. Clicar na data desejada (abre a caixa de reserva).
3. Selecionar **user**, **start date**, a **duração** (data fim se > 1 dia) e comentário opcional.

## Repetição (recorrência)
- **Daily**: "daily" + data fim.
- **Weekly**: "weekly" + data fim + dias da semana.
- **Monthly**: "monthly" + data fim + "Each month, same date" ou "Each month, same day of weekly".

## Consultar, modificar, apagar, desativar
- **Planning global** de reservas e planning específico de cada equipamento reservável (do qual se pode criar reserva). Ver todas em *View calendar for all items*.
- **Find a free item**: busca por período; sem resultado, estender a todos os tipos sem todas as localizações.
- **Modificar**: clicar na reserva; uma ocorrência muda só ela; a série inteira só apagando/recriando ou item a item.
- **Apagar**: *delete permanently*; *delete all* apaga todas as ocorrências.
- **Desativar** (do objeto): **Make unavailable** (desativa; reativando, reservas voltam) ou **Prohibit reservations** (desativa e apaga as reservas atuais).
- **Administration tab**: lista itens reserváveis com busca e ações em massa.

Campos em [[Campos de uma Reserva]].

## Ver também
- [[Reserva de Ativos e Documentos (processos)]] · [[Reservas e Consumíveis]] · [[Relatórios gerenciais (tipos e conteúdo)]]
