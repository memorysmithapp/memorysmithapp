---
title: Integrações e operação (view)
aliases: [view integrações, arquitetura operacional]
tags: [view, integracoes, operacao, dominio/integracoes]
type: view
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-034 · API v2 HL Router REST GraphQL OAuth RSQL|EV-1-034]]"
  - "[[EV-1-035 · Notificações event template target queue|EV-1-035]]"
  - "[[EV-1-037 · CronTask ações automáticas interno externo|EV-1-037]]"
  - "[[EV-1-038 · Agente de inventário protocolo XML-JSON OAuth|EV-1-038]]"
author: CAD Discovery
created: 2026-07-10
---

# Integrações e operação (view)

Canais de entrada/saída e execução em segundo plano em torno do núcleo.

```mermaid
flowchart LR
    subgraph Entradas
      UI[UI Web]
      API[API REST/GraphQL]
      MAIL[Coletor IMAP]
      AG[Agente de inventário\nXML/JSON + OAuth]
    end
    subgraph Nucleo
      IDX[index.php + Kernel]
      DOM[Domínio CommonDBTM]
    end
    subgraph Background
      CRON[CronTask]
      Q[Fila de notificações]
    end
    subgraph Saidas
      SMTP[E-mail SMTP]
      EXT[Sistemas externos / plugins]
    end
    DB[(MariaDB)]

    UI --> IDX
    API --> IDX
    MAIL --> IDX
    AG --> IDX
    IDX --> DOM --> DB
    DOM --> Q
    CRON --> Q --> SMTP
    CRON --> DOM
    DOM --> EXT
```
