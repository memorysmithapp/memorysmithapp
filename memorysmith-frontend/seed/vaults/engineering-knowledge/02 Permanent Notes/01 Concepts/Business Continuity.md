---
title: Business Continuity
aliases:
  - Continuidade de Negócios
  - BC
tags:
  - resilience
  - governance
  - operations
type: concept
status: evergreen
created: 2026-07-09
---
Business Continuity (BC) é a capacidade de uma organização manter suas operações essenciais durante e após eventos adversos.

Enquanto o [[Disaster Recovery]] trata da recuperação da tecnologia, Business Continuity abrange pessoas, processos, instalações e tecnologia.

```mermaid
graph TD

BC["Business Continuity"]

BC --> People["Pessoas"]
BC --> Process["Processos"]
BC --> Facilities["Instalações"]
BC --> Technology["Tecnologia"]

Technology --> DR["Disaster Recovery"]
```

> [!tip]
> Disaster Recovery é um subconjunto da estratégia de Business Continuity.

## Objetivos

- Manter serviços essenciais
- Reduzir impacto financeiro
- Preservar a confiança dos clientes
- Atender requisitos regulatórios

## Componentes

- Gestão de riscos
- Plano de continuidade
- Plano de comunicação
- Disaster Recovery
- Testes periódicos

## Exemplos

- Operação em múltiplas regiões
- Equipes distribuídas
- Infraestrutura redundante
- Backup dos dados

## Veja também

- [[Disaster Recovery]]
- [[Backup]]
- [[High Availability]]
- [[Risk Management]]