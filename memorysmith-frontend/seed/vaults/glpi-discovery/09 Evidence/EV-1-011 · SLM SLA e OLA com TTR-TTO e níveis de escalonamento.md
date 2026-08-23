---
title: EV-1-011 · SLM, SLA e OLA com TTR/TTO e níveis de escalonamento
aliases: [EV-1-011]
tags: [evidence, dominio/service-desk, sla]
type: evidence
status: confirmed
source: "SRC-001 · src/SLM.php L42,51–52 · src/LevelAgreement.php L45 · src/SLA.php L44 · src/OLA.php L40 · src/SlaLevel.php · src/OlaLevel.php"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-011 · SLM, SLA e OLA com TTR/TTO e níveis de escalonamento

> [!quote] hierarquia de classes (grep confirmado)
> ```php
> class SLM extends CommonDBTM {            // Service Level (contêiner)
>     public const TTR = 0; // Time To Resolve
>     public const TTO = 1; // Time To Own
> }
> abstract class LevelAgreement extends CommonDBChild { ... }
> class SLA extends LevelAgreement { ... }  // acordo com o cliente
> class OLA extends LevelAgreement { ... }  // acordo interno/operacional
> class SlaLevel extends LevelAgreementLevel { ... }  // níveis de escalonamento
> class OlaLevel extends LevelAgreementLevel { ... }
> ```

O GLPI modela **SLM** (Service Level Management) como contêiner que agrupa **SLA** (acordo
com o cliente) e **OLA** (acordo operacional interno). Cada acordo é de tipo **TTR** (tempo
para resolver) ou **TTO** (tempo para atribuir/assumir). `SlaLevel`/`OlaLevel` definem
**níveis de escalonamento**: ações disparadas quando o prazo se aproxima ou é violado
(usando o [[Calendário de trabalho e feriados]] para cálculo em horas úteis).

## Sustenta
- [[SLM, SLA e OLA]]
- [[SLA e níveis de serviço (regra)]]
