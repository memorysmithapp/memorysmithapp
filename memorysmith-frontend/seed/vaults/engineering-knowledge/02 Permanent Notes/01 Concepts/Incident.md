---
title: Incident
aliases:
  - Incidente
tags:
  - itil
  - operations
  - incident
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> Incident é uma interrupção não planejada de um serviço ou a redução de sua qualidade.

## Conceito

O incidente é definido pelo **efeito no serviço**, não pela falha técnica. Um disco que falha num array redundante é um evento; não é incidente. Uma latência que dobra sem quebrar nada é incidente, ainda que nada esteja "fora do ar".

O objetivo do tratamento de incidente é **restaurar**, não corrigir. Corrigir é responsabilidade de [[Problem Management]], e confundir os dois é a razão de incidentes longos: o time investiga causa raiz enquanto o serviço segue indisponível.

## Comparação

| | [[Incident]] | [[Problem]] | Evento |
|---|---|---|---|
| Natureza | Interrupção percebida | Causa de um ou mais incidentes | Mudança de estado observada |
| Objetivo | Restaurar rápido | Eliminar recorrência | Detectar |
| Urgência | Alta | Analítica | Depende do tipo |

## Veja também

- [[Problem]]
- [[Error]]
- [[Incident Management]]
- [[Support (Lifecycle)]]
- [[Mean Time to Restore (MTTR)]]
