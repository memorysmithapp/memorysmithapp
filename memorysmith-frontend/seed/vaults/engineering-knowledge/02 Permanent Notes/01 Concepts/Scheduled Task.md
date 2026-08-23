---
title: Scheduled Task
aliases:
  - Tarefa Agendada
  - Recurring Task
tags:
  - ai
  - agent
  - automation
  - workflow
type: concept
status: seed
source: Claude 101 — Anthropic Academy
author: Anthropic
created: 2026-07-31
---
> [!abstract]
> Uma **Scheduled Task** é um [[Agentic Workflow|fluxo agêntico]] configurado uma vez e executado por cadência — diária, semanal ou em horário definido — sem disparo manual.

## Conceito

O agendamento resolve o custo escondido do trabalho recorrente: não é o tempo de execução, é o **tempo de iniciação**. Uma triagem de caixa de entrada leva dez minutos; lembrar de fazê-la toda segunda, reunir as fontes e recomeçar o contexto custa mais que isso.

Ao agendar, a rotina deixa de competir pela sua atenção. O trabalho já está feito quando você chega.

## Características

- **Configurada uma vez** — a instrução é escrita no momento do desenho, não a cada execução
- **Reúne o próprio contexto** — busca as fontes a cada execução, sempre atualizadas
- **Tolerante a ausência** — se a máquina ou o app estavam fechados no horário, recupera quando voltam
- **Entrega, não notifica** — produz o entregável, não um lembrete de que você deveria produzi-lo

## Candidatos típicos

| Cadência | Exemplo |
|---|---|
| Diária | Briefing da manhã, triagem de caixa de entrada |
| Semanal | Roll-up de sexta-feira do que foi entregue, revisão de pendências |
| Por evento de calendário | Preparação de contexto antes de uma reunião recorrente |

> [!warning] O teste do agendamento
> Se fazer a tarefa **uma vez agora** satisfaz o pedido, não é tarefa agendada. Uma expressão de tempo no enunciado nem sempre indica cadência: "resuma os e-mails de ontem" é execução única.

## Veja também

- [[Agentic Workflow]]
- [[Claude Cowork]]
- [[Agentic AI]]
- [[Autonomous Operations]]
