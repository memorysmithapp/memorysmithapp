---
title: Backup
tags:
  - storage
  - disaster-recovery
  - resilience
type: concept
status: evergreen
created: 2026-07-09
---
Backup é o processo de criar cópias dos dados para possibilitar sua recuperação em caso de perda, corrupção, exclusão acidental ou desastre.

É um componente fundamental da estratégia de continuidade de negócios.

```mermaid
graph LR

Production --> Backup
Backup --> Restore
Restore --> Recovery
```

> [!warning]
> Um backup só é considerado confiável quando seu processo de restauração é testado regularmente.

## Objetivos

- Recuperação de dados
- Continuidade do negócio
- Atendimento a requisitos legais
- Proteção contra ransomware

## Estratégias

- Backup completo (Full)
- Backup incremental
- Backup diferencial
- Snapshot

## Regra 3-2-1

- 3 cópias dos dados
- 2 mídias diferentes
- 1 cópia fora do ambiente principal

## Métricas relacionadas

- RPO (Recovery Point Objective)
- RTO (Recovery Time Objective)

## Boas práticas

- Automatizar backups
- Criptografar os dados
- Testar restaurações periodicamente
- Definir políticas de retenção

## Veja também

- [[Storage]]
- [[Disaster Recovery]]
- [[Business Continuity]]
- [[Snapshot]]