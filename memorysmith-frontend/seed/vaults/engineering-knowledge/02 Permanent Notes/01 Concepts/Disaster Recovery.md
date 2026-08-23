---
title: Disaster Recovery
aliases:
  - DR
  - Recuperação de Desastres
tags:
  - resilience
  - disaster-recovery
  - cloud
  - operations
type: concept
status: evergreen
created: 2026-07-09
---
Disaster Recovery (DR) é o conjunto de estratégias, processos e tecnologias utilizados para restaurar serviços e dados após um desastre que comprometa a operação normal de um sistema.

O objetivo é reduzir o impacto da indisponibilidade e garantir a continuidade dos serviços críticos.

```mermaid
flowchart LR

Failure["Desastre"] --> Activate["Ativar Plano de DR"]
Activate --> Recover["Recuperar Infraestrutura"]
Recover --> Restore["Restaurar Dados"]
Restore --> Resume["Retomar Operação"]
```

> [!info]
> Disaster Recovery é uma parte da estratégia de [[Business Continuity]], focada especificamente na recuperação da infraestrutura e dos sistemas de TI.

## Objetivos

- Restaurar serviços críticos
- Minimizar indisponibilidade
- Reduzir perda de dados
- Garantir continuidade operacional

## Métricas importantes

### RTO (Recovery Time Objective)

Tempo máximo aceitável para restaurar um serviço.

### RPO (Recovery Point Objective)

Quantidade máxima aceitável de dados que podem ser perdidos.

## Estratégias comuns

- Backup e Restore
- Pilot Light
- Warm Standby
- Active/Passive
- Active/Active

## Boas práticas

- Automatizar o processo de recuperação
- Replicar dados entre regiões
- Testar periodicamente o plano de DR
- Documentar procedimentos

## Veja também

- [[Backup]]
- [[Business Continuity]]
- [[High Availability]]
- [[RPO]]
- [[RTO]]