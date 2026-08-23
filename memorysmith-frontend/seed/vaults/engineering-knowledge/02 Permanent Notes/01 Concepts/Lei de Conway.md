---
title: Lei de Conway
tags:
  - arquitetura
  - ddd
  - microservices
  - organizacao
type: concept
aliases:
  - Conway's Law
status: evergreen
---

> [!quote]
> **"Organizações projetam sistemas que refletem sua estrutura de comunicação."**
>
> — Melvin Conway (1967)

> [!info] O que significa?
> A arquitetura de um sistema tende a espelhar a forma como as equipes estão organizadas e se comunicam. Se a comunicação entre equipes é fragmentada, o software também tende a apresentar fronteiras e dependências semelhantes.

## Como funciona

```mermaid
flowchart LR

    A[Organização] --> B[Equipes]
    B --> C[Estrutura de Comunicação]
    C --> D[Arquitetura do Software]
```

## Exemplo

```mermaid
flowchart TB

    subgraph Organização
        T1[Equipe Clientes]
        T2[Equipe Pedidos]
        T3[Equipe Pagamentos]
    end

    T1 --> S1[Serviço Clientes]
    T2 --> S2[Serviço Pedidos]
    T3 --> S3[Serviço Pagamentos]
```

> [!success] Quando aplicada corretamente
> Equipes alinhadas aos domínios de negócio tendem a produzir sistemas mais coesos, desacoplados e fáceis de evoluir.

> [!warning] Atenção
> Migrar um monólito para microsserviços sem mudar a forma como as equipes trabalham normalmente resulta em um **monólito distribuído**.

## Conceitos relacionados

- [[Domain-Driven Design]]
- [[Bounded Context]]
- [[Microsserviços]]
- [[Team Topologies]]
- [[Arquitetura Evolutiva]]
- [[Reverse Conway Maneuver]]