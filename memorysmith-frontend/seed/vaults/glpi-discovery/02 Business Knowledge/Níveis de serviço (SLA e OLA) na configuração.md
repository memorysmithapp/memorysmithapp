---
title: Níveis de serviço (SLA e OLA) na configuração
aliases: [Service Levels, SLA e OLA (config)]
tags: [sla, ola, service-level, regra, config]
type: capability
status: confirmed
source:
  - "[[EV-2-f3-009 · Níveis de serviço (SLA-OLA) e escalonamento|EV-2-f3-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Níveis de serviço (SLA e OLA) na configuração

O GLPI rastreia dois tipos de acordo de nível de serviço:

- **SLA** (*Service Level Agreement*): acordo entre o provedor de TI e o **cliente**.
- **OLA** (*Operation Level Agreement*): acordo entre **grupos/departamentos** internos do provedor.

Ambos podem, opcionalmente, rastrear dois marcos de tempo em um ticket: o tempo máximo até **atribuir um técnico** (TTO) e o tempo máximo até a **resolução** (TTR).

Um **calendário** pode ser associado (ver dropdown de calendários). Sem calendário, os cálculos assumem 7×24; alternativamente usa-se o calendário do ticket (da entidade). Tempo em **dias** → cálculo por dias úteis; em **horas/minutos** → cálculo pelo horário de funcionamento. Colocar o ticket em **pendente** suspende o SLA (modo *sleep*), adiando o vencimento pelo tempo pendente.

A atribuição pode ser automática via [[Motor de Regras de Negócio (capacidade)]] (regras de negócio de ticket), com vários SLA/OLAs selecionados por critérios. Atribuição **manual** (usuário ou template) não pode ser sobrescrita pelas regras. Ao ser atribuído, o SLA/OLA é *replayed* e as ações dos [[Escalonamento de SLA-OLA (níveis e ações)]] são executadas.

Esta é a visão de configuração da regra descrita no código em [[SLA e níveis de serviço (regra)]] e da estrutura [[SLM, SLA e OLA]]. A avaliação periódica dos níveis roda pelas ações automáticas `slaticket` e `olaticket` (ver [[Catálogo de ações automáticas (crontasks)]]).

## Ver também
- [[TTO e TTR (indicadores de tempo)]]
- [[Priorização (urgência × impacto)]]
