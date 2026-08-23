---
title: Campos de configuração de SLA/OLA e níveis de escalonamento
aliases: [SLA OLA fields, Escalation level fields]
tags: [dados, sla, ola, escalonamento, campos, calendario]
type: entity
status: confirmed
source:
  - "[[EV-2-f3-009 · Níveis de serviço (SLA-OLA) e escalonamento|EV-2-f3-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos de configuração de SLA/OLA e níveis de escalonamento

Semântica dos dados de um SLA/OLA e de seus níveis (ver [[Níveis de serviço (SLA e OLA) na configuração]]).

## SLA/OLA
| Campo | Significado |
|---|---|
| Tipo de alvo | Tempo máximo até **atribuir técnico** (TTO) ou tempo máximo até **resolução** (TTR). |
| Duração máxima | Valor em dias, horas ou minutos (a unidade define o modo de cálculo). |
| Calendário | Calendário associado; sem calendário assume 7×24; alternativamente usa o calendário do ticket. |

Comportamento: em **dias** → cálculo por dias úteis; em **horas/minutos** → pelo horário de funcionamento. Status **pendente** suspende a contagem (modo *sleep*) e adia o vencimento.

## Nível de escalonamento (escalation level)
| Campo | Significado |
|---|---|
| Delay | Antecedência/atraso em relação à data de expiração para disparar o nível. |
| Critérios de disparo | Condições checadas antes de aplicar o nível (ex.: `Status is New`). Sem critérios, dispara sempre. |
| Ações | Ações automáticas executadas (ex.: atribuir a grupo/nível de suporte, mudar prioridade, enviar lembrete). |

## Ver também
- [[Escalonamento de SLA-OLA (níveis e ações)]]
- [[SLM, SLA e OLA]]
- [[TTO e TTR (indicadores de tempo)]]
